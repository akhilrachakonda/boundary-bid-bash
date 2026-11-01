import { describe, expect, it } from "vitest";
import { unseenEvents, bidChange, resolvedLot, saleSnapshot } from "@/lib/auction-presentation";
import type { Bid, RoomPlayer, Sale, Participant } from "@/hooks/use-room";
describe("auction presentation event rules", () => {
  it("shows the first sale after an initially empty loaded feed", () => { const seen=new Set<string|number>(); unseenEvents([],seen,false); expect(unseenEvents([{id:1}],seen,true)).toEqual([{id:1}]); });
  it("does not replay historic sales on initial load or reconnect", () => { const seen=new Set<string|number>(); expect(unseenEvents([{id:5}],seen,false)).toEqual([]); expect(unseenEvents([{id:5}],seen,true)).toEqual([]); });
  it("uses unique IDs even when two events have the same amount", () => { const seen=new Set<string|number>(["a"]); expect(unseenEvents([{id:"b",amount:2}],seen,true)).toHaveLength(1); });
  it("shows the accepted increment without changing the legal bid", () => { expect(bidChange({amount:2.5} as Bid,2.25)).toBe(0.25); });
  it("freezes the resolved player instead of the next live lot", () => { const pool=[{status:"sold",round:1,player:{name:"Jasprit Bumrah"}},{status:"live",round:1,player:{name:"Virat Kohli"}}] as RoomPlayer[]; expect(resolvedLot({id:1,kind:"sold",message:"Jasprit Bumrah SOLD to Eagles for 2.5",created_at:""},pool)?.player.name).toBe("Jasprit Bumrah"); });
  it("uses the exact sale identity and price even if that lot has since reopened", () => {
    const pool=[{id:'rp1',status:'live',sold_price:null,player:{name:'Jasprit Bumrah'}}] as RoomPlayer[];
    const sale={id:'sale1',room_player_id:'rp1',participant_id:'team1',price:2.5,undone:false} as Sale;
    const snap=saleSnapshot(sale,pool,[{id:'team1',team_name:'Eagles',color:'var(--primary)'}] as Participant[]);
    expect(snap).toMatchObject({id:'sale1',kind:'sold',price:2.5,team:{name:'Eagles'},player:{name:'Jasprit Bumrah'}});
    const lot=pool[0]; if(lot)lot.player.name='changed'; expect(snap?.player.name).toBe('Jasprit Bumrah');
  });
  it("handles unsold without inventing a buyer and never celebrates an undone sale", () => {
    const pool=[{id:'rp1',player:{name:'Jasprit Bumrah'}}] as RoomPlayer[];
    const sale={id:'sale1',room_player_id:'rp1',participant_id:null,price:null,undone:false} as Sale;
    expect(saleSnapshot(sale,pool,[])).toMatchObject({kind:'unsold',price:null});
    expect(saleSnapshot({...sale,undone:true},pool,[])).toBeNull();
    expect(saleSnapshot({...sale,participant_id:'missing'},pool,[])).toBeNull();
  });
});