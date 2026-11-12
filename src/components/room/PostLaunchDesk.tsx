import { useEffect, useRef, useState } from 'react';
import { Settings2, RotateCcw, Undo2, Gavel } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Sheet, SheetContent, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel } from '@/components/ui/alert-dialog';
import { auctionCommandArgs, validTimers } from '@/lib/post-launch-controls';
import { supabase } from '@/integrations/supabase/client';
import type { RoomData, Derived } from '@/components/auction/derive';
import { rpc } from './rpc';
import { toast } from 'sonner';
import {minutesValid} from '@/lib/community';
import { createRefetchCoordinator } from '@/lib/refetch-coordinator';
import type { LiveProjection } from '@/lib/live-projection';

export function PostLaunchDesk({data,d}:{data:RoomData;d:Derived}) {
 const room=data.room;
 const [open,setOpen]=useState(false);const [busy,setBusy]=useState(false);const flight=useRef(false);
 const [timer,setTimer]=useState(room?.settings.bid_timer??20);const [extension,setExtension]=useState(room?.settings.bid_reset??10);
 const [tradeMinutes,setTradeMinutes]=useState(String(room?.settings.trade_minutes??10));
 const [nominations,setNominations]=useState<string[]>([]);
 const nominationQueue=useRef<ReturnType<typeof createRefetchCoordinator<'nominations'>>|null>(null);
 useEffect(()=>{
  if(!room||room.auction_stage!=='final_call'){setNominations([]);return;}
  let alive=true;
  const queue=createRefetchCoordinator<'nominations'>(async()=>{
   const {data:rows,error}=await supabase.from('auction_nominations' as never).select('room_player_id').eq('room_id',room.id).abortSignal(AbortSignal.timeout(5000));
   if(alive&&!error)setNominations([...new Set((rows as unknown as {room_player_id:string}[]??[]).map(n=>n.room_player_id))].sort());
  });
  nominationQueue.current=queue;queue.schedule('nominations');
  const interval=setInterval(()=>queue.schedule('nominations'),2500);
  return()=>{alive=false;clearInterval(interval);queue.dispose();nominationQueue.current=null;};
 },[room?.id,room?.auction_stage,room?.status]);
 useEffect(()=>{
  if(open&&room){setTimer(room.next_lot_settings?.bid_timer??room.settings.bid_timer);setExtension(room.next_lot_settings?.bid_reset??room.settings.bid_reset);}
 },[open,room?.id,room?.settings.bid_timer,room?.settings.bid_reset,room?.next_lot_settings?.bid_timer,room?.next_lot_settings?.bid_reset]);
 if(!room)return null;
 const run=async(action:string,payload:Record<string,unknown>={})=>{
  if(flight.current)return;flight.current=true;setBusy(true);
  let reconciled = false;
  try{
   const sync = action !== 'nominate' && data.capabilities.action_sync === 1;
   const result=await rpc<{live?:LiveProjection}>(action==='nominate'?'nominate_unsold':sync?'auction_command_and_sync':'auction_command',action==='nominate'?{p_room:room.id,p_lot:payload['lot'],p_version:room.lot_version,p_revision:room.control_revision??0}:auctionCommandArgs(room,action,crypto.randomUUID(),payload),{timeoutMs:8000});
   if (sync && result?.live) reconciled = data.applyLive(result.live);
   if(result&&action==='settings'){toast.success('Saved for the next player');setOpen(false);}
  }catch{toast.warning('Action outcome unconfirmed. Refreshing; no automatic retry.');}
  finally{
   try{if (!reconciled) {await data.reload('rooms');await Promise.all((['bids','sales','squads','participants'] as const).map(table=>data.reload(table)));}nominationQueue.current?.schedule('nominations');}
   catch{toast.warning('Could not refresh. Check your connection before another action.');}
   finally{flight.current=false;setBusy(false);}
  }
 };
 const final=room.status==='completed'&&room.auction_stage==='final_call';
 const latest=data.bids.find(b=>b.room_player_id===room.current_rp&&b.lot_session===room.bid_session&&!b.undone);
 const lastSale=data.sales.find(s=>!s.undone&&s.participant_id);
 return <section className="space-y-4 border-y py-4 [&_button]:min-h-11" aria-label="Auction control desk" aria-busy={busy}>
  {room.next_lot_settings?.bid_timer&&<p role="status" className="text-sm text-electric">Saved for next lot: {room.next_lot_settings.bid_timer}s timer · {room.next_lot_settings.bid_reset}s extension</p>}
  {d.isHost&&<div className="flex flex-wrap gap-2">
   {!final&&<><Button variant="outline" disabled={busy} onClick={()=>run(room.status==='paused'?'resume':'pause')}>{room.status==='paused'?'Resume':'Pause'}</Button><Button variant="outline" disabled={busy} onClick={()=>run('skip')}>Skip player</Button><Button variant="outline" disabled={busy||!latest} onClick={()=>run('undo_bid',{bid_id:latest?.id})}><Undo2/>Undo last bid</Button></>}
   <Button variant="outline" disabled={busy||!lastSale} onClick={()=>run('undo_sale',{sale_id:lastSale?.id})}><RotateCcw/>Undo last sale</Button>
   <Button variant="outline" onClick={()=>setOpen(true)}><Settings2/>Lot settings</Button>
   {!final&&<Button variant="outline" disabled={busy} onClick={()=>run('final_call')}>End rounds · final call</Button>}
   {final&&<><Button variant="outline" disabled={busy} onClick={()=>run('rerun')}><RotateCcw/>Shuffle unsold round {(room.auction_round??1)+1}</Button><AlertDialog><AlertDialogTrigger asChild><Button disabled={busy}>Close auction &amp; open trades</Button></AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Close all auction purchases?</AlertDialogTitle><AlertDialogDescription>{nominations.length} pending nominated players: {nominations.map(id=>data.pool.find(p=>p.id===id)?.player.name??'Player').join(', ')||'None'}. These nominations will be dismissed. Choose the trade duration below.</AlertDialogDescription></AlertDialogHeader><label className="grid gap-2 text-sm">Trade duration (minutes)<Input aria-label="Trade duration" inputMode="numeric" value={tradeMinutes} onChange={e=>setTradeMinutes(e.target.value)}/></label><AlertDialogFooter><AlertDialogCancel>Keep final call open</AlertDialogCancel><AlertDialogAction disabled={!minutesValid(tradeMinutes)} onClick={()=>run('close_trades',{pending:nominations,minutes:Number(tradeMinutes)})}>Close &amp; open trades</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog></>}
  </div>}
  {!final&&<p className="text-xs text-muted-foreground">Bid undo restores the prior leader and leaves at least one extension window; sale undo refunds the buyer.</p>}
  {final&&<><h1 className="font-display text-3xl uppercase">Final call · round {room.auction_round??1} finished</h1><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{data.pool.filter(p=>p.status==='unsold').map(p=><div key={p.id} className="flex flex-wrap items-center gap-2 border-b py-3"><span className="min-w-0 flex-1 font-semibold">{p.player.name}</span><Button size="sm" variant="outline" disabled={busy||nominations.includes(p.id)} onClick={()=>run('nominate',{lot:p.id})}> {nominations.includes(p.id)?'Nominated':'Nominate'}</Button>{d.isHost&&nominations.includes(p.id)&&<Button size="icon" aria-label={`Open competitive bidding for ${p.player.name}`} disabled={busy} onClick={()=>run('open_nomination',{nomination:p.id})}><Gavel/></Button>}</div>)}</div>{!data.pool.some(p=>p.status==='unsold')&&<p>No unsold players remain.</p>}</>}
  <Sheet open={open} onOpenChange={setOpen}><SheetContent className="overflow-y-auto"><SheetTitle>Next-lot settings</SheetTitle><SheetDescription>Current and paused deadlines stay unchanged. Purse, roster and scoring rules are locked.</SheetDescription><div className="mt-6 space-y-4"><Label htmlFor="lot-timer">Timer · seconds</Label><Input id="lot-timer" type="number" min={1} max={120} value={timer} onChange={e=>setTimer(Number(e.target.value))}/><Label htmlFor="lot-extension">Bid extension · seconds</Label><Input id="lot-extension" type="number" min={1} max={120} value={extension} onChange={e=>setExtension(Number(e.target.value))}/><Button disabled={busy||!validTimers(timer,extension)} onClick={()=>run('settings',{bid_timer:timer,bid_reset:extension})}>Save for next lot</Button></div></SheetContent></Sheet>
 </section>;
}
