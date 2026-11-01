import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Auction } from '@/components/room/Auction';
import { derive, type RoomData } from '@/components/auction/derive';
import { DEFAULT_SETTINGS, type Player } from '@/lib/auction-rules';

const network=vi.hoisted(()=>({rpc:vi.fn(),from:vi.fn()}));
const probes=vi.hoisted(()=>({profiles:0}));
vi.mock('@/integrations/supabase/client',()=>({supabase:network}));
vi.mock('@/components/auction/PlayerProfile',()=>({PlayerProfile:({children}:{children:React.ReactNode})=>{probes.profiles++;return <>{children}</>;}}));
vi.mock('@/components/auction/TeamDetails',()=>({TeamDetails:()=>null}));
vi.mock('@/components/room/PrivatePanel',()=>({PrivatePanel:()=>null}));
afterEach(()=>{cleanup();vi.useRealTimers();vi.clearAllMocks();});
function fixture(): RoomData {
 const player:Player={id:'player-1',name:'Jasprit Bumrah',country:'India',format:'IPL',role:'BOWL',sub_role:'Pace',batting_hand:'Right',bowling_style:'Pace',rating:98,base_price:2,nationality_type:'Indian',tier:'Marquee'};
 return {capabilities:{},room:{id:'room-1',code:'TEST',name:'LOCAL MOCK ONLY',host_id:'user-1',format:'IPL',settings:DEFAULT_SETTINGS,status:'auction',review_ends_at:null,current_rp:'lot-1',lot_version:7,current_bid:null,current_bidder:null,lot_ends_at:new Date(Date.now()+20000).toISOString(),paused_remaining_ms:null,accel_done:false,trade_ends_at:null},participants:[{id:'team-1',user_id:'user-1',nickname:'Mock',team_name:'Mock team',color:'var(--primary)',purse:100,is_ready:true,last_seen:new Date().toISOString()}],pool:[{id:'lot-1',player_id:player.id,player,set_name:'Marquee',lot_order:0,round:1,status:'live',sold_to:null,sold_price:null}],bids:[],squads:[],sales:[],trades:[],events:[],notes:{notes:'',targets:{},xi:{order:[],overs:{}}},saveNotes:vi.fn(),error:null,loaded:true,offset:0,connection:'connected',reload:vi.fn(async()=>null)};
}
describe('local mocked auction UI (no live backend)',()=>{
 it('shows pending immediately, ignores repeated clicks and unlocks on authoritative acceptance',async()=>{
  let finish:(reply:{data:number;error:null})=>void=()=>{};
  network.rpc.mockImplementation(()=>({abortSignal:()=>new Promise(resolve=>{finish=resolve;})}));
  const data=fixture(); render(<Auction data={data} d={derive(data,'user-1')} sound={false}/>);
  fireEvent.click(screen.getByRole('button',{name:'Bid ₹2 Cr'}));
  const pending=screen.getByRole('button',{name:'Confirming bid…'}); expect(pending).toBeDisabled();
  for(let i=0;i<100;i++)fireEvent.click(pending);
  expect(network.rpc).toHaveBeenCalledTimes(1);
  expect(network.rpc.mock.calls[0]?.[1]).toMatchObject({p_room:'room-1',p_lot:'lot-1',p_version:7,p_amount:2});
  await act(async()=>{finish({data:2,error:null});});
  expect(screen.getByRole('button',{name:'Bid accepted'})).toBeEnabled();
 });
 it('keeps host pause independent of a pending bid and coalesces duplicate host presses',async()=>{
  const replies=new Map<string,(reply:{data:unknown;error:null})=>void>();
  network.rpc.mockImplementation((name:string)=>({abortSignal:()=>new Promise(resolve=>{replies.set(name,resolve);})}));
  const data=fixture();render(<Auction data={data} d={derive(data,'user-1')} sound={false}/>);
  fireEvent.click(screen.getByRole('button',{name:'Bid ₹2 Cr'}));
  fireEvent.click(screen.getByRole('button',{name:'Pause'}));
  for(let i=0;i<20;i++)fireEvent.click(screen.getByRole('button',{name:'Pause'}));
  expect(network.rpc.mock.calls.map(call=>call[0])).toEqual(['place_bid','host_control']);
  await act(async()=>{replies.get('host_control')?.({data:null,error:null});replies.get('place_bid')?.({data:2,error:null});});
  expect(screen.getByRole('button',{name:'Pause'})).toBeEnabled();
 });
 it('clock ticks update only countdown controls, not the auction root',async()=>{
  vi.useFakeTimers();
  const data=fixture();render(<Auction data={data} d={derive(data,'user-1')} sound={false}/>);
  const profileRenders=probes.profiles;
  const portrait=screen.getAllByAltText('Jasprit Bumrah')[0];
  await act(async()=>{await vi.advanceTimersByTimeAsync(1000);});
  expect(screen.getByRole('timer')).toHaveAttribute('aria-label','19 seconds remaining');
  expect(screen.getAllByAltText('Jasprit Bumrah')[0]).toBe(portrait);expect(network.rpc).not.toHaveBeenCalled();
  expect(probes.profiles).toBe(profileRenders);
 });
});