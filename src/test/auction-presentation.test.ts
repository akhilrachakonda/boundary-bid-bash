import { describe, expect, it } from "vitest";
import { unseenEvents, bidChange, resolvedLot } from "@/lib/auction-presentation";
import type { Bid, RoomPlayer } from "@/hooks/use-room";
describe("auction presentation event rules", () => {
  it("shows the first sale after an initially empty loaded feed", () => { const seen=new Set<string|number>(); unseenEvents([],seen,false); expect(unseenEvents([{id:1}],seen,true)).toEqual([{id:1}]); });
  it("does not replay historic sales on initial load or reconnect", () => { const seen=new Set<string|number>(); expect(unseenEvents([{id:5}],seen,false)).toEqual([]); expect(unseenEvents([{id:5}],seen,true)).toEqual([]); });
  it("uses unique IDs even when two events have the same amount", () => { const seen=new Set<string|number>(["a"]); expect(unseenEvents([{id:"b",amount:2}],seen,true)).toHaveLength(1); });
  it("shows the accepted increment without changing the legal bid", () => { expect(bidChange({amount:2.5} as Bid,2.25)).toBe(0.25); });
  it("freezes the resolved player instead of the next live lot", () => { const pool=[{status:"sold",round:1,player:{name:"Jasprit Bumrah"}},{status:"live",round:1,player:{name:"Virat Kohli"}}] as RoomPlayer[]; expect(resolvedLot({id:1,kind:"sold",message:"Jasprit Bumrah SOLD to Eagles for 2.5",created_at:""},pool)?.player.name).toBe("Jasprit Bumrah"); });
});