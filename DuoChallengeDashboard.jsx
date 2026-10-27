import React, { useState, useMemo, useEffect } from "react";
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
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Konfiguration                                                      */
/* ------------------------------------------------------------------ */

const DDRAGON = "https://ddragon.leagueoflegends.com/cdn/14.20.1/img";
const CHALLENGE_START = new Date("2026-10-01T00:00:00+02:00");
const CHALLENGE_END = new Date("2026-11-30T23:59:59+01:00");
// Referenzzeitpunkt für die Mock-Spiele
const MOCK_NOW = new Date("2026-10-27T18:00:00+01:00");
const REFRESH_COOLDOWN_SEC = 90;
const MIN_GAMES_FOR_COMBO = 3;

const FONT_DISPLAY = "'Cinzel', 'Trajan Pro', Georgia, serif";
const FONT_BODY = "'Barlow', 'Segoe UI', system-ui, sans-serif";

const CHAMPS = {
  LeeSin: "Lee Sin",
  Ahri: "Ahri",
  Viego: "Viego",
  Sylas: "Sylas",
  Khazix: "Kha'Zix",
  Orianna: "Orianna",
  Graves: "Graves",
  Jayce: "Jayce",
  Jinx: "Jinx",
  Thresh: "Thresh",
  Kaisa: "Kai'Sa",
  Nautilus: "Nautilus",
  Xayah: "Xayah",
  Rakan: "Rakan",
  Ezreal: "Ezreal",
  Karma: "Karma",
  Lillia: "Lillia",
  Garen: "Garen",
  Darius: "Darius",
  Taliyah: "Taliyah",
  MonkeyKing: "Wukong",
  Malphite: "Malphite",
  Caitlyn: "Caitlyn",
  Lux: "Lux",
  Yasuo: "Yasuo",
  Leona: "Leona",
  Syndra: "Syndra",
  Vi: "Vi",
};

const ROLES = {
  TOP: { label: "Top", Icon: Shield },
  JUNGLE: { label: "Jungle", Icon: Leaf },
  MID: { label: "Mid", Icon: Zap },
  ADC: { label: "ADC", Icon: Crosshair },
  SUPPORT: { label: "Support", Icon: Heart },
};

const TIERS = ["IRON", "BRONZE", "SILVER", "GOLD", "PLATINUM", "EMERALD", "DIAMOND", "MASTER", "GRANDMASTER", "CHALLENGER"];
const DIVISIONS = ["IV", "III", "II", "I"];
const APEX_TIERS = new Set(["MASTER", "GRANDMASTER", "CHALLENGER"]);

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
};

/* ------------------------------------------------------------------ */
/*  Mock-Daten                                                         */
/* ------------------------------------------------------------------ */

const DUO_CONFIG = [
  {
    id: "baron-bandits",
    name: "Baron Bandits",
    motto: "Wer zuerst smitet, zahlt nicht die Pizza.",
    seed: 5,
    gameCount: 34,
    players: [
      {
        gameName: "Kaiserschmarrn",
        tagLine: "EUW",
        profileIconId: 4568,
        rank: { tier: "EMERALD", division: "II", lp: 64 },
        wins: 112,
        losses: 98,
        soloGames: 0,
      },
      {
        gameName: "MidOrFeed",
        tagLine: "2407",
        profileIconId: 5367,
        rank: { tier: "DIAMOND", division: "IV", lp: 12 },
        wins: 141,
        losses: 127,
        soloGames: 0,
      },
    ],
    pool: [
      { champs: ["LeeSin", "Ahri"], roles: ["JUNGLE", "MID"], weight: 5, wr: 0.68 },
      { champs: ["Viego", "Sylas"], roles: ["JUNGLE", "MID"], weight: 4, wr: 0.55 },
      { champs: ["Khazix", "Orianna"], roles: ["JUNGLE", "MID"], weight: 2, wr: 0.45 },
      { champs: ["Jayce", "Graves"], roles: ["TOP", "JUNGLE"], weight: 2, wr: 0.4 },
    ],
  },
  {
    id: "botlane-buendnis",
    name: "Botlane-Bündnis",
    motto: "2v2 Bot oder gar nicht.",
    seed: 1,
    gameCount: 41,
    players: [
      {
        gameName: "Jinxed4Life",
        tagLine: "BOT",
        profileIconId: 6271,
        rank: { tier: "PLATINUM", division: "I", lp: 88 },
        wins: 87,
        losses: 81,
        soloGames: 3,
        lastSolo: "2026-10-24T23:41:00+02:00",
      },
      {
        gameName: "ThreshHold",
        tagLine: "hook",
        profileIconId: 4895,
        rank: { tier: "EMERALD", division: "IV", lp: 23 },
        wins: 95,
        losses: 84,
        soloGames: 0,
      },
    ],
    pool: [
      { champs: ["Jinx", "Thresh"], roles: ["ADC", "SUPPORT"], weight: 5, wr: 0.6 },
      { champs: ["Kaisa", "Nautilus"], roles: ["ADC", "SUPPORT"], weight: 4, wr: 0.57 },
      { champs: ["Xayah", "Rakan"], roles: ["ADC", "SUPPORT"], weight: 3, wr: 0.74 },
      { champs: ["Ezreal", "Karma"], roles: ["ADC", "SUPPORT"], weight: 2, wr: 0.38 },
      { champs: ["Yasuo", "Leona"], roles: ["MID", "SUPPORT"], weight: 1, wr: 0.5 },
    ],
  },
  {
    id: "dorfjungen",
    name: "Die Dorfjungen",
    motto: "Garen drückt E, wir drücken die Daumen.",
    seed: 9,
    gameCount: 27,
    players: [
      {
        gameName: "Grubenjunge",
        tagLine: "RUHR",
        profileIconId: 588,
        rank: { tier: "GOLD", division: "II", lp: 45 },
        wins: 64,
        losses: 69,
        soloGames: 0,
      },
      {
        gameName: "LilliaLiebhaber",
        tagLine: "EUW",
        profileIconId: 1386,
        rank: { tier: "GOLD", division: "I", lp: 71 },
        wins: 73,
        losses: 66,
        soloGames: 1,
        lastSolo: "2026-10-19T14:05:00+02:00",
      },
    ],
    pool: [
      { champs: ["Garen", "Lillia"], roles: ["TOP", "JUNGLE"], weight: 4, wr: 0.58 },
      { champs: ["Darius", "MonkeyKing"], roles: ["TOP", "JUNGLE"], weight: 3, wr: 0.48 },
      { champs: ["Malphite", "Taliyah"], roles: ["TOP", "MID"], weight: 2, wr: 0.66 },
      { champs: ["Caitlyn", "Lux"], roles: ["ADC", "SUPPORT"], weight: 2, wr: 0.35 },
    ],
  },
  {
    id: "tilt-resistent",
    name: "Tilt-Resistent",
    motto: "Mute all, Kopf hoch, weiter queuen.",
    seed: 17,
    gameCount: 22,
    players: [
      {
        gameName: "NoFlashNoProblem",
        tagLine: "EUW",
        profileIconId: 5212,
        rank: { tier: "DIAMOND", division: "II", lp: 51 },
        wins: 158,
        losses: 139,
        soloGames: 0,
      },
      {
        gameName: "KarmaKoma",
        tagLine: "1234",
        profileIconId: 29,
        rank: { tier: "DIAMOND", division: "III", lp: 77 },
        wins: 133,
        losses: 125,
        soloGames: 0,
      },
    ],
    pool: [
      { champs: ["Syndra", "Karma"], roles: ["MID", "SUPPORT"], weight: 3, wr: 0.62 },
      { champs: ["Vi", "Ahri"], roles: ["JUNGLE", "MID"], weight: 3, wr: 0.7 },
      { champs: ["Caitlyn", "Lux"], roles: ["ADC", "SUPPORT"], weight: 2, wr: 0.5 },
      { champs: ["Ezreal", "Karma"], roles: ["ADC", "SUPPORT"], weight: 2, wr: 0.42 },
    ],
  },
];

// Deterministischer Zufallsgenerator, damit die Mock-Daten stabil bleiben
function mulberry32(seed) {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function generateGames(seed, pool, count) {
  const rnd = mulberry32(seed);
  const totalWeight = pool.reduce((sum, c) => sum + c.weight, 0);
  const span = MOCK_NOW.getTime() - CHALLENGE_START.getTime();
  const int = (min, max) => Math.round(min + rnd() * (max - min));

  const playerLine = (role, win, minutes) => {
    const csPerMin = { TOP: 7.2, JUNGLE: 6.1, MID: 7.6, ADC: 8.1, SUPPORT: 1.2 }[role];
    const isSupport = role === "SUPPORT";
    return {
      role,
      kills: isSupport ? int(0, 4) : int(win ? 4 : 1, win ? 13 : 7),
      deaths: int(win ? 1 : 4, win ? 5 : 10),
      assists: isSupport ? int(win ? 12 : 5, win ? 24 : 14) : int(win ? 5 : 2, win ? 14 : 9),
      cs: Math.round(minutes * csPerMin * (0.85 + rnd() * 0.25)),
    };
  };

  const games = [];
  for (let i = 0; i < count; i++) {
    let roll = rnd() * totalWeight;
    let combo = pool[0];
    for (const c of pool) {
      roll -= c.weight;
      if (roll <= 0) {
        combo = c;
        break;
      }
    }
    const win = rnd() < combo.wr;
    const durationSec = int(21 * 60, 38 * 60);
    const minutes = durationSec / 60;
    games.push({
      id: `EUW1_${7040000 + seed * 1000 + i}`,
      date: new Date(CHALLENGE_START.getTime() + (span * (i + 0.2 + rnd() * 0.6)) / count),
      win,
      durationSec,
      lpChange: win ? int(17, 26) : -int(14, 22),
      players: [
        { champ: combo.champs[0], ...playerLine(combo.roles[0], win, minutes) },
        { champ: combo.champs[1], ...playerLine(combo.roles[1], win, minutes) },
      ],
    });
  }
  return games.sort((a, b) => b.date - a.date);
}

const INITIAL_DUOS = DUO_CONFIG.map((d) => ({
  ...d,
  games: generateGames(d.seed, d.pool, d.gameCount),
}));

/* ------------------------------------------------------------------ */
/*  Berechnungen                                                       */
/* ------------------------------------------------------------------ */

function rankScore({ tier, division, lp }) {
  if (APEX_TIERS.has(tier)) return 7 * 400 + lp;
  return TIERS.indexOf(tier) * 400 + DIVISIONS.indexOf(division) * 100 + lp;
}

function scoreToRank(score) {
  if (score >= 2800) return { tier: "MASTER", division: null, lp: Math.round(score - 2800) };
  const t = Math.floor(score / 400);
  const rest = score - t * 400;
  const d = Math.min(3, Math.floor(rest / 100));
  return { tier: TIERS[t], division: DIVISIONS[d], lp: Math.round(rest - d * 100) };
}

function formatRank(rank) {
  const label = TIER_STYLE[rank.tier].label;
  return rank.division ? `${label} ${rank.division}` : label;
}

const pct = (wins, games) => (games ? (wins / games) * 100 : 0);

function bestBy(games, keyFn, buildFn) {
  const groups = new Map();
  for (const g of games) {
    const key = keyFn(g);
    const entry = groups.get(key) || { ...buildFn(g), games: 0, wins: 0 };
    entry.games += 1;
    entry.wins += g.win ? 1 : 0;
    groups.set(key, entry);
  }
  const list = [...groups.values()].map((e) => ({ ...e, winrate: pct(e.wins, e.games) }));
  const eligible = list.filter((e) => e.games >= MIN_GAMES_FOR_COMBO);
  const ranked = (eligible.length ? eligible : list).sort((a, b) => b.winrate - a.winrate || b.games - a.games);
  return ranked[0] || null;
}

function computeStats(duo) {
  const games = duo.games.length;
  const wins = duo.games.filter((g) => g.win).length;
  const avgScore = (rankScore(duo.players[0].rank) + rankScore(duo.players[1].rank)) / 2;
  return {
    games,
    wins,
    losses: games - wins,
    winrate: pct(wins, games),
    avgScore,
    avgRank: scoreToRank(avgScore),
    lpBalance: duo.games.reduce((s, g) => s + g.lpChange, 0),
    bestChampCombo: bestBy(
      duo.games,
      (g) => `${g.players[0].champ}|${g.players[1].champ}`,
      (g) => ({ champs: [g.players[0].champ, g.players[1].champ] })
    ),
    bestRoleCombo: bestBy(
      duo.games,
      (g) => `${g.players[0].role}|${g.players[1].role}`,
      (g) => ({ roles: [g.players[0].role, g.players[1].role] })
    ),
    soloOffenders: duo.players.filter((p) => p.soloGames > 0),
  };
}

const SORTS = {
  rank: { label: "Rang / LP", Icon: Crown, value: (s) => s.avgScore },
  winrate: { label: "Duo-Winrate", Icon: TrendingUp, value: (s) => s.winrate },
  games: { label: "Anzahl Spiele", Icon: Gamepad2, value: (s) => s.games },
};

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
  const d = Math.floor(total / 86400);
  const h = Math.floor((total % 86400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return { d, h: pad(h), m: pad(m), s: pad(s) };
}

const formatDate = (date, withTime = false) =>
  new Date(date).toLocaleString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : { year: "numeric" }),
  });

const formatDuration = (sec) => `${Math.floor(sec / 60)}:${pad(sec % 60)}`;

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
  const name = CHAMPS[id] || id;
  return (
    <SafeImage
      src={`${DDRAGON}/champion/${id}.png`}
      alt={name}
      fallback={<span className="text-xs">{name.slice(0, 2)}</span>}
      className={`${size} rounded-md border border-[#785a28] object-cover`}
    />
  );
}

function TierChip({ rank, compact = false }) {
  const style = TIER_STYLE[rank.tier];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded border px-2 py-0.5 text-xs font-semibold tabular-nums ${style.chip} ${style.text}`}
    >
      <Medal className="w-3.5 h-3.5" aria-hidden="true" />
      {formatRank(rank)}
      {!compact && <span className="text-[#a09b8c] font-medium">· {rank.lp} LP</span>}
    </span>
  );
}

function RoleTag({ role }) {
  const { label, Icon } = ROLES[role];
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
  const pad = size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border font-bold uppercase tracking-wider whitespace-nowrap ${pad} ${
        clean
          ? "border-[#1f7a4d] bg-[#0d2e20] text-[#4ade80]"
          : "border-[#9b2335] bg-[#3a0f17] text-[#ff6b7f] animate-pulse"
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

/* ------------------------------------------------------------------ */
/*  Header                                                             */
/* ------------------------------------------------------------------ */

function Header({ now, lastUpdated, cooldownUntil, refreshing, onRefresh }) {
  const started = now >= CHALLENGE_START.getTime();
  const ended = now > CHALLENGE_END.getTime();
  const target = started ? CHALLENGE_END.getTime() : CHALLENGE_START.getTime();
  const cd = formatCountdown(target - now);
  const totalDays = Math.round((CHALLENGE_END - CHALLENGE_START) / 86400000);
  const elapsed = Math.min(100, Math.max(0, ((now - CHALLENGE_START) / (CHALLENGE_END - CHALLENGE_START)) * 100));

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
            Duo Challenge <span className="text-[#c8aa6e]">Herbst 2026</span>
          </h1>
          <p className="mt-2 max-w-xl text-sm text-[#a09b8c]">
            Vier Duos, eine Regel: Ranked wird nur zusammen gequeued. Wer am Ende das beste Duo stellt, bekommt den
            Pokal und eine Runde Döner.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-[#a09b8c]">
            <span className="inline-flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-[#c8aa6e]" aria-hidden="true" />
              Start {formatDate(CHALLENGE_START)}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Trophy className="w-3.5 h-3.5 text-[#c8aa6e]" aria-hidden="true" />
              Ende {formatDate(CHALLENGE_END)}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-[#c8aa6e]" aria-hidden="true" />
              Zuletzt aktualisiert {formatDate(lastUpdated, true)} Uhr
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-end lg:flex-col lg:items-end">
          <div className="rounded-md border border-[#1e3a4c] bg-[#050b14]/80 px-4 py-3">
            <div className="mb-1 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-[#5b6b7a]">
              <Hourglass className="w-3 h-3" aria-hidden="true" />
              {ended ? "Challenge beendet" : started ? "Endet in" : "Startet in"}
            </div>
            <div className="flex items-baseline gap-1 tabular-nums text-[#f0e6d2]" style={{ fontFamily: FONT_DISPLAY }}>
              <span className="text-2xl font-bold">{cd.d}</span>
              <span className="text-xs text-[#a09b8c]">T</span>
              <span className="ml-2 text-2xl font-bold">
                {cd.h}:{cd.m}:{cd.s}
              </span>
            </div>
            <div className="mt-2 h-1 overflow-hidden rounded-full bg-[#1e2d3d]">
              <div className="h-full bg-gradient-to-r from-[#0397ab] to-[#0ac8b9]" style={{ width: `${elapsed}%` }} />
            </div>
            <div className="mt-1 text-[10px] tabular-nums text-[#5b6b7a]">
              Tag {Math.min(totalDays, Math.max(0, Math.ceil((now - CHALLENGE_START) / 86400000)))} von {totalDays}
            </div>
          </div>

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
                  style={{ width: `${(cooldownLeft / REFRESH_COOLDOWN_SEC) * 100}%` }}
                />
              )}
              <RefreshCw className={`relative w-4 h-4 ${refreshing ? "animate-spin" : ""}`} aria-hidden="true" />
              <span className="relative tabular-nums">
                {refreshing
                  ? "Lade Stats…"
                  : onCooldown
                  ? `Cooldown ${Math.floor(cooldownLeft / 60)}:${pad(cooldownLeft % 60)}`
                  : "Stats aktualisieren"}
              </span>
            </button>
            <p className="mt-1.5 text-center text-[10px] text-[#5b6b7a]">
              Riot-API-Limit: 1 Abruf alle {REFRESH_COOLDOWN_SEC} Sekunden
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
  const best = [...rows].sort((a, b) => b.stats.winrate - a.stats.winrate)[0];
  const violations = rows.filter((r) => r.stats.soloOffenders.length > 0).length;
  const items = [
    { label: "Duos im Rennen", value: rows.length, Icon: Users, tone: "text-[#f0e6d2]" },
    { label: "Duo-Spiele gesamt", value: totalGames, Icon: Gamepad2, tone: "text-[#f0e6d2]" },
    {
      label: "Beste Duo-Winrate",
      value: `${best.stats.winrate.toFixed(1)} %`,
      sub: best.name,
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
              <th className="px-2 py-2 text-right">LP-Bilanz</th>
              <th className="px-4 py-2 text-right">Regel-Check</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const tone = winrateTone(r.stats.winrate);
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
                    <div className="font-semibold text-[#f0e6d2]">{r.name}</div>
                    <div className="text-xs text-[#5b6b7a]">
                      {r.players[0].gameName} & {r.players[1].gameName}
                    </div>
                  </td>
                  <td className="px-2 py-2.5">
                    <TierChip rank={r.stats.avgRank} />
                  </td>
                  <td className={`px-2 py-2.5 text-right font-bold tabular-nums ${tone.text}`}>
                    {r.stats.winrate.toFixed(1)} %
                  </td>
                  <td className="px-2 py-2.5 text-right tabular-nums text-[#f0e6d2]">{r.stats.games}</td>
                  <td className="px-2 py-2.5 text-right tabular-nums">
                    <span className="text-[#0ac8b9]">{r.stats.wins}</span>
                    <span className="text-[#5b6b7a]"> / </span>
                    <span className="text-[#e84057]">{r.stats.losses}</span>
                  </td>
                  <td
                    className={`px-2 py-2.5 text-right font-semibold tabular-nums ${
                      r.stats.lpBalance >= 0 ? "text-[#0ac8b9]" : "text-[#e84057]"
                    }`}
                  >
                    {r.stats.lpBalance >= 0 ? "+" : ""}
                    {r.stats.lpBalance}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <RuleBadge offenders={r.stats.soloOffenders} size="sm" />
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
        <SafeImage
          src={`${DDRAGON}/profileicon/${player.profileIconId}.png`}
          alt={`Profilbild von ${player.gameName}`}
          fallback={<span className="text-base">{player.gameName.slice(0, 1)}</span>}
          className="h-14 w-14 rounded-full border-2 border-[#c8aa6e] object-cover"
        />
        {player.soloGames > 0 && (
          <span
            className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border border-[#0a1428] bg-[#e84057] text-[10px] font-black text-white"
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
          <span className={`font-bold ${tone.text}`}>{wr.toFixed(1)} % WR</span> · {player.wins} S {player.losses} N
        </div>
      </div>
    </div>
  );
}

function MatchRow({ game, players }) {
  return (
    <li
      className={`grid grid-cols-[auto_1fr] items-center gap-3 rounded-md border-l-4 bg-[#08121e] p-2.5 sm:grid-cols-[auto_1fr_auto] ${
        game.win ? "border-[#0ac8b9]" : "border-[#e84057]"
      }`}
    >
      <div className="w-16">
        <div className={`text-xs font-black uppercase tracking-wider ${game.win ? "text-[#0ac8b9]" : "text-[#e84057]"}`}>
          {game.win ? "Sieg" : "Niederlage"}
        </div>
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
                  <span className="truncate">{players[i].gameName}</span>
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
        <div className={`text-sm font-bold tabular-nums ${game.lpChange >= 0 ? "text-[#0ac8b9]" : "text-[#e84057]"}`}>
          {game.lpChange >= 0 ? "+" : ""}
          {game.lpChange} LP
        </div>
        <div className="text-[11px] tabular-nums text-[#5b6b7a]">{formatDate(game.date, true)}</div>
      </div>
    </li>
  );
}

function DuoCard({ duo, stats, place, expanded, onToggle }) {
  const tone = winrateTone(stats.winrate);
  const champ = stats.bestChampCombo;
  const role = stats.bestRoleCombo;
  const clean = stats.soloOffenders.length === 0;

  return (
    <article
      id={`duo-${duo.id}`}
      className={`scroll-mt-4 rounded-lg border bg-gradient-to-b from-[#0d1a29] to-[#08111c] transition ${
        place === 1 ? "border-[#c8aa6e] shadow-[0_0_30px_rgba(200,170,110,0.12)]" : "border-[#1e2d3d]"
      }`}
    >
      {/* Kopfzeile */}
      <div className="flex flex-wrap items-center gap-4 border-b border-[#1e2d3d] px-5 py-4">
        <Placement place={place} />
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-xl font-bold text-[#f0e6d2]" style={{ fontFamily: FONT_DISPLAY }}>
            {duo.name}
          </h3>
          <p className="truncate text-xs italic text-[#5b6b7a]">„{duo.motto}“</p>
        </div>
        <RuleBadge offenders={stats.soloOffenders} />
      </div>

      <div className="flex flex-col gap-5 p-5">
        {/* Spieler */}
        <div className="flex flex-col items-stretch gap-4 sm:flex-row sm:items-center">
          <PlayerPanel player={duo.players[0]} />
          <div className="flex shrink-0 items-center justify-center">
            <div className="flex h-9 w-9 items-center justify-center rounded-full border border-[#0ac8b9]/50 bg-[#0a1e2c] text-[#0ac8b9]">
              <Link2 className="w-4 h-4" aria-hidden="true" />
            </div>
          </div>
          <PlayerPanel player={duo.players[1]} align="right" />
        </div>

        {/* Duo-Bilanz */}
        <div className="rounded-md border border-[#1e2d3d] bg-[#060e18] p-4">
          <SectionLabel icon={Users}>Gemeinsame Duo-Bilanz</SectionLabel>
          <div className="mb-3 grid grid-cols-4 gap-2 text-center">
            {[
              ["Spiele", stats.games, "text-[#f0e6d2]"],
              ["Siege", stats.wins, "text-[#0ac8b9]"],
              ["Niederl.", stats.losses, "text-[#e84057]"],
              ["Winrate", `${stats.winrate.toFixed(1)}%`, tone.text],
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
        </div>

        {/* Combos */}
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-md border border-[#1e2d3d] bg-[#060e18] p-4">
            <SectionLabel icon={Sparkles}>Beste Champion-Combo</SectionLabel>
            {champ && (
              <div className="flex items-center gap-3">
                <div className="flex -space-x-2">
                  <ChampIcon id={champ.champs[0]} size="w-12 h-12" />
                  <ChampIcon id={champ.champs[1]} size="w-12 h-12" />
                </div>
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-[#f0e6d2]">
                    {CHAMPS[champ.champs[0]]} + {CHAMPS[champ.champs[1]]}
                  </div>
                  <div className="text-xs tabular-nums text-[#a09b8c]">
                    <span className={`font-bold ${winrateTone(champ.winrate).text}`}>
                      {champ.winrate.toFixed(0)} % WR
                    </span>{" "}
                    · {champ.games} Spiele
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="rounded-md border border-[#1e2d3d] bg-[#060e18] p-4">
            <SectionLabel icon={Crosshair}>Beste Rollen-Combo</SectionLabel>
            {role && (
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
                    · {role.games} Spiele
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Fremdgeh-Detektor */}
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
              <p className="text-[#a09b8c]">
                Seit Challenge-Start keine Solo/Duo-Spiele ohne Partner. Vorbildlich.
              </p>
            ) : (
              <ul className="text-[#f0c4ca]">
                {stats.soloOffenders.map((p) => (
                  <li key={p.gameName}>
                    <span className="font-semibold">{p.gameName}</span> hat {p.soloGames}{" "}
                    {p.soloGames === 1 ? "Spiel" : "Spiele"} alleine gequeued
                    {p.lastSolo && <span className="text-[#a09b8c]"> · zuletzt {formatDate(p.lastSolo, true)} Uhr</span>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Letzte Spiele */}
        <div>
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={expanded}
            className="flex w-full items-center justify-between rounded-sm border border-[#1e2d3d] bg-[#0b1624] px-4 py-2.5 text-xs font-bold uppercase tracking-[0.14em] text-[#c8aa6e] transition hover:border-[#785a28] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0ac8b9]"
          >
            <span className="flex items-center gap-2">
              <Timer className="w-4 h-4" aria-hidden="true" />
              Letzte 5 gemeinsame Spiele
            </span>
            <span className="flex items-center gap-2">
              <span className="flex gap-1" aria-hidden="true">
                {duo.games.slice(0, 5).map((g) => (
                  <span key={g.id} className={`h-2 w-2 rounded-full ${g.win ? "bg-[#0ac8b9]" : "bg-[#e84057]"}`} />
                ))}
              </span>
              <ChevronDown className={`w-4 h-4 transition-transform ${expanded ? "rotate-180" : ""}`} />
            </span>
          </button>
          {expanded && (
            <ul className="mt-2 flex flex-col gap-2">
              {duo.games.slice(0, 5).map((g) => (
                <MatchRow key={g.id} game={g} players={duo.players} />
              ))}
            </ul>
          )}
        </div>
      </div>
    </article>
  );
}

/* ------------------------------------------------------------------ */
/*  Hauptkomponente                                                    */
/* ------------------------------------------------------------------ */

export default function DuoChallengeDashboard() {
  const now = useNow();
  const [duos, setDuos] = useState(INITIAL_DUOS);
  const [sortKey, setSortKey] = useState("rank");
  const [sortDir, setSortDir] = useState("desc");
  const [status, setStatus] = useState("all");
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState(() => new Set([INITIAL_DUOS[0].id]));
  const [lastUpdated, setLastUpdated] = useState(() => Date.now());
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  // Platzierung immer nach "bester zuerst", unabhängig von Filter und Richtung
  const ranked = useMemo(() => {
    const value = SORTS[sortKey].value;
    return duos
      .map((d) => ({ ...d, stats: computeStats(d) }))
      .sort((a, b) => value(b.stats) - value(a.stats) || b.stats.winrate - a.stats.winrate)
      .map((d, i) => ({ ...d, place: i + 1 }));
  }, [duos, sortKey]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = ranked.filter((d) => {
      const offenders = d.stats.soloOffenders.length;
      if (status === "fair" && offenders) return false;
      if (status === "solo" && !offenders) return false;
      if (!q) return true;
      return [d.name, ...d.players.map((p) => `${p.gameName}#${p.tagLine}`)].some((s) => s.toLowerCase().includes(q));
    });
    return sortDir === "desc" ? list : [...list].reverse();
  }, [ranked, status, query, sortDir]);

  const toggle = (id) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
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

  // Simulierter API-Abruf: LP schwanken leicht, danach greift der Cooldown
  const handleRefresh = () => {
    if (refreshing || Date.now() < cooldownUntil) return;
    setRefreshing(true);
    setTimeout(() => {
      setDuos((prev) =>
        prev.map((d) => ({
          ...d,
          players: d.players.map((p) => {
            const delta = Math.round((Math.random() - 0.4) * 30);
            return { ...p, rank: { ...p.rank, lp: Math.min(99, Math.max(0, p.rank.lp + delta)) } };
          }),
        }))
      );
      setRefreshing(false);
      setLastUpdated(Date.now());
      setCooldownUntil(Date.now() + REFRESH_COOLDOWN_SEC * 1000);
    }, 1400);
  };

  return (
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
          lastUpdated={lastUpdated}
          cooldownUntil={cooldownUntil}
          refreshing={refreshing}
          onRefresh={handleRefresh}
        />

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

        <footer className="pb-4 pt-2 text-center text-[11px] text-[#5b6b7a]">
          Mock-Daten für 4 Beispiel-Duos · Champion- und Profilbilder über Riot Data Dragon · Combos ab{" "}
          {MIN_GAMES_FOR_COMBO} Spielen gewertet
        </footer>
      </div>
    </div>
  );
}
