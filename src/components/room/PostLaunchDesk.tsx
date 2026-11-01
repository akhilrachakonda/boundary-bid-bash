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

export function PostLaunchDesk({data,d}:{data:RoomData;d:Derived}) {
 const room=data.room;
 const [open,setOpen]=useState(false);const [busy,setBusy]=useState(false);const flight=useRef(false);
 const [timer,setTimer]=useState(room?.settings.bid_timer??20);const [extension,setExtension]=useState(room?.settings.bid_reset??10);
 const [nominations,setNominations]=useState<string[]>([]);
 useEffect(()=>{if(!room||room.auction_stage!=='final_call')return;
  let alive=true;const load=async()=>{const {data:rows}=await supabase.from('auction_nominations' as never).select('room_player_id').eq('room_id',room.id);if(alive)setNominations([...new Set((rows as unknown as {room_player_id:string}[]??[]).map(n=>n.room_player_id))].sort());};
  void load();const interval=setInterval(load,2500);return()=>{alive=false;clearInterval(interval);};
 },[room?.id,room?.auction_stage,room?.status]);
 if(!room)return null;
 const run=async(action:string,payload={})=>{if(flight.current)return;flight.current=true;setBusy(true);try{await rpc('auction_command',auctionCommandArgs(room,action,crypto.randomUUID(),payload));await data.reload('rooms');await data.reload('bids');}finally{flight.current=false;setBusy(false);}};
 const final=room.status==='completed'&&room.auction_stage==='final_call';
 const latest=data.bids.find(b=>b.room_player_id===room.current_rp&&!b.undone);
 const lastSale=data.sales.find(s=>!s.undone&&s.participant_id);
 return <section className="space-y-4 border-y py-4" aria-label="Auction control desk">
  {room.next_lot_settings?.bid_timer&&<p role="status" className="text-sm text-electric">Saved for next lot: {room.next_lot_settings.bid_timer}s timer · {room.next_lot_settings.bid_reset}s extension</p>}
  {d.isHost&&<div className="flex flex-wrap gap-2">
   {!final&&<><Button variant="outline" disabled={busy} onClick={()=>run(room.status==='paused'?'resume':'pause')}>{room.status==='paused'?'Resume':'Pause'}</Button><Button variant="outline" disabled={busy} onClick={()=>run('skip')}>Skip player</Button><Button variant="outline" disabled={busy||!latest} onClick={()=>run('undo_bid',{bid_id:latest?.id})}><Undo2/>Undo last bid</Button></>}
   <Button variant="outline" disabled={busy||!lastSale} onClick={()=>run('undo_sale',{sale_id:lastSale?.id})}><RotateCcw/>Undo last sale</Button>
   <Button variant="outline" onClick={()=>setOpen(true)}><Settings2/>Lot settings</Button>
   {!final&&<Button variant="outline" disabled={busy} onClick={()=>run('final_call')}>End rounds · final call</Button>}
   {final&&<><Button variant="outline" disabled={busy} onClick={()=>run('rerun')}><RotateCcw/>Shuffle unsold round {(room.auction_round??1)+1}</Button><AlertDialog><AlertDialogTrigger asChild><Button disabled={busy}>Close auction &amp; open trades</Button></AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Close all auction purchases?</AlertDialogTitle><AlertDialogDescription>{nominations.length} pending nominated players: {nominations.map(id=>data.pool.find(p=>p.id===id)?.player.name??'Player').join(', ')||'None'}. These nominations will be dismissed. Trading lasts 10 minutes.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Keep final call open</AlertDialogCancel><AlertDialogAction onClick={()=>run('close_trades',{pending:nominations,minutes:10})}>Close &amp; open trades</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog></>}
  </div>}
  {!final&&<p className="text-xs text-muted-foreground">Bid undo restores the prior leader and leaves at least one extension window; sale undo refunds the buyer.</p>}
  {final&&<><h1 className="font-display text-3xl uppercase">Final call · round {room.auction_round??1} finished</h1><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{data.pool.filter(p=>p.status==='unsold').map(p=><div key={p.id} className="flex flex-wrap items-center gap-2 border-b py-3"><span className="min-w-0 flex-1 font-semibold">{p.player.name}</span><Button size="sm" variant="outline" disabled={busy||nominations.includes(p.id)} onClick={async()=>{await rpc('nominate_unsold',{p_room:room.id,p_lot:p.id,p_version:room.lot_version,p_revision:room.control_revision??0});}}> {nominations.includes(p.id)?'Nominated':'Nominate'}</Button>{d.isHost&&nominations.includes(p.id)&&<Button size="icon" aria-label={`Open competitive bidding for ${p.player.name}`} disabled={busy} onClick={()=>run('open_nomination',{nomination:p.id})}><Gavel/></Button>}</div>)}</div>{!data.pool.some(p=>p.status==='unsold')&&<p>No unsold players remain.</p>}</>}
  <Sheet open={open} onOpenChange={setOpen}><SheetContent className="overflow-y-auto"><SheetTitle>Next-lot settings</SheetTitle><SheetDescription>Current and paused deadlines stay unchanged. Purse, roster and scoring rules are locked.</SheetDescription><div className="mt-6 space-y-4"><Label htmlFor="lot-timer">Timer · seconds</Label><Input id="lot-timer" type="number" min={1} max={120} value={timer} onChange={e=>setTimer(Number(e.target.value))}/><Label htmlFor="lot-extension">Bid extension · seconds</Label><Input id="lot-extension" type="number" min={1} max={120} value={extension} onChange={e=>setExtension(Number(e.target.value))}/><Button disabled={busy||!validTimers(timer,extension)} onClick={()=>run('settings',{bid_timer:timer,bid_reset:extension})}>Save for next lot</Button></div></SheetContent></Sheet>
 </section>;
}