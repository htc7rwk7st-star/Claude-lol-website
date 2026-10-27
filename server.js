"use strict";

/**
 * Duo Challenge Backend
 *
 * Lädt Account-, Rang- und Matchdaten von der Riot Games API, prüft für jedes
 * Duo, welche Ranked-Solo/Duo-Spiele gemeinsam gespielt wurden, erkennt
 * Solo-Spiele ohne Partner und liefert die berechneten Ergebnisse an das
 * Frontend aus.
 *
 * Start:  node server.js   (Node.js >= 18.17, benötigt globales fetch)
 */

require("dotenv").config({ quiet: true });

const path = require("path");
const fs = require("fs/promises");
const express = require("express");

/* ------------------------------------------------------------------ */
/*  Konfiguration                                                      */
/* ------------------------------------------------------------------ */

const DUOS = [
  {
    id: "baron-bandits",
    name: "Baron Bandits",
    motto: "Wer zuerst smitet, zahlt nicht die Pizza.",
    players: [
      { gameName: "Kaiserschmarrn", tagLine: "EUW" },
      { gameName: "MidOrFeed", tagLine: "2407" },
    ],
  },
  {
    id: "botlane-buendnis",
    name: "Botlane-Bündnis",
    motto: "2v2 Bot oder gar nicht.",
    players: [
      { gameName: "Jinxed4Life", tagLine: "BOT" },
      { gameName: "ThreshHold", tagLine: "hook" },
    ],
  },
  {
    id: "dorfjungen",
    name: "Die Dorfjungen",
    motto: "Garen drückt E, wir drücken die Daumen.",
    players: [
      { gameName: "Grubenjunge", tagLine: "RUHR" },
      { gameName: "LilliaLiebhaber", tagLine: "EUW" },
    ],
  },
  {
    id: "tilt-resistent",
    name: "Tilt-Resistent",
    motto: "Mute all, Kopf hoch, weiter queuen.",
    players: [
      { gameName: "NoFlashNoProblem", tagLine: "EUW" },
      { gameName: "KarmaKoma", tagLine: "1234" },
    ],
  },
];

const RIOT_API_KEY = (process.env.RIOT_API_KEY || "").trim();
const CHALLENGE_START_TIMESTAMP = Number(process.env.CHALLENGE_START_TIMESTAMP || 1790805600); // 01.10.2026 00:00 MESZ
const CHALLENGE_END_TIMESTAMP = process.env.CHALLENGE_END_TIMESTAMP
  ? Number(process.env.CHALLENGE_END_TIMESTAMP)
  : null;
const PORT = Number(process.env.PORT || 3001);
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "*";
const REFRESH_TOKEN = process.env.REFRESH_TOKEN || "";
const REFRESH_ON_START = process.env.REFRESH_ON_START === "true";
const DATA_DIR = path.resolve(process.env.DATA_DIR || __dirname);

const REGIONAL_HOST = "https://europe.api.riotgames.com"; // Account-V1, Match-V5
const PLATFORM_HOST = "https://euw1.api.riotgames.com"; // Summoner-V4, League-V4

const RANKED_SOLO_QUEUE_ID = 420;
const MATCH_IDS_PAGE_SIZE = 100;
const MIN_GAMES_FOR_COMBO = 3;
const RECENT_GAMES_LIMIT = 20;
const REFRESH_COOLDOWN_MS = 5 * 60 * 1000;
const REQUEST_GAP_MS = 100;
const REQUEST_TIMEOUT_MS = 15000;
const MAX_RATE_LIMIT_RETRIES = 10;
const MAX_SERVER_ERROR_RETRIES = 4;
const MATCH_DB_FLUSH_EVERY = 25;

const PUUID_CACHE_FILE = path.join(DATA_DIR, "cache.json");
const MATCH_DB_FILE = path.join(DATA_DIR, "matches_db.json");
const RESULTS_FILE = path.join(DATA_DIR, "results.json");
const DIST_DIR = path.join(__dirname, "dist");

// Riot teamPosition -> Rollen-Schlüssel des Frontends
const ROLE_MAP = {
  TOP: "TOP",
  JUNGLE: "JUNGLE",
  MIDDLE: "MID",
  BOTTOM: "ADC",
  UTILITY: "SUPPORT",
};

const TIERS = ["IRON", "BRONZE", "SILVER", "GOLD", "PLATINUM", "EMERALD", "DIAMOND", "MASTER", "GRANDMASTER", "CHALLENGER"];
const DIVISIONS = ["IV", "III", "II", "I"];
const APEX_TIERS = new Set(["MASTER", "GRANDMASTER", "CHALLENGER"]);

/* ------------------------------------------------------------------ */
/*  Logging                                                            */
/* ------------------------------------------------------------------ */

function log(level, message, extra) {
  const line = `[${new Date().toISOString()}] ${level.toUpperCase()} ${message}`;
  if (extra !== undefined) {
    console[level === "error" ? "error" : "log"](line, extra);
  } else {
    console[level === "error" ? "error" : "log"](line);
  }
}

/* ------------------------------------------------------------------ */
/*  Dateien (atomar schreiben, robust lesen)                           */
/* ------------------------------------------------------------------ */

async function readJsonFile(file, fallback) {
  try {
    const raw = await fs.readFile(file, "utf8");
    return JSON.parse(raw);
  } catch (err) {
    if (err.code === "ENOENT") return fallback;
    log("error", `Konnte ${path.basename(file)} nicht lesen, starte mit leerem Stand`, err.message);
    return fallback;
  }
}

async function writeJsonFile(file, data) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(data, null, 2), "utf8");
  await fs.rename(tmp, file);
}

/* ------------------------------------------------------------------ */
/*  Riot API: Rate-Limiting                                            */
/* ------------------------------------------------------------------ */

class RiotApiError extends Error {
  constructor(status, endpoint, body) {
    super(`Riot API ${status} bei ${endpoint}${body ? `: ${body}` : ""}`);
    this.name = "RiotApiError";
    this.status = status;
    this.endpoint = endpoint;
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

let requestChain = Promise.resolve();
let lastRequestAt = 0;
let requestCount = 0;

// Entfernt Host und Query, damit Logs und Fehlermeldungen kurz bleiben
function describeEndpoint(url) {
  const { pathname } = new URL(url);
  return pathname;
}

function parseRetryAfter(header) {
  const seconds = Number(header);
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1000;
  const date = Date.parse(header || "");
  if (Number.isFinite(date)) return Math.max(0, date - Date.now());
  return 1000;
}

async function performRequest(url) {
  const endpoint = describeEndpoint(url);
  let rateLimitRetries = 0;
  let serverErrorRetries = 0;

  for (;;) {
    const wait = lastRequestAt + REQUEST_GAP_MS - Date.now();
    if (wait > 0) await sleep(wait);
    lastRequestAt = Date.now();
    requestCount += 1;

    let response;
    try {
      response = await fetch(url, {
        headers: { "X-Riot-Token": RIOT_API_KEY, Accept: "application/json" },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (err) {
      if (serverErrorRetries >= MAX_SERVER_ERROR_RETRIES) {
        throw new RiotApiError(0, endpoint, `Netzwerkfehler: ${err.message}`);
      }
      serverErrorRetries += 1;
      const backoff = 1000 * 2 ** (serverErrorRetries - 1);
      log("warn", `Netzwerkfehler bei ${endpoint}, neuer Versuch in ${backoff} ms`, err.message);
      await sleep(backoff);
      continue;
    }

    if (response.status === 429) {
      if (rateLimitRetries >= MAX_RATE_LIMIT_RETRIES) {
        throw new RiotApiError(429, endpoint, "Rate Limit dauerhaft überschritten");
      }
      rateLimitRetries += 1;
      const retryAfterMs = parseRetryAfter(response.headers.get("retry-after"));
      const limitType = response.headers.get("x-rate-limit-type") || "unbekannt";
      log("warn", `429 bei ${endpoint} (Limit: ${limitType}), warte ${Math.ceil(retryAfterMs / 1000)} s`);
      await response.body?.cancel();
      // Die Kette bleibt blockiert, damit alle wartenden Requests mitpausieren
      await sleep(retryAfterMs + 50);
      continue;
    }

    if (response.status >= 500) {
      await response.body?.cancel();
      if (serverErrorRetries >= MAX_SERVER_ERROR_RETRIES) {
        throw new RiotApiError(response.status, endpoint, "Serverfehler nach mehreren Versuchen");
      }
      serverErrorRetries += 1;
      const backoff = 1000 * 2 ** (serverErrorRetries - 1);
      log("warn", `${response.status} bei ${endpoint}, neuer Versuch in ${backoff} ms`);
      await sleep(backoff);
      continue;
    }

    if (response.status === 404) {
      await response.body?.cancel();
      return null;
    }

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new RiotApiError(response.status, endpoint, text.slice(0, 300));
    }

    return response.json();
  }
}

/**
 * Führt Riot-Requests strikt nacheinander aus, hält zwischen zwei Requests
 * mindestens REQUEST_GAP_MS Abstand und wartet bei HTTP 429 den Retry-After
 * Header ab. Liefert das geparste JSON, bei 404 `null`.
 */
function fetchWithRateLimit(url) {
  const result = requestChain.then(() => performRequest(url));
  requestChain = result.catch(() => undefined);
  return result;
}

/* ------------------------------------------------------------------ */
/*  Riot API: Endpunkte                                                */
/* ------------------------------------------------------------------ */

const enc = encodeURIComponent;

function getAccountByRiotId(gameName, tagLine) {
  return fetchWithRateLimit(`${REGIONAL_HOST}/riot/account/v1/accounts/by-riot-id/${enc(gameName)}/${enc(tagLine)}`);
}

function getSummonerByPuuid(puuid) {
  return fetchWithRateLimit(`${PLATFORM_HOST}/lol/summoner/v4/summoners/by-puuid/${enc(puuid)}`);
}

function getLeagueEntriesByPuuid(puuid) {
  return fetchWithRateLimit(`${PLATFORM_HOST}/lol/league/v4/entries/by-puuid/${enc(puuid)}`);
}

function getLeagueEntriesBySummonerId(summonerId) {
  return fetchWithRateLimit(`${PLATFORM_HOST}/lol/league/v4/entries/by-summoner/${enc(summonerId)}`);
}

function getMatch(matchId) {
  return fetchWithRateLimit(`${REGIONAL_HOST}/lol/match/v5/matches/${enc(matchId)}`);
}

async function getRankedMatchIdsSinceStart(puuid) {
  const ids = [];
  for (let start = 0; ; start += MATCH_IDS_PAGE_SIZE) {
    const params = new URLSearchParams({
      queue: String(RANKED_SOLO_QUEUE_ID),
      startTime: String(CHALLENGE_START_TIMESTAMP),
      start: String(start),
      count: String(MATCH_IDS_PAGE_SIZE),
    });
    if (CHALLENGE_END_TIMESTAMP) params.set("endTime", String(CHALLENGE_END_TIMESTAMP));
    const page = await fetchWithRateLimit(`${REGIONAL_HOST}/lol/match/v5/matches/by-puuid/${enc(puuid)}/ids?${params}`);
    if (!Array.isArray(page) || page.length === 0) break;
    ids.push(...page);
    if (page.length < MATCH_IDS_PAGE_SIZE) break;
  }
  return ids;
}

/* ------------------------------------------------------------------ */
/*  PUUID-Cache (cache.json)                                           */
/* ------------------------------------------------------------------ */

const riotIdKey = (gameName, tagLine) => `${gameName}#${tagLine}`.toLowerCase();

let puuidCache = { accounts: {} };

async function loadPuuidCache() {
  const data = await readJsonFile(PUUID_CACHE_FILE, { accounts: {} });
  puuidCache = data && typeof data.accounts === "object" ? data : { accounts: {} };
}

async function savePuuidCache() {
  await writeJsonFile(PUUID_CACHE_FILE, puuidCache);
}

async function resolvePuuid(gameName, tagLine, { forceRefresh = false } = {}) {
  const key = riotIdKey(gameName, tagLine);
  const cached = puuidCache.accounts[key];
  if (cached && !forceRefresh) return cached.puuid;

  const account = await getAccountByRiotId(gameName, tagLine);
  if (!account || !account.puuid) {
    throw new Error(`Riot ID ${gameName}#${tagLine} wurde nicht gefunden`);
  }
  puuidCache.accounts[key] = {
    puuid: account.puuid,
    gameName: account.gameName || gameName,
    tagLine: account.tagLine || tagLine,
    resolvedAt: new Date().toISOString(),
  };
  await savePuuidCache();
  return account.puuid;
}

/* ------------------------------------------------------------------ */
/*  Match-Datenbank (matches_db.json)                                  */
/* ------------------------------------------------------------------ */

let matchDb = { matches: {} };
let unsavedMatches = 0;

async function loadMatchDb() {
  const data = await readJsonFile(MATCH_DB_FILE, { matches: {} });
  matchDb = data && typeof data.matches === "object" ? data : { matches: {} };
}

async function saveMatchDb() {
  await writeJsonFile(MATCH_DB_FILE, matchDb);
  unsavedMatches = 0;
}

// Speichert nur die Felder, die für die Auswertung gebraucht werden
function compactMatch(match) {
  const { info, metadata } = match;
  return {
    matchId: metadata.matchId,
    queueId: info.queueId,
    gameCreation: info.gameCreation,
    gameStartTimestamp: info.gameStartTimestamp || info.gameCreation,
    gameEndTimestamp: info.gameEndTimestamp || null,
    gameDuration: info.gameEndTimestamp ? info.gameDuration : Math.round(info.gameDuration / 1000),
    gameVersion: info.gameVersion,
    participants: info.participants.map((p) => ({
      puuid: p.puuid,
      riotIdGameName: p.riotIdGameName || null,
      riotIdTagline: p.riotIdTagline || null,
      teamId: p.teamId,
      win: p.win,
      championId: p.championId,
      championName: p.championName,
      teamPosition: p.teamPosition || "",
      individualPosition: p.individualPosition || "",
      kills: p.kills,
      deaths: p.deaths,
      assists: p.assists,
      cs: (p.totalMinionsKilled || 0) + (p.neutralMinionsKilled || 0),
      gameEndedInEarlySurrender: Boolean(p.gameEndedInEarlySurrender),
    })),
  };
}

async function getMatchCached(matchId) {
  const cached = matchDb.matches[matchId];
  if (cached) return cached;

  const match = await getMatch(matchId);
  if (!match || !match.info || !match.metadata) return null;

  const compact = compactMatch(match);
  matchDb.matches[matchId] = compact;
  unsavedMatches += 1;
  if (unsavedMatches >= MATCH_DB_FLUSH_EVERY) await saveMatchDb();
  return compact;
}

/* ------------------------------------------------------------------ */
/*  Spielerdaten                                                       */
/* ------------------------------------------------------------------ */

async function fetchSoloQueueEntry(puuid, summoner) {
  let entries = await getLeagueEntriesByPuuid(puuid);
  if (!Array.isArray(entries) && summoner && summoner.id) {
    entries = await getLeagueEntriesBySummonerId(summoner.id);
  }
  if (!Array.isArray(entries)) return null;
  return entries.find((e) => e.queueType === "RANKED_SOLO_5x5") || null;
}

async function fetchPlayer(config) {
  let puuid = await resolvePuuid(config.gameName, config.tagLine);
  let summoner;

  try {
    summoner = await getSummonerByPuuid(puuid);
  } catch (err) {
    // 400 bedeutet meist: PUUID gehört zu einem anderen API-Key-Projekt
    if (!(err instanceof RiotApiError) || err.status !== 400) throw err;
    summoner = null;
  }

  if (!summoner) {
    const previous = puuid;
    puuid = await resolvePuuid(config.gameName, config.tagLine, { forceRefresh: true });
    if (puuid !== previous) {
      log("warn", `PUUID von ${config.gameName}#${config.tagLine} hat sich geändert, Match-Datenbank wird geleert`);
      matchDb = { matches: {} };
      await saveMatchDb();
    }
    summoner = await getSummonerByPuuid(puuid);
    if (!summoner) {
      throw new Error(`Kein EUW-Summoner für ${config.gameName}#${config.tagLine} gefunden`);
    }
  }

  const entry = await fetchSoloQueueEntry(puuid, summoner);
  const account = puuidCache.accounts[riotIdKey(config.gameName, config.tagLine)];

  return {
    puuid,
    gameName: account?.gameName || config.gameName,
    tagLine: account?.tagLine || config.tagLine,
    profileIconId: summoner.profileIconId,
    summonerLevel: summoner.summonerLevel,
    rank: entry
      ? {
          tier: entry.tier,
          division: APEX_TIERS.has(entry.tier) ? null : entry.rank,
          lp: entry.leaguePoints,
        }
      : null,
    wins: entry ? entry.wins : 0,
    losses: entry ? entry.losses : 0,
    hotStreak: entry ? Boolean(entry.hotStreak) : false,
  };
}

/* ------------------------------------------------------------------ */
/*  Berechnungen                                                       */
/* ------------------------------------------------------------------ */

const winrate = (wins, games) => (games > 0 ? Math.round((wins / games) * 1000) / 10 : 0);

function rankScore(rank) {
  if (!rank) return null;
  if (APEX_TIERS.has(rank.tier)) return 7 * 400 + rank.lp;
  return TIERS.indexOf(rank.tier) * 400 + DIVISIONS.indexOf(rank.division) * 100 + rank.lp;
}

function scoreToRank(score) {
  if (score === null) return null;
  if (score >= 2800) return { tier: "MASTER", division: null, lp: Math.round(score - 2800) };
  const tierIndex = Math.floor(score / 400);
  const rest = score - tierIndex * 400;
  const divisionIndex = Math.min(3, Math.floor(rest / 100));
  return { tier: TIERS[tierIndex], division: DIVISIONS[divisionIndex], lp: Math.round(rest - divisionIndex * 100) };
}

function normalizeChampion(championName) {
  // Match-V5 liefert "FiddleSticks", Data Dragon erwartet "Fiddlesticks"
  return championName === "FiddleSticks" ? "Fiddlesticks" : championName;
}

function resolvePosition(participant) {
  const raw = participant.teamPosition || participant.individualPosition || "";
  return ROLE_MAP[raw] ? raw : "UNKNOWN";
}

function pickBestCombo(groups) {
  const list = [...groups.values()].map((g) => ({ ...g, winrate: winrate(g.wins, g.games) }));
  if (list.length === 0) return null;

  const eligible = list.filter((g) => g.games >= MIN_GAMES_FOR_COMBO);
  if (eligible.length > 0) {
    eligible.sort((a, b) => b.winrate - a.winrate || b.games - a.games);
    return { ...eligible[0], qualified: true };
  }

  list.sort((a, b) => b.wins - a.wins || a.losses - b.losses || b.games - a.games);
  return { ...list[0], qualified: false };
}

function addToGroup(groups, key, base, win) {
  const group = groups.get(key) || { ...base, games: 0, wins: 0, losses: 0 };
  group.games += 1;
  if (win) group.wins += 1;
  else group.losses += 1;
  groups.set(key, group);
}

function computeDuoStats(duoGames) {
  const counted = duoGames.filter((g) => !g.remake);
  const wins = counted.filter((g) => g.win).length;
  const losses = counted.length - wins;

  const champGroups = new Map();
  const roleGroups = new Map();

  for (const game of counted) {
    const [p1, p2] = game.players;
    addToGroup(
      champGroups,
      `${p1.championName}|${p2.championName}`,
      { champions: [p1.championName, p2.championName], championIds: [p1.championId, p2.championId] },
      game.win
    );
    addToGroup(
      roleGroups,
      `${p1.teamPosition}|${p2.teamPosition}`,
      { positions: [p1.teamPosition, p2.teamPosition], roles: [p1.role, p2.role] },
      game.win
    );
  }

  return {
    games: counted.length,
    wins,
    losses,
    remakes: duoGames.length - counted.length,
    winrate: winrate(wins, counted.length),
    bestChampCombo: pickBestCombo(champGroups),
    bestRoleCombo: pickBestCombo(roleGroups),
  };
}

function toGamePlayer(participant) {
  const position = resolvePosition(participant);
  return {
    championName: normalizeChampion(participant.championName),
    championId: participant.championId,
    teamPosition: position,
    role: ROLE_MAP[position] || "UNKNOWN",
    kills: participant.kills,
    deaths: participant.deaths,
    assists: participant.assists,
    cs: participant.cs,
  };
}

/* ------------------------------------------------------------------ */
/*  Duo-Auswertung                                                     */
/* ------------------------------------------------------------------ */

async function evaluateDuo(duoConfig) {
  const players = [];
  for (const playerConfig of duoConfig.players) {
    players.push(await fetchPlayer(playerConfig));
  }
  const [p1, p2] = players;

  const idsP1 = await getRankedMatchIdsSinceStart(p1.puuid);
  const idsP2 = await getRankedMatchIdsSinceStart(p2.puuid);
  const allIds = [...new Set([...idsP1, ...idsP2])];

  const duoGames = [];
  const violations = [[], []];
  const startMs = CHALLENGE_START_TIMESTAMP * 1000;
  const endMs = CHALLENGE_END_TIMESTAMP ? CHALLENGE_END_TIMESTAMP * 1000 : Infinity;

  for (const matchId of allIds) {
    const match = await getMatchCached(matchId);
    if (!match) {
      log("warn", `Match ${matchId} nicht gefunden, übersprungen`);
      continue;
    }
    if (match.queueId !== RANKED_SOLO_QUEUE_ID) continue;
    if (match.gameStartTimestamp < startMs || match.gameStartTimestamp > endMs) continue;

    const part1 = match.participants.find((p) => p.puuid === p1.puuid);
    const part2 = match.participants.find((p) => p.puuid === p2.puuid);
    const remake = Boolean(part1?.gameEndedInEarlySurrender || part2?.gameEndedInEarlySurrender);

    if (part1 && part2 && part1.teamId === part2.teamId) {
      duoGames.push({
        matchId,
        date: new Date(match.gameStartTimestamp).toISOString(),
        durationSec: match.gameDuration,
        win: part1.win,
        remake,
        players: [toGamePlayer(part1), toGamePlayer(part2)],
      });
      continue;
    }

    // Nicht im selben Team: jeder Beteiligte hat ohne Partner gequeued
    const reason = part1 && part2 ? "Gegnerische Teams" : "Solo-Game ohne Partner";
    [part1, part2].forEach((participant, index) => {
      if (!participant) return;
      violations[index].push({
        matchId,
        date: new Date(match.gameStartTimestamp).toISOString(),
        championName: normalizeChampion(participant.championName),
        win: participant.win,
        remake: participant.gameEndedInEarlySurrender,
        reason,
      });
    });
  }

  duoGames.sort((a, b) => b.date.localeCompare(a.date));
  violations.forEach((list) => list.sort((a, b) => b.date.localeCompare(a.date)));

  const stats = computeDuoStats(duoGames);
  const scores = players.map((p) => rankScore(p.rank));
  const avgRankScore = scores.every((s) => s !== null) ? (scores[0] + scores[1]) / 2 : null;

  return {
    id: duoConfig.id,
    name: duoConfig.name,
    motto: duoConfig.motto || null,
    players: players.map((p, index) => ({
      gameName: p.gameName,
      tagLine: p.tagLine,
      profileIconId: p.profileIconId,
      summonerLevel: p.summonerLevel,
      rank: p.rank,
      wins: p.wins,
      losses: p.losses,
      winrate: winrate(p.wins, p.wins + p.losses),
      hotStreak: p.hotStreak,
      rankedGamesSinceStart: index === 0 ? idsP1.length : idsP2.length,
      soloGames: violations[index].length,
      lastSolo: violations[index][0]?.date || null,
      soloMatches: violations[index],
    })),
    stats: {
      ...stats,
      avgRankScore,
      avgRank: scoreToRank(avgRankScore),
      fairPlay: violations[0].length === 0 && violations[1].length === 0,
      totalViolations: violations[0].length + violations[1].length,
    },
    games: duoGames.slice(0, RECENT_GAMES_LIMIT),
    error: null,
  };
}

/* ------------------------------------------------------------------ */
/*  Refresh-Ablauf                                                     */
/* ------------------------------------------------------------------ */

let results = null;
let refreshInProgress = false;

function emptyResults() {
  return {
    meta: {
      challengeStart: CHALLENGE_START_TIMESTAMP,
      challengeEnd: CHALLENGE_END_TIMESTAMP,
      lastUpdated: null,
      lastRefreshStartedAt: null,
      lastRefreshDurationMs: null,
      requestsLastRefresh: 0,
      errors: [],
    },
    duos: [],
  };
}

async function loadResults() {
  const data = await readJsonFile(RESULTS_FILE, null);
  results = data && data.meta && Array.isArray(data.duos) ? data : emptyResults();
}

function cooldownRemainingMs() {
  const startedAt = results?.meta?.lastRefreshStartedAt;
  if (!startedAt) return 0;
  return Math.max(0, Date.parse(startedAt) + REFRESH_COOLDOWN_MS - Date.now());
}

function buildMeta() {
  const remaining = cooldownRemainingMs();
  return {
    ...results.meta,
    refreshing: refreshInProgress,
    cooldownMs: REFRESH_COOLDOWN_MS,
    nextRefreshAllowedAt: remaining > 0 ? new Date(Date.now() + remaining).toISOString() : null,
  };
}

async function runRefresh() {
  const startedAt = Date.now();
  const requestsBefore = requestCount;
  const previousById = new Map(results.duos.map((d) => [d.id, d]));
  const duos = [];
  const errors = [];

  log("info", `Refresh gestartet für ${DUOS.length} Duos`);

  for (const duoConfig of DUOS) {
    try {
      const duo = await evaluateDuo(duoConfig);
      duos.push(duo);
      log(
        "info",
        `${duo.name}: ${duo.stats.games} Duo-Spiele (${duo.stats.wins}-${duo.stats.losses}), ${duo.stats.totalViolations} Regelverstöße`
      );
    } catch (err) {
      log("error", `Auswertung von ${duoConfig.name} fehlgeschlagen`, err.message);
      errors.push({ duoId: duoConfig.id, message: err.message });
      const previous = previousById.get(duoConfig.id);
      // Alte Daten behalten, damit ein einzelner Fehler das Dashboard nicht leert
      duos.push(
        previous
          ? { ...previous, motto: duoConfig.motto || null, error: err.message }
          : {
              id: duoConfig.id,
              name: duoConfig.name,
              motto: duoConfig.motto || null,
              players: [],
              stats: null,
              games: [],
              error: err.message,
            }
      );
    }
  }

  if (unsavedMatches > 0) await saveMatchDb();

  results = {
    meta: {
      challengeStart: CHALLENGE_START_TIMESTAMP,
      challengeEnd: CHALLENGE_END_TIMESTAMP,
      lastUpdated: new Date().toISOString(),
      lastRefreshStartedAt: new Date(startedAt).toISOString(),
      lastRefreshDurationMs: Date.now() - startedAt,
      requestsLastRefresh: requestCount - requestsBefore,
      errors,
    },
    duos,
  };
  await writeJsonFile(RESULTS_FILE, results);
  log(
    "info",
    `Refresh fertig in ${Math.round((Date.now() - startedAt) / 1000)} s, ${requestCount - requestsBefore} API-Requests`
  );
}

function startRefresh() {
  refreshInProgress = true;
  results.meta.lastRefreshStartedAt = new Date().toISOString();
  return runRefresh()
    .catch(async (err) => {
      log("error", "Refresh abgebrochen", err);
      results.meta.errors = [{ duoId: null, message: err.message }];
      if (unsavedMatches > 0) await saveMatchDb().catch(() => undefined);
      await writeJsonFile(RESULTS_FILE, results).catch(() => undefined);
    })
    .finally(() => {
      refreshInProgress = false;
    });
}

/* ------------------------------------------------------------------ */
/*  HTTP-Server                                                        */
/* ------------------------------------------------------------------ */

const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "10kb" }));

app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", ALLOWED_ORIGIN);
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Refresh-Token");
  if (ALLOWED_ORIGIN !== "*") res.setHeader("Vary", "Origin");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

app.get("/api/health", (req, res) => {
  res.json({ ok: true, refreshing: refreshInProgress, lastUpdated: results.meta.lastUpdated });
});

app.get("/api/duos", (req, res) => {
  res.set("Cache-Control", "no-store");
  res.json({ meta: buildMeta(), duos: results.duos });
});

app.post("/api/refresh", (req, res) => {
  if (REFRESH_TOKEN && req.get("X-Refresh-Token") !== REFRESH_TOKEN) {
    return res.status(401).json({ error: "Ungültiger oder fehlender X-Refresh-Token" });
  }

  if (refreshInProgress) {
    return res.status(409).json({ error: "Es läuft bereits eine Aktualisierung", meta: buildMeta() });
  }

  const remaining = cooldownRemainingMs();
  if (remaining > 0) {
    res.set("Retry-After", String(Math.ceil(remaining / 1000)));
    return res.status(429).json({
      error: `Cooldown aktiv, nächste Aktualisierung in ${Math.ceil(remaining / 1000)} Sekunden möglich`,
      retryAfterSec: Math.ceil(remaining / 1000),
      meta: buildMeta(),
    });
  }

  startRefresh();
  // Ein erster Refresh kann bei vielen Matches Minuten dauern, daher 202 + Polling über /api/duos
  res.status(202).json({ message: "Aktualisierung gestartet", meta: buildMeta() });
});

// Gebautes Frontend (npm run build) ausliefern, alle Nicht-API-Pfade landen in der React-App
app.use(express.static(DIST_DIR, { index: false, maxAge: "7d", immutable: true }));

app.use((req, res, next) => {
  if (req.method !== "GET" || req.path.startsWith("/api/")) return next();
  res.sendFile(path.join(DIST_DIR, "index.html"), { headers: { "Cache-Control": "no-cache" } }, (err) => {
    if (err) next();
  });
});

app.use((req, res) => {
  res.status(404).json({ error: `Unbekannter Endpunkt ${req.method} ${req.path}` });
});

app.use((err, req, res, next) => {
  log("error", `Unerwarteter Fehler bei ${req.method} ${req.path}`, err);
  if (res.headersSent) return next(err);
  res.status(500).json({ error: "Interner Serverfehler" });
});

/* ------------------------------------------------------------------ */
/*  Start & Shutdown                                                   */
/* ------------------------------------------------------------------ */

function validateConfig() {
  const problems = [];
  if (!RIOT_API_KEY) problems.push("RIOT_API_KEY fehlt in der .env-Datei");
  if (!Number.isInteger(CHALLENGE_START_TIMESTAMP) || CHALLENGE_START_TIMESTAMP <= 0) {
    problems.push("CHALLENGE_START_TIMESTAMP muss ein Unix-Timestamp in Sekunden sein");
  }
  if (CHALLENGE_START_TIMESTAMP > 1e11) {
    problems.push("CHALLENGE_START_TIMESTAMP sieht nach Millisekunden aus, erwartet werden Sekunden");
  }
  if (CHALLENGE_END_TIMESTAMP !== null && !(CHALLENGE_END_TIMESTAMP > CHALLENGE_START_TIMESTAMP)) {
    problems.push("CHALLENGE_END_TIMESTAMP muss nach CHALLENGE_START_TIMESTAMP liegen");
  }
  const ids = new Set();
  for (const duo of DUOS) {
    if (ids.has(duo.id)) problems.push(`Doppelte Duo-ID: ${duo.id}`);
    ids.add(duo.id);
    if (!Array.isArray(duo.players) || duo.players.length !== 2) {
      problems.push(`Duo ${duo.id} braucht genau zwei Spieler`);
      continue;
    }
    for (const p of duo.players) {
      if (!p.gameName || !p.tagLine) problems.push(`Duo ${duo.id}: gameName und tagLine sind Pflicht`);
    }
  }
  if (problems.length > 0) {
    problems.forEach((p) => log("error", p));
    process.exit(1);
  }
}

async function main() {
  validateConfig();
  await Promise.all([loadPuuidCache(), loadMatchDb(), loadResults()]);
  log(
    "info",
    `Daten geladen: ${Object.keys(puuidCache.accounts).length} PUUIDs, ${Object.keys(matchDb.matches).length} Matches im Cache`
  );

  const server = app.listen(PORT, () => {
    log("info", `Duo Challenge Backend läuft auf http://localhost:${PORT}`);
    if (REFRESH_ON_START && cooldownRemainingMs() === 0) startRefresh();
  });

  const shutdown = async (signal) => {
    log("info", `${signal} empfangen, fahre herunter`);
    server.close();
    // Bereits geladene Matches sichern, ein laufender Refresh startet beim nächsten Mal mit diesem Stand
    if (unsavedMatches > 0) await saveMatchDb().catch((err) => log("error", "Match-Datenbank nicht gespeichert", err));
    process.exit(0);
  };
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

main().catch((err) => {
  log("error", "Start fehlgeschlagen", err);
  process.exit(1);
});
