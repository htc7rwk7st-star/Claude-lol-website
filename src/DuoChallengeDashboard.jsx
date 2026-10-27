import React, { useState, useMemo, useEffect, useCallback, createContext, useContext } from "react";
import {
  Trophy,
  RefreshCw,
  Swords,
  Shield,
  Crosshair,
  Zap,
  Heart,
  Leaf,
  Timer,
  ChevronDown,
  ShieldCheck,
  ShieldAlert,
  Users,
  Calendar,
  Clock,
  ArrowDown,
  ArrowUp,
  TrendingUp,
  Crown,
  Search,
  Gamepad2,
  Medal,
  Link2,
  Sparkles,
  Hourglass,
  AlertTriangle,
  ExternalLink,
  Loader2,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Konfiguration                                                      */
/* ------------------------------------------------------------------ */

// Leer = gleicher Server (Produktion) bzw. Vite-Proxy (Entwicklung)
const API_BASE = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");
const CHALLENGE_TITLE = "Duo Challenge";
const CHALLENGE_SUBTITLE = "Herbst 2026";
const POLL_INTERVAL_MS = 3000;
const MIN_GAMES_FOR_COMBO = 3;

const DDRAGON_BASE = "https://ddragon.leagueoflegends.com";
const DDRAGON_FALLBACK_VERSION = "14.20.1";

const FONT_DISPLAY = "'Cinzel', 'Trajan Pro', Georgia, serif";
const FONT_BODY = "'Barlow', 'Segoe UI', system-ui, sans-serif";

const ROLES = {
  TOP: { label: "Top", Icon: Shield },
  JUNGLE: { label: "Jungle", Icon: Leaf },
  MID: { label: "Mid", Icon: Zap },
  ADC: { label: "ADC", Icon: Crosshair },
  SUPPORT: { label: "Support", Icon: Heart },
  UNKNOWN: { label: "Unbekannt", Icon: Users },
};

const TIER_STYLE = {
  IRON: { label: "Iron", text: "text-[#a39a94]", chip: "bg-[#3a3532]/60 border-[#6b625c]" },
  BRONZE: { label: "Bronze", text: "text-[#c98d63]", chip: "bg-[#4a2e1f]/60 border-[#8a5a3c]" },
  SILVER: { label: "Silver", text: "text-[#b9c4cc]", chip: "bg-[#38434b]/60 border-[#7d8a94]" },
  GOLD: { label: "Gold", text: "text-[#e8c36a]", chip: "bg-[#4a3b16]/60 border-[#a8873a]" },
  PLATINUM: { label: "Platinum", text: "text-[#4fd1c5]", chip: "bg-[#143f3c]/60 border-[#2f8f86]" },
  EMERALD: { label: "Emerald", text: "text-[#34d399]", chip: "bg-[#0f3d2c]/60 border-[#24936a]" },
  DIAMOND: { label: "Diamond", text: "text-[#7cb8ff]", chip: "bg-[#16305a]/60 border-[#4a7fc9]" },
  MASTER: { label: "Master", text: "text-[#c084fc]", chip: "bg-[#3b1d5a]/60 border-[#8b5cc9]" },
  GRANDMASTER: { label: "Grandmaster", text: "text-[#f87171]", chip: "bg-[#5a1d1d]/60 border-[#c94a4a]" },
  CHALLENGER: { label: "Challenger", text: "text-[#f0e6d2]", chip: "bg-[#0a3a4a]/60 border-[#c8aa6e]" },
  UNRANKED: { label: "Unranked", text: "text-[#a09b8c]", chip: "bg-[#1e2d3d]/60 border-[#3c4b5a]" },
};

/* ------------------------------------------------------------------ */
/*  API-Zugriff & Datenaufbereitung                                    */
/* ------------------------------------------------------------------ */

async function apiRequest(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { Accept: "application/json", ...(options.headers || {}) },
  });
  let body = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  return { status: response.status, ok: response.ok, body };
}

const pct = (wins, games) => (games ? (wins / games) * 100 : 0);

function normalizeRole(role) {
  return ROLES[role] ? role : "UNKNOWN";
}

function normalizeDuo(apiDuo) {
  const players = (apiDuo.players || []).map((p) => ({
    gameName: p.gameName,
    tagLine: p.tagLine,
    profileIconId: p.profileIconId,
    rank: p.rank || null,
    wins: p.wins || 0,
    losses: p.losses || 0,
    soloGames: p.soloGames || 0,
    lastSolo: p.lastSolo || null,
    soloMatches: p.soloMatches || [],
  }));

  const games = (apiDuo.games || []).map((g) => ({
    id: g.matchId,
    date: new Date(g.date),
    win: g.win,
    remake: Boolean(g.remake),
    durationSec: g.durationSec,
    players: g.players.map((p) => ({
      champ: p.championName,
      role: normalizeRole(p.role),
      kills: p.kills,
      deaths: p.deaths,
      assists: p.assists,
      cs: p.cs,
    })),
  }));

  const s = apiDuo.stats;
  const stats = {
    games: s?.games || 0,
    wins: s?.wins || 0,
    losses: s?.losses || 0,
    remakes: s?.remakes || 0,
    winrate: s?.winrate || 0,
    // Duos ohne vollständigen Rang landen beim Sortieren nach Rang ganz hinten
    avgScore: typeof s?.avgRankScore === "number" ? s.avgRankScore : -1,
    avgRank: s?.avgRank || null,
    bestChampCombo: s?.bestChampCombo
      ? {
          champs: s.bestChampCombo.champions,
          games: s.bestChampCombo.games,
          wins: s.bestChampCombo.wins,
          winrate: s.bestChampCombo.winrate,
          qualified: s.bestChampCombo.qualified,
        }
      : null,
    bestRoleCombo: s?.bestRoleCombo
      ? {
          roles: s.bestRoleCombo.roles.map(normalizeRole),
          games: s.bestRoleCombo.games,
          wins: s.bestRoleCombo.wins,
          winrate: s.bestRoleCombo.winrate,
          qualified: s.bestRoleCombo.qualified,
        }
      : null,
    soloOffenders: players.filter((p) => p.soloGames > 0),
  };

  return {
    id: apiDuo.id,
    name: apiDuo.name,
    motto: apiDuo.motto || null,
    error: apiDuo.error || null,
    complete: players.length === 2 && Boolean(s),
    players,
    games,
    stats,
  };
}

const SORTS = {
  rank: { label: "Rang / LP", Icon: Crown, value: (s) => s.avgScore },
  winrate: { label: "Duo-Winrate", Icon: TrendingUp, value: (s) => s.winrate },
  games: { label: "Anzahl Spiele", Icon: Gamepad2, value: (s) => s.games },
};

/* ------------------------------------------------------------------ */
/*  Data Dragon (aktuelle Version & deutsche Champion-Namen)           */
/* ------------------------------------------------------------------ */

const DataDragonContext = createContext({ version: DDRAGON_FALLBACK_VERSION, names: {} });

function useDataDragonInfo() {
  const [info, setInfo] = useState({ version: DDRAGON_FALLBACK_VERSION, names: {} });
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const versions = await fetch(`${DDRAGON_BASE}/api/versions.json`).then((r) => r.json());
        const version = versions[0];
        const champions = await fetch(`${DDRAGON_BASE}/cdn/${version}/data/de_DE/champion.json`).then((r) => r.json());
        const names = Object.fromEntries(Object.values(champions.data).map((c) => [c.id, c.name]));
        if (!cancelled) setInfo({ version, names });
      } catch {
        // Ohne Data Dragon bleiben Fallback-Version und aus der ID abgeleitete Namen
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  return info;
}

function useChampionName() {
  const { names } = useContext(DataDragonContext);
  return (id) => names[id] || String(id).replace(/([a-z])([A-Z])/g, "$1 $2");
}

/* ------------------------------------------------------------------ */
/*  Hilfsfunktionen für die Anzeige                                    */
/* ------------------------------------------------------------------ */

function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

const pad = (n) => String(n).padStart(2, "0");

function formatCountdown(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  return {
    d: Math.floor(total / 86400),
    h: pad(Math.floor((total % 86400) / 3600)),
    m: pad(Math.floor((total % 3600) / 60)),
    s: pad(total % 60),
  };
}

const formatDate = (date, withTime = false) =>
  new Date(date).toLocaleString("de-DE", {
    timeZone: "Europe/Berlin",
    day: "2-digit",
    month: "2-digit",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : { year: "numeric" }),
  });

const formatDuration = (sec) => `${Math.floor(sec / 60)}:${pad(sec % 60)}`;

const formatSeconds = (sec) => `${Math.floor(sec / 60)}:${pad(sec % 60)}`;

function formatRank(rank) {
  if (!rank) return TIER_STYLE.UNRANKED.label;
  const label = TIER_STYLE[rank.tier]?.label || rank.tier;
  return rank.division ? `${label} ${rank.division}` : label;
}

function matchUrl(matchId) {
  const [platform, id] = String(matchId).split("_");
  return `https://www.leagueofgraphs.com/match/${platform === "EUW1" ? "euw" : platform.toLowerCase()}/${id}`;
}

const winrateTone = (wr) =>
  wr >= 55
    ? { text: "text-[#0ac8b9]", bar: "from-[#0397ab] to-[#0ac8b9]" }
    : wr >= 50
    ? { text: "text-[#c8aa6e]", bar: "from-[#785a28] to-[#c8aa6e]" }
    : { text: "text-[#e84057]", bar: "from-[#7a1f2b] to-[#e84057]" };

/* ------------------------------------------------------------------ */
/*  Kleine Bausteine                                                   */
/* ------------------------------------------------------------------ */

function SafeImage({ src, alt, fallback, className }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  if (failed || !src) {
    return (
      <div
        className={`${className} flex items-center justify-center bg-gradient-to-br from-[#1e2d3d] to-[#0a1428] text-[#c8aa6e] font-semibold select-none`}
        aria-label={alt}
        title={alt}
      >
        {fallback}
      </div>
    );
  }
  return <img src={src} alt={alt} title={alt} className={className} loading="lazy" onError={() => setFailed(true)} />;
}

function ChampIcon({ id, size = "w-10 h-10" }) {
  const { version } = useContext(DataDragonContext);
  const championName = useChampionName();
  const name = championName(id);
  return (
    <SafeImage
      src={`${DDRAGON_BASE}/cdn/${version}/img/champion/${id}.png`}
      alt={name}
      fallback={<span className="text-xs">{name.slice(0, 2)}</span>}
      className={`${size} rounded-md border border-[#785a28] object-cover`}
    />
  );
}

function ProfileIcon({ player }) {
  const { version } = useContext(DataDragonContext);
  return (
    <SafeImage
      src={player.profileIconId != null ? `${DDRAGON_BASE}/cdn/${version}/img/profileicon/${player.profileIconId}.png` : null}
      alt={`Profilbild von ${player.gameName}`}
      fallback={<span className="text-base">{player.gameName.slice(0, 1)}</span>}
      className="h-14 w-14 rounded-full border-2 border-[#c8aa6e] object-cover"
    />
  );
}

function TierChip({ rank }) {
  const style = TIER_STYLE[rank?.tier] || TIER_STYLE.UNRANKED;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded border px-2 py-0.5 text-xs font-semibold tabular-nums ${style.chip} ${style.text}`}
    >
      <Medal className="w-3.5 h-3.5" aria-hidden="true" />
      {formatRank(rank)}
      {rank && <span className="text-[#a09b8c] font-medium">· {rank.lp} LP</span>}
    </span>
  );
}

function RoleTag({ role }) {
  const { label, Icon } = ROLES[role] || ROLES.UNKNOWN;
  return (
    <span className="inline-flex items-center gap-1 rounded border border-[#1e3a4c] bg-[#0a1e2c] px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-[#9fe2dc]">
      <Icon className="w-3 h-3" aria-hidden="true" />
      {label}
    </span>
  );
}

function RuleBadge({ offenders, size = "md" }) {
  const clean = offenders.length === 0;
  const Icon = clean ? ShieldCheck : ShieldAlert;
  const padding = size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border font-bold uppercase tracking-wider whitespace-nowrap ${padding} ${
        clean
          ? "border-[#1f7a4d] bg-[#0d2e20] text-[#4ade80]"
          : "border-[#9b2335] bg-[#3a0f17] text-[#ff6b7f] motion-safe:animate-pulse"
      }`}
    >
      <Icon className={size === "sm" ? "w-3 h-3" : "w-3.5 h-3.5"} aria-hidden="true" />
      {clean ? "Fair Play" : "Solo-Spiele entdeckt!"}
    </span>
  );
}

function WinrateBar({ winrate, wins, losses }) {
  const tone = winrateTone(winrate);
  return (
    <div>
      <div className="relative h-3 overflow-hidden rounded-sm border border-[#2a3a4a] bg-[#060e18]">
        <div
          className={`h-full bg-gradient-to-r ${tone.bar} transition-[width] duration-700`}
          style={{ width: `${winrate}%` }}
        />
        <div className="absolute inset-y-0 left-1/2 w-px bg-[#f0e6d2]/40" title="50 %" />
      </div>
      <div className="mt-1 flex justify-between text-[11px] font-semibold tabular-nums">
        <span className="text-[#0ac8b9]">{wins} S</span>
        <span className="text-[#5b6b7a]">50 %</span>
        <span className="text-[#e84057]">{losses} N</span>
      </div>
    </div>
  );
}

function Placement({ place }) {
  const styles = {
    1: "border-[#c8aa6e] bg-gradient-to-b from-[#f0e6d2] to-[#c8aa6e] text-[#1a1206]",
    2: "border-[#9fb3c8] bg-gradient-to-b from-[#e2e8f0] to-[#94a3b8] text-[#0f172a]",
    3: "border-[#a86b3c] bg-gradient-to-b from-[#e0a46e] to-[#8a5a3c] text-[#1a0d04]",
  };
  return (
    <div
      className={`flex h-10 w-10 shrink-0 rotate-45 items-center justify-center border-2 ${
        styles[place] || "border-[#3c4b5a] bg-[#111e2c] text-[#a09b8c]"
      }`}
    >
      <span className="-rotate-45 text-sm font-black tabular-nums" style={{ fontFamily: FONT_DISPLAY }}>
        {place}
      </span>
    </div>
  );
}

function SectionLabel({ icon: Icon, children }) {
  return (
    <div className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-[#c8aa6e]">
      <Icon className="w-3.5 h-3.5" aria-hidden="true" />
      {children}
    </div>
  );
}

function Notice({ tone = "info", children, onClose }) {
  const styles =
    tone === "error"
      ? "border-[#9b2335]/70 bg-[#3a0f17]/60 text-[#f0c4ca]"
      : "border-[#0397ab]/60 bg-[#0a1e2c] text-[#9fe2dc]";
  return (
    <div className={`flex items-start gap-3 rounded-md border px-4 py-3 text-sm ${styles}`} role="status">
      <AlertTriangle className="mt-0.5 w-4 h-4 shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1">{children}</div>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="text-xs font-bold uppercase tracking-wider opacity-70 hover:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0ac8b9]"
        >
          Schließen
        </button>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Header                                                             */
/* ------------------------------------------------------------------ */

function Header({ now, meta, refreshing, cooldownUntil, onRefresh }) {
  const startMs = meta?.challengeStart ? meta.challengeStart * 1000 : null;
  const endMs = meta?.challengeEnd ? meta.challengeEnd * 1000 : null;
  const cooldownSec = Math.round((meta?.cooldownMs || 300000) / 1000);

  const started = startMs !== null && now >= startMs;
  const ended = endMs !== null && now > endMs;
  let countdownLabel = "Läuft seit";
  let countdownMs = startMs !== null ? now - startMs : 0;
  if (startMs !== null && !started) {
    countdownLabel = "Startet in";
    countdownMs = startMs - now;
  } else if (endMs !== null && !ended) {
    countdownLabel = "Endet in";
    countdownMs = endMs - now;
  } else if (ended) {
    countdownLabel = "Challenge beendet";
    countdownMs = 0;
  }
  const cd = formatCountdown(countdownMs);
  const elapsed =
    startMs !== null && endMs !== null ? Math.min(100, Math.max(0, ((now - startMs) / (endMs - startMs)) * 100)) : null;

  const cooldownLeft = Math.max(0, Math.ceil((cooldownUntil - now) / 1000));
  const onCooldown = cooldownLeft > 0;
  const disabled = refreshing || onCooldown;

  return (
    <header className="relative overflow-hidden rounded-lg border border-[#785a28] bg-gradient-to-br from-[#0f1d2e] via-[#0a1428] to-[#050b14] p-5 sm:p-7">
      <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-[#0ac8b9]/10 blur-3xl" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#c8aa6e] to-transparent" />

      <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <div className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-[#0ac8b9]">
            <Swords className="w-4 h-4" aria-hidden="true" />
            Ranked Solo/Duo · EUW · Freundeskreis
          </div>
          <h1
            className="text-3xl font-bold leading-tight text-[#f0e6d2] sm:text-4xl"
            style={{ fontFamily: FONT_DISPLAY, textWrap: "balance" }}
          >
            {CHALLENGE_TITLE} <span className="text-[#c8aa6e]">{CHALLENGE_SUBTITLE}</span>
          </h1>
          <p className="mt-2 max-w-xl text-sm text-[#a09b8c]">
            Ranked wird nur zusammen gequeued. Jedes Solo-Spiel ohne Partner wird erkannt und mit Match-ID festgehalten.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-[#a09b8c]">
            {startMs !== null && (
              <span className="inline-flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-[#c8aa6e]" aria-hidden="true" />
                Start {formatDate(startMs)}
              </span>
            )}
            {endMs !== null && (
              <span className="inline-flex items-center gap-1.5">
                <Trophy className="w-3.5 h-3.5 text-[#c8aa6e]" aria-hidden="true" />
                Ende {formatDate(endMs)}
              </span>
            )}
            <span className="inline-flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-[#c8aa6e]" aria-hidden="true" />
              {meta?.lastUpdated ? `Zuletzt aktualisiert ${formatDate(meta.lastUpdated, true)} Uhr` : "Noch nie aktualisiert"}
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-end lg:flex-col lg:items-end">
          {startMs !== null && (
            <div className="rounded-md border border-[#1e3a4c] bg-[#050b14]/80 px-4 py-3">
              <div className="mb-1 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-[#5b6b7a]">
                <Hourglass className="w-3 h-3" aria-hidden="true" />
                {countdownLabel}
              </div>
              <div className="flex items-baseline gap-1 tabular-nums text-[#f0e6d2]" style={{ fontFamily: FONT_DISPLAY }}>
                <span className="text-2xl font-bold">{cd.d}</span>
                <span className="text-xs text-[#a09b8c]">T</span>
                <span className="ml-2 text-2xl font-bold">
                  {cd.h}:{cd.m}:{cd.s}
                </span>
              </div>
              {elapsed !== null && (
                <div className="mt-2 h-1 overflow-hidden rounded-full bg-[#1e2d3d]">
                  <div className="h-full bg-gradient-to-r from-[#0397ab] to-[#0ac8b9]" style={{ width: `${elapsed}%` }} />
                </div>
              )}
            </div>
          )}

          <div className="w-full sm:w-56">
            <button
              type="button"
              onClick={onRefresh}
              disabled={disabled}
              className={`group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-sm border-2 px-5 py-3 text-sm font-bold uppercase tracking-[0.12em] transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0ac8b9] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a1428] ${
                disabled
                  ? "cursor-not-allowed border-[#3c4b5a] bg-[#111e2c] text-[#5b6b7a]"
                  : "border-[#c8aa6e] bg-gradient-to-b from-[#1e2d3d] to-[#0a1428] text-[#f0e6d2] hover:border-[#f0e6d2] hover:shadow-[0_0_18px_rgba(10,200,185,0.35)]"
              }`}
            >
              {onCooldown && !refreshing && (
                <span
                  className="absolute inset-y-0 left-0 bg-[#0ac8b9]/10"
                  style={{ width: `${Math.min(100, (cooldownLeft / cooldownSec) * 100)}%` }}
                />
              )}
              <RefreshCw
                className={`relative w-4 h-4 ${refreshing ? "motion-safe:animate-spin" : ""}`}
                aria-hidden="true"
              />
              <span className="relative tabular-nums">
                {refreshing ? "Lade Stats…" : onCooldown ? `Cooldown ${formatSeconds(cooldownLeft)}` : "Stats aktualisieren"}
              </span>
            </button>
            <p className="mt-1.5 text-center text-[10px] text-[#5b6b7a]">
              {refreshing
                ? "Der erste Abruf kann einige Minuten dauern"
                : `Riot-API-Limit: 1 Abruf alle ${Math.round(cooldownSec / 60)} Minuten`}
            </p>
          </div>
        </div>
      </div>
    </header>
  );
}

/* ------------------------------------------------------------------ */
/*  Übersicht & Leaderboard                                            */
/* ------------------------------------------------------------------ */

function SummaryStrip({ rows }) {
  const totalGames = rows.reduce((s, r) => s + r.stats.games, 0);
  const best = rows.filter((r) => r.stats.games > 0).sort((a, b) => b.stats.winrate - a.stats.winrate)[0];
  const violations = rows.filter((r) => r.stats.soloOffenders.length > 0).length;
  const items = [
    { label: "Duos im Rennen", value: rows.length, Icon: Users, tone: "text-[#f0e6d2]" },
    { label: "Duo-Spiele gesamt", value: totalGames, Icon: Gamepad2, tone: "text-[#f0e6d2]" },
    {
      label: "Beste Duo-Winrate",
      value: best ? `${best.stats.winrate.toFixed(1)} %` : "–",
      sub: best ? best.name : "Noch keine Duo-Spiele",
      Icon: TrendingUp,
      tone: "text-[#0ac8b9]",
    },
    {
      label: "Regelverstöße",
      value: violations,
      sub: violations ? "Duos mit Solo-Games" : "Alle sauber",
      Icon: ShieldAlert,
      tone: violations ? "text-[#ff6b7f]" : "text-[#4ade80]",
    },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {items.map(({ label, value, sub, Icon, tone }) => (
        <div key={label} className="rounded-md border border-[#1e2d3d] bg-[#0b1624] px-4 py-3">
          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-[#5b6b7a]">
            <Icon className="w-3.5 h-3.5" aria-hidden="true" />
            {label}
          </div>
          <div className={`mt-1 text-2xl font-bold tabular-nums ${tone}`} style={{ fontFamily: FONT_DISPLAY }}>
            {value}
          </div>
          {sub && <div className="truncate text-xs text-[#a09b8c]">{sub}</div>}
        </div>
      ))}
    </div>
  );
}

function Leaderboard({ rows, sortKey, onSelect }) {
  return (
    <section className="rounded-lg border border-[#1e2d3d] bg-[#0b1624]">
      <div className="flex items-center justify-between gap-3 border-b border-[#1e2d3d] px-4 py-3">
        <h2 className="flex items-center gap-2 text-lg font-bold text-[#f0e6d2]" style={{ fontFamily: FONT_DISPLAY }}>
          <Trophy className="w-5 h-5 text-[#c8aa6e]" aria-hidden="true" />
          Leaderboard
        </h2>
        <span className="text-xs text-[#5b6b7a]">Platzierung nach {SORTS[sortKey].label}</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="text-left text-[10px] font-bold uppercase tracking-[0.14em] text-[#5b6b7a]">
              <th className="px-4 py-2 w-12">#</th>
              <th className="px-2 py-2">Duo</th>
              <th className="px-2 py-2">Ø Rang</th>
              <th className="px-2 py-2 text-right">Duo-WR</th>
              <th className="px-2 py-2 text-right">Spiele</th>
              <th className="px-2 py-2 text-right">S / N</th>
              <th className="px-2 py-2 text-right">Solo-Games</th>
              <th className="px-4 py-2 text-right">Regel-Check</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const tone = winrateTone(r.stats.winrate);
              const soloTotal = r.players.reduce((s, p) => s + p.soloGames, 0);
              return (
                <tr
                  key={r.id}
                  onClick={() => onSelect(r.id)}
                  className="cursor-pointer border-t border-[#13202e] transition hover:bg-[#0f1f30]"
                >
                  <td className="px-4 py-2.5">
                    <span
                      className={`font-black tabular-nums ${r.place === 1 ? "text-[#c8aa6e]" : "text-[#a09b8c]"}`}
                      style={{ fontFamily: FONT_DISPLAY }}
                    >
                      {r.place}
                    </span>
                  </td>
                  <td className="px-2 py-2.5">
                    <div className="flex items-center gap-1.5 font-semibold text-[#f0e6d2]">
                      {r.name}
                      {r.error && (
                        <AlertTriangle className="w-3.5 h-3.5 text-[#e84057]" aria-label="Fehler beim letzten Abruf" />
                      )}
                    </div>
                    <div className="text-xs text-[#5b6b7a]">
                      {r.players.length === 2 ? `${r.players[0].gameName} & ${r.players[1].gameName}` : "Keine Daten"}
                    </div>
                  </td>
                  <td className="px-2 py-2.5">
                    <TierChip rank={r.stats.avgRank} />
                  </td>
                  <td className={`px-2 py-2.5 text-right font-bold tabular-nums ${tone.text}`}>
                    {r.stats.games ? `${r.stats.winrate.toFixed(1)} %` : "–"}
                  </td>
                  <td className="px-2 py-2.5 text-right tabular-nums text-[#f0e6d2]">{r.stats.games}</td>
                  <td className="px-2 py-2.5 text-right tabular-nums">
                    <span className="text-[#0ac8b9]">{r.stats.wins}</span>
                    <span className="text-[#5b6b7a]"> / </span>
                    <span className="text-[#e84057]">{r.stats.losses}</span>
                  </td>
                  <td
                    className={`px-2 py-2.5 text-right font-semibold tabular-nums ${
                      soloTotal ? "text-[#ff6b7f]" : "text-[#5b6b7a]"
                    }`}
                  >
                    {soloTotal}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {r.complete ? (
                      <RuleBadge offenders={r.stats.soloOffenders} size="sm" />
                    ) : (
                      <span className="text-[11px] font-bold uppercase tracking-wider text-[#5b6b7a]">Keine Daten</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  Filter- & Sortierleiste                                            */
/* ------------------------------------------------------------------ */

function FilterBar({ sortKey, setSortKey, sortDir, setSortDir, status, setStatus, query, setQuery }) {
  const chip = (active) =>
    `inline-flex items-center gap-1.5 rounded-sm border px-3 py-1.5 text-xs font-bold uppercase tracking-wider transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0ac8b9] ${
      active
        ? "border-[#c8aa6e] bg-[#c8aa6e]/15 text-[#f0e6d2]"
        : "border-[#1e2d3d] bg-[#0b1624] text-[#a09b8c] hover:border-[#785a28] hover:text-[#f0e6d2]"
    }`;
  const DirIcon = sortDir === "desc" ? ArrowDown : ArrowUp;

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-[#1e2d3d] bg-[#08121e] p-3 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-1 text-[10px] font-bold uppercase tracking-[0.16em] text-[#5b6b7a]">Sortieren</span>
        {Object.entries(SORTS).map(([key, { label, Icon }]) => (
          <button key={key} type="button" className={chip(sortKey === key)} onClick={() => setSortKey(key)}>
            <Icon className="w-3.5 h-3.5" aria-hidden="true" />
            {label}
          </button>
        ))}
        <button
          type="button"
          className={chip(false)}
          onClick={() => setSortDir(sortDir === "desc" ? "asc" : "desc")}
          aria-label={sortDir === "desc" ? "Absteigend sortiert, umschalten" : "Aufsteigend sortiert, umschalten"}
        >
          <DirIcon className="w-3.5 h-3.5" aria-hidden="true" />
          {sortDir === "desc" ? "Absteigend" : "Aufsteigend"}
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {[
          ["all", "Alle"],
          ["fair", "Fair Play"],
          ["solo", "Regelverstöße"],
        ].map(([key, label]) => (
          <button key={key} type="button" className={chip(status === key)} onClick={() => setStatus(key)}>
            {label}
          </button>
        ))}
        <label className="relative flex-1 min-w-[180px]">
          <span className="sr-only">Duo oder Spieler suchen</span>
          <Search className="pointer-events-none absolute left-2.5 top-1/2 w-3.5 h-3.5 -translate-y-1/2 text-[#5b6b7a]" />
          <input
            id="duo-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Duo oder Riot ID suchen"
            className="w-full rounded-sm border border-[#1e2d3d] bg-[#050b14] py-1.5 pl-8 pr-3 text-sm text-[#f0e6d2] placeholder:text-[#5b6b7a] focus:border-[#0ac8b9] focus:outline-none"
          />
        </label>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Duo-Karte                                                          */
/* ------------------------------------------------------------------ */

function PlayerPanel({ player, align = "left" }) {
  const games = player.wins + player.losses;
  const wr = pct(player.wins, games);
  const tone = winrateTone(wr);
  const right = align === "right";
  return (
    <div className={`flex min-w-0 flex-1 items-center gap-3 ${right ? "sm:flex-row-reverse sm:text-right" : ""}`}>
      <div className="relative shrink-0">
        <ProfileIcon player={player} />
        {player.soloGames > 0 && (
          <span
            className="absolute -bottom-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full border border-[#0a1428] bg-[#e84057] px-1 text-[10px] font-black text-white"
            title={`${player.soloGames} Solo-Spiele`}
          >
            {player.soloGames}
          </span>
        )}
      </div>
      <div className="min-w-0">
        <div className="truncate font-semibold text-[#f0e6d2]">
          {player.gameName}
          <span className="font-normal text-[#5b6b7a]">#{player.tagLine}</span>
        </div>
        <div className={`mt-1 flex ${right ? "sm:justify-end" : ""}`}>
          <TierChip rank={player.rank} />
        </div>
        <div className="mt-1 text-xs tabular-nums text-[#a09b8c]">
          {games ? (
            <>
              <span className={`font-bold ${tone.text}`}>{wr.toFixed(1)} % WR</span> · {player.wins} S {player.losses} N
            </>
          ) : (
            "Keine Ranked-Spiele in dieser Season"
          )}
        </div>
      </div>
    </div>
  );
}

function ComboHint({ combo }) {
  if (combo.qualified) return null;
  return (
    <div className="mt-1 text-[11px] text-[#5b6b7a]">
      Noch keine Combo mit {MIN_GAMES_FOR_COMBO}+ Spielen, gewertet nach Siegen
    </div>
  );
}

function MatchRow({ game, players }) {
  const resultLabel = game.remake ? "Remake" : game.win ? "Sieg" : "Niederlage";
  const resultColor = game.remake ? "text-[#a09b8c]" : game.win ? "text-[#0ac8b9]" : "text-[#e84057]";
  const borderColor = game.remake ? "border-[#3c4b5a]" : game.win ? "border-[#0ac8b9]" : "border-[#e84057]";
  return (
    <li
      className={`grid grid-cols-[auto_1fr] items-center gap-3 rounded-md border-l-4 bg-[#08121e] p-2.5 sm:grid-cols-[auto_1fr_auto] ${borderColor}`}
    >
      <div className="w-[5.5rem]">
        <div className={`text-xs font-black uppercase tracking-wider ${resultColor}`}>{resultLabel}</div>
        <div className="text-[11px] tabular-nums text-[#5b6b7a]">{formatDuration(game.durationSec)}</div>
      </div>

      <div className="grid min-w-0 gap-2 sm:grid-cols-2">
        {game.players.map((p, i) => {
          const kda = ((p.kills + p.assists) / Math.max(1, p.deaths)).toFixed(2);
          return (
            <div key={i} className="flex min-w-0 items-center gap-2">
              <ChampIcon id={p.champ} size="w-9 h-9" />
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 truncate text-xs text-[#a09b8c]">
                  <span className="truncate">{players[i]?.gameName}</span>
                  <RoleTag role={p.role} />
                </div>
                <div className="text-sm tabular-nums text-[#f0e6d2]">
                  {p.kills}/<span className="text-[#e84057]">{p.deaths}</span>/{p.assists}
                  <span className="ml-1.5 text-[11px] text-[#5b6b7a]">
                    {kda} KDA · {p.cs} CS
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="col-span-2 flex items-center justify-between gap-3 text-right sm:col-span-1 sm:block">
        <div className="text-[11px] tabular-nums text-[#a09b8c]">{formatDate(game.date, true)}</div>
        <a
          href={matchUrl(game.id)}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-[11px] text-[#0ac8b9] hover:underline"
        >
          Match ansehen
          <ExternalLink className="w-3 h-3" aria-hidden="true" />
        </a>
      </div>
    </li>
  );
}

function SoloEvidence({ player }) {
  const shown = player.soloMatches.slice(0, 3);
  return (
    <li>
      <span className="font-semibold">{player.gameName}</span> hat {player.soloGames}{" "}
      {player.soloGames === 1 ? "Spiel" : "Spiele"} ohne Partner gespielt
      {player.lastSolo && <span className="text-[#a09b8c]"> · zuletzt {formatDate(player.lastSolo, true)} Uhr</span>}
      <div className="mt-1 flex flex-wrap gap-1.5">
        {shown.map((m) => (
          <a
            key={m.matchId}
            href={matchUrl(m.matchId)}
            target="_blank"
            rel="noreferrer"
            title={`${m.reason} · ${m.championName} · ${formatDate(m.date, true)}`}
            className="inline-flex items-center gap-1 rounded border border-[#9b2335]/60 bg-[#2a0b11] px-1.5 py-0.5 font-mono text-[10px] text-[#ff9aa8] hover:border-[#ff6b7f]"
          >
            {m.matchId}
            <ExternalLink className="w-2.5 h-2.5" aria-hidden="true" />
          </a>
        ))}
        {player.soloMatches.length > shown.length && (
          <span className="text-[10px] text-[#a09b8c]">+{player.soloMatches.length - shown.length} weitere</span>
        )}
      </div>
    </li>
  );
}

function DuoCard({ duo, stats, place, expanded, onToggle }) {
  const championName = useChampionName();
  const tone = winrateTone(stats.winrate);
  const champ = stats.bestChampCombo;
  const role = stats.bestRoleCombo;
  const clean = stats.soloOffenders.length === 0;
  const recent = duo.games.slice(0, 5);

  return (
    <article
      id={`duo-${duo.id}`}
      className={`scroll-mt-4 rounded-lg border bg-gradient-to-b from-[#0d1a29] to-[#08111c] transition ${
        place === 1 && duo.complete ? "border-[#c8aa6e] shadow-[0_0_30px_rgba(200,170,110,0.12)]" : "border-[#1e2d3d]"
      }`}
    >
      <div className="flex flex-wrap items-center gap-4 border-b border-[#1e2d3d] px-5 py-4">
        <Placement place={place} />
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-xl font-bold text-[#f0e6d2]" style={{ fontFamily: FONT_DISPLAY }}>
            {duo.name}
          </h3>
          {duo.motto && <p className="truncate text-xs italic text-[#5b6b7a]">„{duo.motto}“</p>}
        </div>
        {duo.complete && <RuleBadge offenders={stats.soloOffenders} />}
      </div>

      <div className="flex flex-col gap-5 p-5">
        {duo.error && (
          <Notice tone="error">
            Letzter Abruf fehlgeschlagen: {duo.error}
            {duo.complete && <span className="text-[#a09b8c]"> · Angezeigt wird der vorherige Stand.</span>}
          </Notice>
        )}

        {duo.complete && (
          <>
            <div className="flex flex-col items-stretch gap-4 sm:flex-row sm:items-center">
              <PlayerPanel player={duo.players[0]} />
              <div className="flex shrink-0 items-center justify-center">
                <div className="flex h-9 w-9 items-center justify-center rounded-full border border-[#0ac8b9]/50 bg-[#0a1e2c] text-[#0ac8b9]">
                  <Link2 className="w-4 h-4" aria-hidden="true" />
                </div>
              </div>
              <PlayerPanel player={duo.players[1]} align="right" />
            </div>

            <div className="rounded-md border border-[#1e2d3d] bg-[#060e18] p-4">
              <SectionLabel icon={Users}>Gemeinsame Duo-Bilanz</SectionLabel>
              <div className="mb-3 grid grid-cols-4 gap-2 text-center">
                {[
                  ["Spiele", stats.games, "text-[#f0e6d2]"],
                  ["Siege", stats.wins, "text-[#0ac8b9]"],
                  ["Niederl.", stats.losses, "text-[#e84057]"],
                  ["Winrate", stats.games ? `${stats.winrate.toFixed(1)}%` : "–", tone.text],
                ].map(([label, value, cls]) => (
                  <div key={label}>
                    <div className={`text-xl font-bold tabular-nums ${cls}`} style={{ fontFamily: FONT_DISPLAY }}>
                      {value}
                    </div>
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-[#5b6b7a]">{label}</div>
                  </div>
                ))}
              </div>
              <WinrateBar winrate={stats.winrate} wins={stats.wins} losses={stats.losses} />
              {stats.remakes > 0 && (
                <div className="mt-2 text-[11px] text-[#5b6b7a]">
                  {stats.remakes} {stats.remakes === 1 ? "Remake" : "Remakes"} nicht gewertet
                </div>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-md border border-[#1e2d3d] bg-[#060e18] p-4">
                <SectionLabel icon={Sparkles}>Beste Champion-Combo</SectionLabel>
                {champ ? (
                  <>
                    <div className="flex items-center gap-3">
                      <div className="flex -space-x-2">
                        <ChampIcon id={champ.champs[0]} size="w-12 h-12" />
                        <ChampIcon id={champ.champs[1]} size="w-12 h-12" />
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-[#f0e6d2]">
                          {championName(champ.champs[0])} + {championName(champ.champs[1])}
                        </div>
                        <div className="text-xs tabular-nums text-[#a09b8c]">
                          <span className={`font-bold ${winrateTone(champ.winrate).text}`}>
                            {champ.winrate.toFixed(0)} % WR
                          </span>{" "}
                          · {champ.games} {champ.games === 1 ? "Spiel" : "Spiele"}
                        </div>
                      </div>
                    </div>
                    <ComboHint combo={champ} />
                  </>
                ) : (
                  <p className="text-sm text-[#5b6b7a]">Noch keine gemeinsamen Spiele</p>
                )}
              </div>

              <div className="rounded-md border border-[#1e2d3d] bg-[#060e18] p-4">
                <SectionLabel icon={Crosshair}>Beste Rollen-Combo</SectionLabel>
                {role ? (
                  <>
                    <div className="flex items-center gap-3">
                      <div className="flex gap-1.5">
                        {role.roles.map((r, i) => {
                          const { Icon } = ROLES[r];
                          return (
                            <div
                              key={i}
                              className="flex h-12 w-12 items-center justify-center rounded-md border border-[#0397ab]/60 bg-[#0a1e2c] text-[#0ac8b9]"
                            >
                              <Icon className="w-6 h-6" aria-hidden="true" />
                            </div>
                          );
                        })}
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-[#f0e6d2]">
                          {ROLES[role.roles[0]].label} + {ROLES[role.roles[1]].label}
                        </div>
                        <div className="text-xs tabular-nums text-[#a09b8c]">
                          <span className={`font-bold ${winrateTone(role.winrate).text}`}>
                            {role.winrate.toFixed(0)} % WR
                          </span>{" "}
                          · {role.games} {role.games === 1 ? "Spiel" : "Spiele"}
                        </div>
                      </div>
                    </div>
                    <ComboHint combo={role} />
                  </>
                ) : (
                  <p className="text-sm text-[#5b6b7a]">Noch keine gemeinsamen Spiele</p>
                )}
              </div>
            </div>

            <div
              className={`flex items-start gap-3 rounded-md border p-3 text-sm ${
                clean ? "border-[#1f7a4d]/50 bg-[#0d2e20]/40" : "border-[#9b2335]/70 bg-[#3a0f17]/50"
              }`}
            >
              {clean ? (
                <ShieldCheck className="mt-0.5 w-5 h-5 shrink-0 text-[#4ade80]" aria-hidden="true" />
              ) : (
                <ShieldAlert className="mt-0.5 w-5 h-5 shrink-0 text-[#ff6b7f]" aria-hidden="true" />
              )}
              <div className="min-w-0">
                <div className={`font-bold ${clean ? "text-[#4ade80]" : "text-[#ff6b7f]"}`}>Fremdgeh-Detektor</div>
                {clean ? (
                  <p className="text-[#a09b8c]">Seit Challenge-Start keine Solo/Duo-Spiele ohne Partner. Vorbildlich.</p>
                ) : (
                  <ul className="flex flex-col gap-2 text-[#f0c4ca]">
                    {stats.soloOffenders.map((p) => (
                      <SoloEvidence key={p.gameName} player={p} />
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <div>
              <button
                type="button"
                onClick={onToggle}
                aria-expanded={expanded}
                disabled={recent.length === 0}
                className="flex w-full items-center justify-between rounded-sm border border-[#1e2d3d] bg-[#0b1624] px-4 py-2.5 text-xs font-bold uppercase tracking-[0.14em] text-[#c8aa6e] transition hover:border-[#785a28] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0ac8b9] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span className="flex items-center gap-2">
                  <Timer className="w-4 h-4" aria-hidden="true" />
                  {recent.length ? "Letzte 5 gemeinsame Spiele" : "Noch keine gemeinsamen Spiele"}
                </span>
                <span className="flex items-center gap-2">
                  <span className="flex gap-1" aria-hidden="true">
                    {recent.map((g) => (
                      <span
                        key={g.id}
                        className={`h-2 w-2 rounded-full ${
                          g.remake ? "bg-[#5b6b7a]" : g.win ? "bg-[#0ac8b9]" : "bg-[#e84057]"
                        }`}
                      />
                    ))}
                  </span>
                  <ChevronDown className={`w-4 h-4 transition-transform ${expanded ? "rotate-180" : ""}`} />
                </span>
              </button>
              {expanded && recent.length > 0 && (
                <ul className="mt-2 flex flex-col gap-2">
                  {recent.map((g) => (
                    <MatchRow key={g.id} game={g} players={duo.players} />
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </div>
    </article>
  );
}

/* ------------------------------------------------------------------ */
/*  Lade- & Leerzustände                                               */
/* ------------------------------------------------------------------ */

function StatePanel({ icon: Icon, title, children, spin = false }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-[#1e2d3d] px-6 py-14 text-center">
      <Icon className={`w-8 h-8 text-[#c8aa6e] ${spin ? "motion-safe:animate-spin" : ""}`} aria-hidden="true" />
      <h2 className="text-lg font-bold text-[#f0e6d2]" style={{ fontFamily: FONT_DISPLAY }}>
        {title}
      </h2>
      <div className="max-w-md text-sm text-[#a09b8c]">{children}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Hauptkomponente                                                    */
/* ------------------------------------------------------------------ */

export default function DuoChallengeDashboard() {
  const now = useNow();
  const dataDragon = useDataDragonInfo();
  const [duos, setDuos] = useState([]);
  const [meta, setMeta] = useState(null);
  const [loadState, setLoadState] = useState("loading");
  const [notice, setNotice] = useState(null);
  const [sortKey, setSortKey] = useState("rank");
  const [sortDir, setSortDir] = useState("desc");
  const [status, setStatus] = useState("all");
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState(() => new Set());
  const [requesting, setRequesting] = useState(false);

  const loadDuos = useCallback(async () => {
    try {
      const { ok, status: httpStatus, body } = await apiRequest("/api/duos");
      if (!ok || !body) throw new Error(`Server antwortet mit Status ${httpStatus}`);
      setDuos(body.duos.map(normalizeDuo));
      setMeta(body.meta);
      setLoadState("ready");
      return body.meta;
    } catch (err) {
      setLoadState((prev) => (prev === "ready" ? prev : "error"));
      setNotice({ tone: "error", text: `Backend nicht erreichbar: ${err.message}` });
      return null;
    }
  }, []);

  useEffect(() => {
    loadDuos();
  }, [loadDuos]);

  // Während der Server aktualisiert, regelmäßig den neuen Stand abholen
  const refreshing = Boolean(meta?.refreshing) || requesting;
  useEffect(() => {
    if (!meta?.refreshing) return undefined;
    const id = setInterval(async () => {
      const nextMeta = await loadDuos();
      if (nextMeta && !nextMeta.refreshing) {
        if (nextMeta.errors?.length) {
          setNotice({
            tone: "error",
            text: `Aktualisiert, aber ${nextMeta.errors.length} ${
              nextMeta.errors.length === 1 ? "Duo konnte" : "Duos konnten"
            } nicht geladen werden.`,
          });
        } else {
          setNotice({ tone: "info", text: "Stats aktualisiert." });
        }
      }
    }, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [meta?.refreshing, loadDuos]);

  const cooldownUntil = meta?.nextRefreshAllowedAt ? Date.parse(meta.nextRefreshAllowedAt) : 0;

  const handleRefresh = async () => {
    if (refreshing || Date.now() < cooldownUntil) return;
    setRequesting(true);
    setNotice(null);
    try {
      const { status: httpStatus, body } = await apiRequest("/api/refresh", { method: "POST" });
      if (body?.meta) setMeta(body.meta);
      if (httpStatus === 202) {
        setNotice({ tone: "info", text: "Aktualisierung läuft. Neue Daten erscheinen automatisch." });
      } else if (httpStatus === 409) {
        setNotice({ tone: "info", text: "Es läuft bereits eine Aktualisierung." });
      } else if (httpStatus === 429) {
        setNotice({ tone: "info", text: body?.error || "Cooldown aktiv." });
      } else if (httpStatus === 401) {
        setNotice({ tone: "error", text: "Der Refresh ist auf dem Server mit einem Token geschützt." });
      } else {
        setNotice({ tone: "error", text: body?.error || `Aktualisierung fehlgeschlagen (Status ${httpStatus}).` });
      }
    } catch (err) {
      setNotice({ tone: "error", text: `Backend nicht erreichbar: ${err.message}` });
    } finally {
      setRequesting(false);
    }
  };

  // Platzierung immer nach "bester zuerst", unabhängig von Filter und Richtung
  const ranked = useMemo(() => {
    const value = SORTS[sortKey].value;
    return [...duos]
      .sort((a, b) => value(b.stats) - value(a.stats) || b.stats.winrate - a.stats.winrate)
      .map((d, i) => ({ ...d, place: i + 1 }));
  }, [duos, sortKey]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = ranked.filter((d) => {
      const offenders = d.stats.soloOffenders.length;
      if (status === "fair" && (offenders || !d.complete)) return false;
      if (status === "solo" && !offenders) return false;
      if (!q) return true;
      return [d.name, ...d.players.map((p) => `${p.gameName}#${p.tagLine}`)].some((s) => s.toLowerCase().includes(q));
    });
    return sortDir === "desc" ? list : [...list].reverse();
  }, [ranked, status, query, sortDir]);

  const toggle = (id) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const focusDuo = (id) => {
    setExpanded((prev) => new Set(prev).add(id));
    setStatus("all");
    setQuery("");
    requestAnimationFrame(() =>
      document.getElementById(`duo-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" })
    );
  };

  let content;
  if (loadState === "loading") {
    content = (
      <StatePanel icon={Loader2} title="Lade Duo-Daten" spin>
        Verbinde mit dem Server…
      </StatePanel>
    );
  } else if (loadState === "error") {
    content = (
      <StatePanel icon={AlertTriangle} title="Server nicht erreichbar">
        Das Backend antwortet nicht. Läuft <code className="text-[#f0e6d2]">npm run dev</code> bzw. ist der Server online?
        <div className="mt-4">
          <button
            type="button"
            onClick={() => {
              setLoadState("loading");
              loadDuos();
            }}
            className="rounded-sm border border-[#c8aa6e] px-4 py-2 text-xs font-bold uppercase tracking-wider text-[#f0e6d2] hover:border-[#f0e6d2] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0ac8b9]"
          >
            Erneut versuchen
          </button>
        </div>
      </StatePanel>
    );
  } else if (duos.length === 0) {
    content = meta?.refreshing ? (
      <StatePanel icon={Loader2} title="Erster Abruf läuft" spin>
        Der Server lädt gerade alle Ranked-Spiele seit Challenge-Start von der Riot API. Je nach Anzahl der Matches
        dauert das ein paar Minuten. Die Seite aktualisiert sich von selbst.
      </StatePanel>
    ) : (
      <StatePanel icon={Gamepad2} title="Noch keine Daten">
        Klicke oben auf „Stats aktualisieren“, um die Daten zum ersten Mal von der Riot API zu laden.
      </StatePanel>
    );
  } else {
    content = (
      <>
        <SummaryStrip rows={ranked} />
        <Leaderboard rows={ranked} sortKey={sortKey} onSelect={focusDuo} />
        <FilterBar
          sortKey={sortKey}
          setSortKey={setSortKey}
          sortDir={sortDir}
          setSortDir={setSortDir}
          status={status}
          setStatus={setStatus}
          query={query}
          setQuery={setQuery}
        />
        {visible.length ? (
          <div className="grid gap-5 lg:grid-cols-2 lg:items-start">
            {visible.map((d) => (
              <DuoCard
                key={d.id}
                duo={d}
                stats={d.stats}
                place={d.place}
                expanded={expanded.has(d.id)}
                onToggle={() => toggle(d.id)}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-[#1e2d3d] p-10 text-center text-sm text-[#5b6b7a]">
            Kein Duo passt zu diesem Filter. Setze den Status auf „Alle“ oder leere die Suche.
          </div>
        )}
      </>
    );
  }

  return (
    <DataDragonContext.Provider value={dataDragon}>
      <div
        className="min-h-screen bg-[#050b14] text-[#cdbe91]"
        style={{
          fontFamily: FONT_BODY,
          colorScheme: "dark",
          backgroundImage:
            "radial-gradient(ellipse at top, rgba(10,200,185,0.06), transparent 55%), radial-gradient(ellipse at bottom right, rgba(200,170,110,0.05), transparent 50%)",
        }}
      >
        <div className="mx-auto flex max-w-6xl flex-col gap-5 px-4 py-6 sm:px-6 sm:py-8">
          <Header
            now={now}
            meta={meta}
            refreshing={refreshing}
            cooldownUntil={cooldownUntil}
            onRefresh={handleRefresh}
          />

          {notice && (
            <Notice tone={notice.tone} onClose={() => setNotice(null)}>
              {notice.text}
            </Notice>
          )}

          {content}

          <footer className="flex flex-col gap-1 pb-4 pt-2 text-center text-[11px] text-[#5b6b7a]">
            <span>
              Daten: Riot Games API · Bilder: Data Dragon {dataDragon.version} · Combos ab {MIN_GAMES_FOR_COMBO} Spielen
              gewertet
            </span>
            <span>
              Diese Seite ist kein offizielles Produkt von Riot Games und wird von Riot Games weder unterstützt noch
              befürwortet. League of Legends ist eine Marke von Riot Games, Inc.
            </span>
          </footer>
        </div>
      </div>
    </DataDragonContext.Provider>
  );
}
