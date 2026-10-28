import { describe, expect, it } from "vitest";
import {
  DEFAULT_SETTINGS,
  bidBlockReason,
  compareTeams,
  generateBalancedPool,
  maxAffordableBid,
  nextBidAmount,
  poolRequirements,
  squadCounts,
  type Player,
  type Settings,
} from "@/lib/auction-rules";

// Synthetic database mirroring the seed shape: 150 players per format.
const SUBS: [string, string, number][] = [
  ["WK", "WK-Batter", 13], ["WK", "WK-Finisher", 12],
  ["BAT", "Top order", 14], ["BAT", "Middle order", 13], ["BAT", "Finisher", 13],
  ["AR", "Batting AR (pace)", 10], ["AR", "Batting AR (spin)", 10], ["AR", "Bowling AR (pace)", 10], ["AR", "Bowling AR (spin)", 10],
  ["BOWL", "Pace", 15], ["BOWL", "Medium pace", 15], ["BOWL", "Spin", 15],
];
const db: Player[] = SUBS.flatMap(([role, sub, n]) =>
  Array.from({ length: n }, (_, i) => {
    const rating = 95 - i * 3;
    return {
      id: `${sub}-${i}`, name: `${sub} ${i}`, country: i % 3 ? "India" : "Australia", format: "IPL", role, sub_role: sub,
      batting_hand: i % 2 ? "Left" : "Right", bowling_style: "x", rating, base_price: rating >= 90 ? 2 : 1,
      nationality_type: i % 3 ? "Indian" : "Overseas", tier: rating >= 90 ? "Marquee" : rating >= 82 ? "A" : rating >= 72 ? "B" : "C",
    };
  }),
);
const S = (o: Partial<Settings>): Settings => ({ ...DEFAULT_SETTINGS, ...o });

describe("bid increments", () => {
  it("opens at base price", () => expect(nextBidAmount(DEFAULT_SETTINGS, null, 1.5)).toBe(1.5));
  it("+0.1 below 2 Cr", () => expect(nextBidAmount(DEFAULT_SETTINGS, 1.5, 1)).toBe(1.6));
  it("+0.25 from 2 Cr up to 5 Cr", () => expect(nextBidAmount(DEFAULT_SETTINGS, 2, 1)).toBe(2.25));
  it("+0.5 from 5 Cr", () => expect(nextBidAmount(DEFAULT_SETTINGS, 5, 1)).toBe(5.5));
});

describe("purse guard", () => {
  it("reserves 0.2 Cr per remaining minimum slot", () => {
    // 11 min squad, empty squad: buying 1 leaves 10 slots × 0.2 = 2 Cr reserved
    expect(maxAffordableBid(DEFAULT_SETTINGS, 100, squadCounts([]), "BAT")).toBe(98);
  });
  it("blocks a bid that would leave the squad uncompletable", () => {
    const p = db[0]!;
    expect(bidBlockReason(DEFAULT_SETTINGS, 3, squadCounts([]), p, 1.5, false)).toBe("Not enough purse to complete squad");
  });
  it("blocks the current highest bidder", () => {
    expect(bidBlockReason(DEFAULT_SETTINGS, 100, squadCounts([]), db[0]!, 2, true)).toBe("You're the highest bidder");
  });
  it("blocks overseas beyond the limit", () => {
    const overseas = db.filter((p) => p.nationality_type === "Overseas").slice(0, 6);
    const target = db.filter((p) => p.nationality_type === "Overseas")[6]!;
    expect(bidBlockReason(DEFAULT_SETTINGS, 100, squadCounts(overseas), target, 1, false)).toBe("Overseas limit reached");
  });
});

describe("balanced pool", () => {
  it("40 players for 10 teams × 15 squad is auto-raised to 150", () => {
    const s = S({ pool_size: 40, max_teams: 10, min_squad: 15 });
    const r = generateBalancedPool(db, s, 7);
    expect(r.size).toBe(150);
    expect(r.notes[0]).toMatch(/Raised pool from 40 to 150/);
  });
  it("meets every role minimum for all teams", () => {
    const s = S({ pool_size: 40, max_teams: 4, min_squad: 10, min_wk: 2, min_bowl: 4, min_spinners: 2 });
    const r = generateBalancedPool(db, s, 3);
    const c = squadCounts(r.players);
    const req = poolRequirements(s);
    expect(r.players.length).toBeGreaterThanOrEqual(req.total);
    expect(c.WK).toBeGreaterThanOrEqual(8);
    expect(c.BOWL).toBeGreaterThanOrEqual(16);
    expect(c.spin).toBeGreaterThanOrEqual(8);
    expect(r.feasible).toBe(true);
  });
  it("keeps sub-role proportions for a 70-player pool", () => {
    const r = generateBalancedPool(db, S({ pool_size: 70, max_teams: 4, min_squad: 11 }), 1);
    expect(r.players.length).toBe(70);
    const pace = r.players.filter((p) => p.sub_role === "Pace").length;
    const spin = r.players.filter((p) => p.sub_role === "Spin").length;
    expect(pace).toBe(spin); // equal-sized sub-categories get equal quotas
    expect(new Set(r.players.map((p) => p.id)).size).toBe(70);
  });
  it("includes the top-rated player of each sub-category", () => {
    const r = generateBalancedPool(db, S({ pool_size: 70 }), 9);
    for (const [, sub] of SUBS) expect(r.players.some((p) => p.id === `${sub}-0`)).toBe(true);
  });
  it("regenerating with another seed can change the pool but not its size", () => {
    const a = generateBalancedPool(db, S({ pool_size: 70 }), 1);
    const b = generateBalancedPool(db, S({ pool_size: 70 }), 2);
    expect(a.players.length).toBe(b.players.length);
  });
});

describe("team rating", () => {
  it("a balanced strong squad beats a squad of only batters", () => {
    const pick = (sub: string, n: number) => db.filter((p) => p.sub_role === sub).slice(0, n);
    const balanced = [...pick("WK-Batter", 1), ...pick("Top order", 3), ...pick("Middle order", 2), ...pick("Finisher", 1), ...pick("Bowling AR (spin)", 1), ...pick("Pace", 2), ...pick("Spin", 2)];
    const batters = [...pick("Top order", 8), ...pick("Middle order", 5)];
    const r = compareTeams([{ id: "bal", squad: balanced, spent: 50 }, { id: "bat", squad: batters, spent: 50 }], "T20");
    expect(r[0]!.id).toBe("bal");
  });
});
