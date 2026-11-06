import { describe, expect, it } from "vitest";
import { maxRatioPool, ratioCounts } from "@/lib/pool-ratio";

describe("random 80/20 pool counts", () => {
  it("100 players = 80 established + 20 emerging", () => expect(ratioCounts(100)).toEqual({ established: 80, emerging: 20 }));
  it("150 players = 120 established + 30 emerging", () => expect(ratioCounts(150)).toEqual({ established: 120, emerging: 30 }));
  it("odd sizes round the emerging share: 45 -> 36 + 9, 69 -> 55 + 14", () => {
    expect(ratioCounts(45)).toEqual({ established: 36, emerging: 9 });
    expect(ratioCounts(69)).toEqual({ established: 55, emerging: 14 });
  });
  it("largest exact pool matches loaded capacities (IPL 69, T20 102, ODI 22)", () => {
    expect(maxRatioPool(55, 18)).toBe(69);
    expect(maxRatioPool(84, 20)).toBe(102);
    expect(maxRatioPool(30, 4)).toBe(22);
  });
});
