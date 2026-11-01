import { describe, it, expect } from 'vitest';
import { repairsEnabled, auctionCommandArgs, validTimers } from '../lib/post-launch-controls';
import type { Room } from '../hooks/use-room';
const room = { id:'room',current_rp:'lot',lot_version:7,status:'auction',control_revision:4,repair_flow:true } as Room;
describe('repair activation and guards',()=>{
 it('never enables absent backend functions',()=>expect(repairsEnabled(room,{})).toBe(false));
 it('keeps historical rooms on old flow',()=>expect(repairsEnabled({...room,repair_flow:false},{auction_controls:1})).toBe(false));
 it('binds host commands to observed lot, version, stage and revision',()=>expect(auctionCommandArgs(room,'undo_bid','retry',{bid_id:'bid'})).toEqual({p_room:'room',p_action:'undo_bid',p_lot:'lot',p_version:7,p_status:'auction',p_revision:4,p_request:'retry',p_payload:{bid_id:'bid'}}));
 it('accepts exact timer bounds',()=>{expect(validTimers(1,120)).toBe(true);expect(validTimers(0,120)).toBe(false);expect(validTimers(121,1)).toBe(false);expect(validTimers(1,1.5)).toBe(false);});
});