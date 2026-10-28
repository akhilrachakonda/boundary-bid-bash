// Pure game rules shared by UI and tests. The database functions are the
// authority for bids/trades; these mirror them for display and pool building.

export type Role = "WK" | "BAT" | "AR" | "BOWL";
export type Format = "IPL" | "T20" | "ODI";

export interface Player {
  id: string;
  name: string;
  country: string;
  format: string;
  role: string;
  sub_role: string;
  batting_hand: string;
  bowling_style: string;
  rating: number;
  base_price: number;
  nationality_type: string;
  tier: string;
  age_group?: string;
  photo_url?: string | null;
  photo_source?: string | null;
  photo_credit?: string | null;
}

export interface Increment {
  upto: number | null;
  step: number;
}

export interface Settings {
  max_teams: number;
  min_squad: number;
  max_squad: number;
  min_wk: number;
  min_bat: number;
  min_ar: number;
  min_bowl: number;
  max_overseas: number;
  min_spinners: number;
  min_pacers: number;
  purse: number;
  pool_size: number | "all";
  bid_timer: number;
  bid_reset: number;
  increments: Increment[];
  review_seconds: number;
  min_base: number;
  currency: "cr" | "lakh" | "coins";
  sound?: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  max_teams: 4,
  min_squad: 11,
  max_squad: 18,
  min_wk: 1,
  min_bat: 3,
  min_ar: 2,
  min_bowl: 4,
  max_overseas: 6,
  min_spinners: 1,
  min_pacers: 2,
  purse: 100,
  pool_size: 70,
  bid_timer: 20,
  bid_reset: 10,
  increments: [
    { upto: 2, step: 0.1 },
    { upto: 5, step: 0.25 },
    { upto: null, step: 0.5 },
  ],
  review_seconds: 120,
  min_base: 0.2,
  currency: "cr",
};

export const ROLES: Role[] = ["WK", "BAT", "AR", "BOWL"];
export const ROLE_LABEL: Record<string, string> = {
  WK: "Wicketkeeper",
  BAT: "Batsman",
  AR: "All-rounder",
  BOWL: "Bowler",
};
export const SUB_ROLES: Record<Role, string[]> = {
  WK: ["WK-Batter", "WK-Finisher"],
  BAT: ["Top order", "Middle order", "Finisher"],
  AR: ["Batting AR (pace)", "Batting AR (spin)", "Bowling AR (pace)", "Bowling AR (spin)"],
  BOWL: ["Pace", "Medium pace", "Spin"],
};

export const isSpinner = (p: Pick<Player, "sub_role">) => /spin/i.test(p.sub_role);
export const isPacer = (p: Pick<Player, "role" | "sub_role">) =>
  (p.role === "BOWL" || p.role === "AR") && /(pace|medium)/i.test(p.sub_role);
export const isBowlingOption = (p: Pick<Player, "role">) => p.role === "BOWL" || p.role === "AR";
const round2 = (n: number) => Math.round(n * 100) / 100;

export function nextBidAmount(s: Pick<Settings, "increments">, current: number | null, base: number) {
  if (current == null) return base;
  let step = 0.5;
  for (const inc of s.increments) {
    if (inc.upto == null || current < inc.upto) {
      step = inc.step;
      break;
    }
  }
  return round2(current + step);
}

export interface Counts {
  total: number;
  WK: number;
  BAT: number;
  AR: number;
  BOWL: number;
  overseas: number;
  spin: number;
  pace: number;
}

export function squadCounts(players: Player[]): Counts {
  const c: Counts = { total: 0, WK: 0, BAT: 0, AR: 0, BOWL: 0, overseas: 0, spin: 0, pace: 0 };
  for (const p of players) {
    c.total++;
    c[p.role as Role]++;
    if (p.nationality_type === "Overseas") c.overseas++;
    if (isSpinner(p)) c.spin++;
    if (isPacer(p)) c.pace++;
  }
  return c;
}

/** Max you can spend on one player (of `role`) and still fill the minimum squad at base price. */
export function maxAffordableBid(s: Settings, purse: number, c: Counts, role?: string) {
  let roleNeed = 0;
  for (const r of ROLES) {
    const min = s[`min_${r.toLowerCase()}` as keyof Settings] as number;
    roleNeed += Math.max(0, min - c[r] - (r === role ? 1 : 0));
  }
  const need = Math.max(s.min_squad - c.total - 1, roleNeed, 0);
  return round2(purse - need * s.min_base);
}

export type BidBlock = null | string;
export function bidBlockReason(
  s: Settings,
  purse: number,
  c: Counts,
  player: Player,
  amount: number,
  isHighest: boolean,
): BidBlock {
  if (isHighest) return "You're the highest bidder";
  if (c.total + 1 > s.max_squad) return "Squad full";
  if (player.nationality_type === "Overseas" && c.overseas + 1 > s.max_overseas) return "Overseas limit reached";
  if (amount > maxAffordableBid(s, purse, c, player.role)) return "Not enough purse to complete squad";
  return null;
}

export function needsList(s: Settings, c: Counts) {
  const out: { label: string; have: number; need: number }[] = [
    { label: "Wicketkeepers", have: c.WK, need: s.min_wk },
    { label: "Batsmen", have: c.BAT, need: s.min_bat },
    { label: "All-rounders", have: c.AR, need: s.min_ar },
    { label: "Bowlers", have: c.BOWL, need: s.min_bowl },
    { label: "Spinners", have: c.spin, need: s.min_spinners },
    { label: "Pacers", have: c.pace, need: s.min_pacers },
    { label: "Squad size", have: c.total, need: s.min_squad },
  ];
  return out;
}

// ---------------- Pool requirements & balanced selection ----------------

export function poolRequirements(s: Settings) {
  const t = s.max_teams;
  return {
    total: t * s.min_squad,
    WK: t * s.min_wk,
    BAT: t * s.min_bat,
    AR: t * s.min_ar,
    BOWL: t * s.min_bowl,
    spin: t * s.min_spinners,
    pace: t * s.min_pacers,
  };
}

/** Small seeded PRNG (mulberry32) so a pool can be regenerated deterministically. */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface PoolResult {
  players: Player[];
  requested: number;
  size: number;
  notes: string[];
  feasible: boolean;
}

function allocate(total: number, weights: number[]) {
  const sum = weights.reduce((a, b) => a + b, 0) || 1;
  const raw = weights.map((w) => (total * w) / sum);
  const out = raw.map(Math.floor);
  let left = total - out.reduce((a, b) => a + b, 0);
  const order = raw.map((r, i) => [r - Math.floor(r), i] as const).sort((a, b) => b[0] - a[0]);
  for (const [, i] of order) {
    if (left <= 0) break;
    out[i] = out[i]! + 1;
    left--;
  }
  return out;
}

/** Pick q players from a sub-category: mostly top-rated, plus a tier spread from the rest. */
function pickFromGroup(group: Player[], q: number, rand: () => number) {
  const sorted = [...group]
    .map((p) => ({ p, k: p.rating + rand() * 2.5 })) // random tie-break among similar ratings
    .sort((a, b) => b.k - a.k)
    .map((x) => x.p);
  if (q >= sorted.length) return sorted;
  const top = Math.ceil(q * 0.65);
  const chosen = sorted.slice(0, top);
  const rest = sorted.slice(top);
  const remaining = q - top;
  for (let i = 0; i < remaining; i++) {
    const idx = Math.floor(((i + 0.5) * rest.length) / remaining);
    chosen.push(rest[Math.min(idx, rest.length - 1)]!);
  }
  return chosen;
}

export function generateBalancedPool(all: Player[], s: Settings, seed = 1): PoolResult {
  const notes: string[] = [];
  const req = poolRequirements(s);
  const requested = s.pool_size === "all" ? all.length : s.pool_size;
  let size = Math.min(requested, all.length);
  if (size < req.total) {
    notes.push(
      `Raised pool from ${size} to ${req.total}: ${s.max_teams} teams × ${s.min_squad} minimum squad.`,
    );
    size = req.total;
  }
  if (size > all.length) size = all.length;
  const feasibleBase = all.length >= req.total;

  const subs: { role: Role; sub: string; list: Player[] }[] = [];
  for (const role of ROLES)
    for (const sub of SUB_ROLES[role]) {
      const list = all.filter((p) => p.role === role && p.sub_role === sub);
      if (list.length) subs.push({ role, sub, list });
    }
  // Proportional quotas per sub-role
  let quotas = allocate(size, subs.map((x) => x.list.length));
  quotas = quotas.map((q, i) => Math.min(q, subs[i]!.list.length));

  // Enforce role minimums by raising the largest under-filled sub of that role
  const bump = (pred: (i: number) => boolean, need: number, label: string) => {
    let have = quotas.reduce((a, q, i) => (pred(i) ? a + q : a), 0);
    if (have >= need) return;
    const before = have;
    while (have < need) {
      let best = -1;
      for (let i = 0; i < subs.length; i++)
        if (pred(i) && quotas[i]! < subs[i]!.list.length && (best < 0 || quotas[i]! < quotas[best]!)) best = i;
      if (best < 0) break;
      quotas[best] = quotas[best]! + 1;
      have++;
    }
    notes.push(`Added ${have - before} ${label} so every team can meet the minimum (${need} needed).`);
  };
  for (const role of ROLES) bump((i) => subs[i]!.role === role, req[role], (ROLE_LABEL[role] ?? role).toLowerCase() + "s");
  bump((i) => /spin/i.test(subs[i]!.sub), req.spin, "spinners");
  bump((i) => /(pace|medium)/i.test(subs[i]!.sub) && subs[i]!.role !== "WK" && subs[i]!.role !== "BAT", req.pace, "pacers");

  const rand = rng(seed);
  const players = subs.flatMap((g, i) => pickFromGroup(g.list, quotas[i]!, rand));
  const c = squadCounts(players);
  const feasible =
    feasibleBase &&
    players.length >= req.total &&
    c.WK >= req.WK &&
    c.BAT >= req.BAT &&
    c.AR >= req.AR &&
    c.BOWL >= req.BOWL &&
    c.spin >= req.spin &&
    c.pace >= req.pace;
  if (!feasible) notes.push("Not enough players in the database to satisfy these squad rules. Lower the minimums.");
  if (players.length !== size) notes.push(`Final pool: ${players.length} players.`);
  return { players, requested, size: players.length, notes, feasible };
}

// ---------------- XI & team rating ----------------

export function xiWarnings(xi: Player[], maxOverseasXI: number) {
  const w: string[] = [];
  if (xi.length !== 11) w.push(`XI has ${xi.length} players`);
  if (!xi.some((p) => p.role === "WK")) w.push("No wicketkeeper");
  const bowl = xi.filter(isBowlingOption).length;
  if (bowl < 5) w.push(`Only ${bowl} bowling options (need 5)`);
  if (!xi.some(isSpinner)) w.push("No spinner");
  if (xi.filter(isPacer).length < 2) w.push("Fewer than 2 pacers");
  const ovs = xi.filter((p) => p.nationality_type === "Overseas").length;
  if (ovs > maxOverseasXI) w.push(`${ovs} overseas (max ${maxOverseasXI})`);
  return w;
}

export const overseasXILimit = (format: string) => (format === "IPL" ? 4 : 11);

/** Greedy best valid XI: best WK, 5+ bowling options incl. spin & pace, then best remaining. */
export function bestXI(squad: Player[], maxOverseas: number): Player[] {
  const pool = [...squad].sort((a, b) => b.rating - a.rating);
  const xi: Player[] = [];
  const ovs = () => xi.filter((p) => p.nationality_type === "Overseas").length;
  const canAdd = (p: Player) =>
    !xi.includes(p) && xi.length < 11 && (p.nationality_type !== "Overseas" || ovs() < maxOverseas);
  const take = (pred: (p: Player) => boolean, n: number) => {
    for (const p of pool) {
      if (n <= 0) break;
      if (pred(p) && canAdd(p)) {
        xi.push(p);
        n--;
      }
    }
  };
  take((p) => p.role === "WK", 1);
  if (!xi.some(isSpinner)) take(isSpinner, 1);
  take((p) => isPacer(p), Math.max(0, 2 - xi.filter(isPacer).length));
  take(isBowlingOption, Math.max(0, 5 - xi.filter(isBowlingOption).length));
  take((p) => p.role === "BAT" || p.role === "WK", Math.max(0, 4 - xi.filter((p) => p.role === "BAT" || p.role === "WK").length));
  take(() => true, 11 - xi.length);
  return xi;
}

export interface TeamScore {
  total: number;
  xi: number;
  balance: number;
  bench: number;
  combo: number;
  budget: number;
  xiPlayers: Player[];
  strengths: string[];
  weaknesses: string[];
}

export function scoreTeam(
  squad: Player[],
  spent: number,
  format: string,
  maxEff: number,
): TeamScore {
  const xiPlayers = bestXI(squad, overseasXILimit(format));
  const avg = (ps: Player[], n: number) =>
    n ? ps.reduce((a, p) => a + p.rating, 0) / n + 0 : 0;
  const xi = xiPlayers.length ? avg(xiPlayers, 11) + (11 - xiPlayers.length) * 0 : 0;
  const xiScore = (xiPlayers.reduce((a, p) => a + p.rating, 0) + (11 - xiPlayers.length) * 40) / 11;

  const top = xiPlayers.filter((p) => p.sub_role === "Top order" || p.sub_role === "WK-Batter").length;
  const mid = xiPlayers.filter((p) => p.sub_role === "Middle order").length;
  const fin = xiPlayers.filter((p) => p.sub_role === "Finisher" || p.sub_role === "WK-Finisher").length;
  const bowlOpts = xiPlayers.filter(isBowlingOption).length;
  const checks: [boolean, string][] = [
    [xiPlayers.some((p) => p.role === "WK"), "wicketkeeper"],
    [top >= 3, "3 top-order batters"],
    [mid >= 2, "2 middle-order batters"],
    [fin >= 1, "a finisher"],
    [xiPlayers.some((p) => p.role === "AR"), "an all-rounder"],
    [xiPlayers.filter(isPacer).length >= 2, "2 pacers"],
    [xiPlayers.some(isSpinner), "a spinner"],
    [bowlOpts >= 5 && bowlOpts <= 7, "5-6 bowling options"],
  ];
  const balance = (checks.filter((c) => c[0]).length / checks.length) * 100;

  const benchPlayers = squad
    .filter((p) => !xiPlayers.includes(p))
    .sort((a, b) => b.rating - a.rating)
    .slice(0, 5);
  const bench = (benchPlayers.reduce((a, p) => a + p.rating, 0) + (5 - benchPlayers.length) * 40) / 5;

  const seamers = xiPlayers.filter(isPacer).sort((a, b) => b.rating - a.rating);
  const bats = xiPlayers.filter((p) => p.role !== "BOWL");
  const combos: [boolean, string][] = [
    [seamers.some((p) => p.rating >= 80), "death-overs specialist"],
    [seamers.filter((p) => p.rating >= 74).length >= 2, "powerplay new-ball pair"],
    [xiPlayers.some((p) => isSpinner(p) && p.rating >= 76), "middle-overs spinner"],
    [bats.some((p) => p.batting_hand === "Left") && bats.some((p) => p.batting_hand === "Right"), "left-right batting mix"],
    [fin >= 1 && xiPlayers.some((p) => p.role === "AR" && p.rating >= 78), "lower-order firepower"],
  ];
  const combo = (combos.filter((c) => c[0]).length / combos.length) * 100;

  const eff = spent > 0 ? squad.reduce((a, p) => a + p.rating, 0) / spent : 0;
  const budget = maxEff > 0 ? Math.min(100, (eff / maxEff) * 100) : 0;

  const total = 0.5 * xiScore + 0.2 * balance + 0.1 * bench + 0.15 * combo + 0.05 * budget;
  const strengths = [
    ...combos.filter((c) => c[0]).map((c) => c[1]),
    ...(xiScore >= 82 ? ["star-studded XI"] : []),
    ...(bench >= 72 ? ["deep bench"] : []),
  ];
  const weaknesses = [
    ...checks.filter((c) => !c[0]).map((c) => "missing " + c[1]),
    ...combos.filter((c) => !c[0]).map((c) => "no " + c[1]),
    ...(xiPlayers.length < 11 ? [`only ${xiPlayers.length} fit an XI`] : []),
  ];
  void xi;
  return {
    total: Math.round(total * 10) / 10,
    xi: Math.round(xiScore),
    balance: Math.round(balance),
    bench: Math.round(bench),
    combo: Math.round(combo),
    budget: Math.round(budget),
    xiPlayers,
    strengths,
    weaknesses,
  };
}

export function compareTeams(
  teams: { id: string; squad: Player[]; spent: number }[],
  format: string,
) {
  const effs = teams.map((t) => (t.spent > 0 ? t.squad.reduce((a, p) => a + p.rating, 0) / t.spent : 0));
  const maxEff = Math.max(0, ...effs);
  return teams
    .map((t) => ({ id: t.id, score: scoreTeam(t.squad, t.spent, format, maxEff) }))
    .sort((a, b) => b.score.total - a.score.total);
}

export function formatMoney(n: number | null | undefined, currency: Settings["currency"] = "cr") {
  if (n == null) return "—";
  if (currency === "lakh") return `₹${Math.round(n * 100)} L`;
  if (currency === "coins") return `${Math.round(n * 100)} 🪙`;
  return `₹${n.toFixed(2).replace(/\.?0+$/, "")} Cr`;
}
