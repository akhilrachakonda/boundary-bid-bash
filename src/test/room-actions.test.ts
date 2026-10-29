import { describe, expect, it } from 'vitest';
import { bidArgs, hostActionArgs } from '@/lib/room-actions';
import type { Room } from '@/hooks/use-room';
const room={id:'room',current_rp:'lot',lot_version:7,status:'auction'} as Room;
describe('release action binding',()=>{
 it('binds bids to current lot, version, amount and retry identity',()=>{
  expect(bidArgs(room,2,'retry')).toEqual({p_room:'room',p_amount:2,p_lot:'lot',p_version:7,p_request:'retry'});
 });
 it('binds undo to the observed sale and room state',()=>{
  expect(hostActionArgs(room,'undo','sale')).toEqual({p_room:'room',p_action:'undo',p_version:7,p_status:'auction',p_sale:'sale'});
 });
});