// Mirror of the random-80-20-v1 rules in public.generate_pool (SQL is the authority).
export const POOL_RULES = "random-80-20-v1";

export interface PoolGeneration {
  rules: string;
  group_rules: string;
  snapshot_id: string | null;
  seed: number;
  size: number;
  established: number;
  emerging: number;
  capacity: { established: number; emerging: number };
  generated_at: string;
}

/** emerging = round(N * 0.2) (half away from zero, as Postgres numeric round); established = N - emerging. */
export function ratioCounts(n: number) {
  const emerging = Math.round(n * 0.2);
  return { established: n - emerging, emerging };
}

/** Largest exact 80/20 pool supported by group capacity (0 when none). */
export function maxRatioPool(establishedCap: number, emergingCap: number, limit = 200) {
  let best = 0;
  for (let k = 1; k <= limit; k++) {
    const c = ratioCounts(k);
    if (c.established <= establishedCap && c.emerging <= emergingCap) best = k;
  }
  return best;
}
