import { describe, expect, it } from "vitest";
import { pendingLots } from "@/lib/auction-presentation";
import type { RoomPlayer } from "@/hooks/use-room";

const lot = (id: string, round: number, lot_order: number, status = "pending") => ({ id, round, lot_order, status }) as RoomPlayer;
describe("authoritative upcoming queue", () => {
  it("uses persisted sequence rather than browser input order", () => {
    expect(pendingLots([lot("c", 1, 3), lot("a", 1, 1), lot("b", 1, 2)]).map(p => p.id)).toEqual(["a", "b", "c"]);
  });
  it("excludes live, sold and unsold lots", () => {
    expect(pendingLots([lot("live", 1, 1, "live"), lot("sold", 1, 2, "sold"), lot("unsold", 1, 3, "unsold"), lot("pending", 1, 4)]).map(p => p.id)).toEqual(["pending"]);
  });
  it("keeps undo priority and the separate accelerated order", () => {
    expect(pendingLots([lot("second", 2, 2), lot("first", 2, 1), lot("undo", 1, -1)]).map(p => p.id)).toEqual(["undo", "first", "second"]);
  });
});