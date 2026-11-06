// V3.0 descriptive XI evaluation (new random-80-20 rooms only). Pure and deterministic.
// No leadership points, no bench points, no fantasy multipliers, no win probabilities.
// Inputs are role-relative Cricket Auction performance scores (percentiles vs the same-format
// catalogue, sample-shrunk) from the frozen snapshot's pool-groups-2 records.
import { isPacer, isSpinner, type Player } from './auction-rules';

export interface Measure {
  bat?: number | undefined; bowl?: number | undefined; recentBat?: number | undefined; recentBowl?: number | undefined;
  status: 'measured' | 'insufficient data' | 'unknown'; group: string;
  raw?: undefined | { innings: number; runs: number; balls: number; dismissals: number; wickets: number; legal_balls: number; conceded: number };
  latest?: string | null | undefined;
}
export interface V3Player extends Pick<Player, 'id' | 'name' | 'role' | 'sub_role' | 'nationality_type' | 'format'> { measure?: Measure }
export interface V3Contribution { id: string; slot: number; bat: number | null; overs: number; bowl: number | null; note: string }
export interface V3Result {
  xi: string[]; bench: string[]; source: 'submitted' | 'auto';
  batting: number; bowling: number; combined: number; recentForm: number | null;
  battingCoverage: number; bowlingCoverage: number; confidence: number;
  oversRequired: number; oversCovered: number; keeper: boolean; eligible: boolean; reasons: string[];
  contributions: V3Contribution[]; weaknesses: string[];
}
const BAT_WEIGHTS = [1, 1, 1, 1, 0.9, 0.8, 0.7, 0.4, 0.2, 0.1, 0.1];
export const oversRules = (format: string) => (format === 'ODI' ? { total: 50, cap: 10 } : { total: 20, cap: 4 });
const canBowl = (p: V3Player) => p.role === 'BOWL' || p.role === 'AR' || p.measure?.bowl !== undefined;
const batKey = (p: V3Player) => (p.role === 'BOWL' ? -1 : p.measure?.bat ?? -0.5);

/** Deterministic auto XI: 1 keeper, then best measured batters/bowlers by role need; ties by id. */
export function autoXI(squad: V3Player[], format: string, maxOverseas: number): V3Player[] {
  const sorted = [...squad].sort((a, b) => a.id.localeCompare(b.id));
  const picked: V3Player[] = [];
  const overseas = () => picked.filter((p) => p.nationality_type === 'Overseas').length;
  const add = (p?: V3Player) => { if (p && !picked.includes(p) && picked.length < 11 && (p.nationality_type !== 'Overseas' || overseas() < maxOverseas)) picked.push(p); };
  const by = (f: (p: V3Player) => number) => [...sorted].sort((a, b) => f(b) - f(a) || a.id.localeCompare(b.id));
  add(by((p) => (p.role === 'WK' ? 100 + (p.measure?.bat ?? 0) : -1)).find((p) => p.role === 'WK'));
  const bowlers = by((p) => (canBowl(p) ? p.measure?.bowl ?? 0 : -1)).filter(canBowl);
  for (const p of bowlers) { if (picked.filter(canBowl).length >= 5) break; add(p); }
  for (const p of by(batKey)) { if (picked.length >= 7) break; if (p.role !== 'BOWL') add(p); }
  for (const p of by((p) => Math.max(p.measure?.bat ?? 0, p.measure?.bowl ?? 0))) add(p);
  // Batting order: better measured batters higher; bowlers last.
  return picked.sort((a, b) => batKey(b) - batKey(a) || a.id.localeCompare(b.id));
}

export function evaluateV3(squad: V3Player[], format: string, maxOverseas: number, submitted?: string[]): V3Result {
  const byId = new Map(squad.map((p) => [p.id, p]));
  const valid = submitted && submitted.length === 11 && new Set(submitted).size === 11 && submitted.every((id) => byId.has(id));
  const xi = valid ? submitted!.map((id) => byId.get(id)!) : autoXI(squad, format, maxOverseas);
  const reasons: string[] = []; const weaknesses: string[] = [];
  if (xi.length < 11) reasons.push(`Only ${xi.length} players available for the XI`);
  const keeper = xi.some((p) => p.role === 'WK');
  if (!keeper) reasons.push('No wicketkeeper in the XI');
  if (xi.filter((p) => p.nationality_type === 'Overseas').length > maxOverseas) reasons.push('Too many overseas players in the XI');
  // Batting: slot-weighted role-relative batting scores; unmeasured slots are excluded and lower coverage.
  let batSum = 0, batW = 0, batAll = 0;
  const contributions: V3Contribution[] = xi.map((p, i) => {
    const w = BAT_WEIGHTS[i] ?? 0; batAll += w;
    const bat = p.measure?.bat ?? null;
    if (bat !== null) { batSum += bat * w; batW += w; }
    return { id: p.id, slot: i + 1, bat, overs: 0, bowl: p.measure?.bowl ?? null, note: '' };
  });
  // Bowling: realistic overs capacity, best measured bowlers first, per-bowler cap.
  const { total, cap } = oversRules(format);
  const options = xi.filter(canBowl).sort((a, b) => (b.measure?.bowl ?? -1) - (a.measure?.bowl ?? -1) || a.id.localeCompare(b.id));
  let left = total, bowlSum = 0, bowlMeasured = 0;
  for (const p of options) {
    if (left <= 0) break;
    const overs = Math.min(cap, left); left -= overs;
    const c = contributions.find((x) => x.id === p.id)!; c.overs = overs;
    if (p.measure?.bowl !== undefined) { bowlSum += p.measure.bowl * overs; bowlMeasured += overs; }
    else c.note = 'Bowls unmeasured overs (insufficient data)';
  }
  const oversCovered = total - left;
  if (oversCovered < total) reasons.push(`Only ${oversCovered}/${total} overs can be bowled by available bowling options`);
  const batting = batW ? (batSum / batAll) : 0; // unmeasured or empty slots add nothing
  const bowling = bowlSum / total; // unbowlable or unmeasured overs add nothing
  const recent = xi.map((p) => (p.role === 'BOWL' ? p.measure?.recentBowl : p.role === 'AR' ? avg([p.measure?.recentBat, p.measure?.recentBowl]) : p.measure?.recentBat)).filter((x): x is number => x !== undefined);
  if (xi.some((p) => !isSpinner(p)) && !xi.some((p) => isSpinner(p) && canBowl(p))) weaknesses.push('No spin bowling option');
  if (!xi.some((p) => isPacer(p))) weaknesses.push('No pace bowling option');
  for (const c of contributions) {
    const p = byId.get(c.id) ?? xi.find((x) => x.id === c.id)!;
    if (p.measure?.status !== 'measured') c.note ||= p.measure?.status === 'unknown' ? 'No covered matches in this format' : 'Insufficient data in this format';
  }
  const battingCoverage = batAll ? batW / batAll : 0, bowlingCoverage = bowlMeasured / total;
  const eligible = reasons.length === 0;
  return {
    xi: xi.map((p) => p.id), bench: squad.filter((p) => !xi.includes(p)).map((p) => p.id), source: valid ? 'submitted' : 'auto',
    batting: round(batting), bowling: round(bowling), combined: round((batting + bowling) / 2),
    recentForm: recent.length ? round(avg(recent)!) : null, battingCoverage: round(battingCoverage, 3), bowlingCoverage: round(bowlingCoverage, 3),
    confidence: round((battingCoverage + bowlingCoverage) / 2, 3), oversRequired: total, oversCovered, keeper, eligible, reasons, contributions, weaknesses,
  };
}
const avg = (xs: (number | undefined)[]) => { const v = xs.filter((x): x is number => x !== undefined); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : undefined; };
const round = (x: number, d = 2) => Math.round(x * 10 ** d) / 10 ** d;

/** Descriptive ordering: eligible XIs first, then combined batting+bowling score; equal scores share rank. */
export function rankV3<T extends { score: V3Result }>(teams: T[]): (T & { rank: number })[] {
  const sorted = [...teams].sort((a, b) => Number(b.score.eligible) - Number(a.score.eligible) || b.score.combined - a.score.combined);
  let rank = 0, prev: V3Result | null = null;
  return sorted.map((t, i) => { if (!prev || prev.eligible !== t.score.eligible || prev.combined !== t.score.combined) rank = i + 1; prev = t.score; return { ...t, rank }; });
}

interface Basis { percentiles?: { bat?: number; bowl?: number }; recent?: { bat?: number; bowl?: number }; status?: Measure['status']; raw?: Measure['raw']; latest?: string | null }
export function measureFromBasis(grp: string, input: unknown): Measure {
  const basis = (input ?? {}) as Basis; const pc = basis.percentiles ?? {}; const rc = basis.recent ?? {};
  return { bat: pc.bat, bowl: pc.bowl, recentBat: rc.bat, recentBowl: rc.bowl, status: basis.status ?? 'measured', group: grp, raw: basis.raw, latest: basis.latest ?? null };
}
