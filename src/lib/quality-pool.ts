import {
  poolRequirements,
  squadCounts,
  rng,
  type Player,
  type Settings,
  type PoolResult,
} from "./auction-rules.ts";
export const qualityBand = (p: Player): "top" | "middle" | "low" =>
  ["Marquee", "A"].includes(p.tier) ? "top" : p.tier === "B" ? "middle" : "low";
export function inspectPool(players: Player[], s: Settings): PoolResult {
  const req = poolRequirements(s),
    c = squadCounts(players);
  const missing = (Object.keys(req) as (keyof typeof req)[]).filter((k) => c[k] < req[k]);
  return {
    players,
    requested: s.pool_size === "all" ? players.length : s.pool_size,
    size: players.length,
    feasible: !missing.length,
    notes: missing.map((k) => `${k}: ${c[k]} selected; ${req[k]} needed for your squad rules.`),
  };
}
/** Fill quality quotas using seeded picks, giving priority to unfilled squad roles. */
export function generateQualityPool(all: Player[], s: Settings, seed = 1, retained: Player[] = []): PoolResult {
  const random = rng(seed);
  const req = poolRequirements(s);
  const requested = s.pool_size === "all" ? all.length : s.pool_size;
  const size = Math.min(all.length, Math.max(requested, req.total));
  const top = Math.round(size * 0.7);
  const low = Math.round(size * 0.1);
  const target = { top, middle: size - top - low, low };
  const counts = { top: 0, middle: 0, low: 0 };
  const kept = new Set(retained.map(player => player.id));
  const remaining = all.filter(player => !kept.has(player.id))
    .map((player) => ({
      player,
      band: qualityBand(player),
      roles: squadCounts([player]),
      weight: -Math.log(Math.max(0.000001, random())) / (1 + player.rating / 50),
    }))
    .sort((a, b) => a.weight - b.weight);
  const roles = Object.keys(req) as (keyof typeof req)[];
  const need = { ...req };
  const chosen = [...retained];
  const existing = squadCounts(retained);
  for (const role of roles) need[role] -= existing[role];
  for (const player of retained) counts[qualityBand(player)]++;
  while (remaining.length) {
    let best = -1;
    let bestScore = -Infinity;
    for (const [index, p] of remaining.entries()) {
      const gain = roles.reduce(
        (sum, role) =>
          sum +
          (role !== "total" && need[role] > 0 && p.roles[role] > 0
            ? 1 + need[role] / req[role]
            : 0),
        0,
      );
      if (chosen.length >= size && !gain) continue;
      // Preserve the band targets first. With a shortage, fill from the nearest available tier.
      const deficit = target[p.band] - counts[p.band];
      const fallback = p.band === "middle" ? 2 : p.band === "top" ? 1 : 0;
      const score = chosen.length >= size ? gain : deficit > 0 ? 100 + gain : fallback * 10 + gain;
      if (score > bestScore) {
        best = index;
        bestScore = score;
      }
    }
    if (best < 0) break;
    const [pick] = remaining.splice(best, 1);
    chosen.push(pick!.player);
    counts[pick!.band]++;
    for (const role of roles) need[role] -= pick!.roles[role];
  }
  const result = inspectPool(chosen, s);
  result.requested = requested;
  result.notes.unshift(
    `Selected ${counts.top} top, ${counts.middle} middle and ${counts.low} low. Target mix: 70% / 20% / 10%.`,
  );
  if (chosen.length > requested)
    result.notes.push(`Pool raised to ${chosen.length} for the room's squad requirements.`);
  if (counts.top !== target.top || counts.middle !== target.middle || counts.low !== target.low)
    result.notes.push("Available tiers or required roles changed the mix.");
  return result;
}
