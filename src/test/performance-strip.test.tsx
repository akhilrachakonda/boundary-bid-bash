import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const rows = [
  { identity_key: "Jasprit Bumrah|India", grp: "performance", basis: { percentiles: { bat: 14.8, bowl: 99.1 }, recent: { bowl: 97 }, raw: { innings: 140, runs: 90, balls: 120, dismissals: 20, wickets: 180, legal_balls: 3300, conceded: 4000 } } },
  { identity_key: "Ayush Mhatre|India", grp: "emerging", basis: { percentiles: {}, status: "insufficient data", raw: { innings: 7, runs: 240, balls: 130, dismissals: 7, wickets: 0, legal_balls: 0, conceded: 0 } } },
];
vi.mock("@/integrations/supabase/client", () => {
  const q = (table: string) => {
    const chain: any = { select: () => chain, eq: () => chain, order: () => chain, limit: () => chain,
      maybeSingle: async () => ({ data: table === "evaluation_snapshots" ? { id: "s1", cutoff: "2026-11-06" } : null }),
      then: (res: (v: unknown) => void) => res({ data: rows }) };
    return chain;
  };
  return { supabase: { from: q } };
});
import { PerformanceStrip } from "@/components/auction/PerformanceStrip";

const base = { country: "India", format: "IPL", sub_role: "Pace", batting_hand: "Right", bowling_style: "Right-arm fast", rating: 98, base_price: 2, nationality_type: "Indian", tier: "Marquee" };
describe("PerformanceStrip", () => {
  it("shows BAT, BOWL and recent form scores with the official-rating disclaimer", async () => {
    render(<PerformanceStrip player={{ ...base, id: "1", name: "Jasprit Bumrah", role: "BOWL" }} />);
    expect(await screen.findByText("99")).toBeTruthy();
    expect(screen.getByText("97")).toBeTruthy();
    expect(screen.getByText(/Not official ratings/)).toBeTruthy();
  });
  it("labels missing evidence as insufficient data, never a measured score", async () => {
    render(<PerformanceStrip player={{ ...base, id: "2", name: "Ayush Mhatre", role: "BAT" }} />);
    expect(await screen.findByText("insufficient data")).toBeTruthy();
  });
});
