import { useEffect, useRef, useState } from "react";
import { Check, Loader2, Pause, Play, SkipForward, Square, Undo2, Lock, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { bidBlockReason, formatMoney, nextBidAmount } from "@/lib/auction-rules";
import { unseenEvents, bidChange, pendingLots, saleSnapshot } from "@/lib/auction-presentation";
import { playHammer, playBid } from "@/lib/sound";
import { AuctionStage } from "@/components/auction/AuctionStage";
import { SaleReveal, type SaleSnapshot } from "@/components/auction/SaleReveal";
import { PlayerPortrait } from "@/components/auction/PlayerPortrait";
import { PlayerProfile } from "@/components/auction/PlayerProfile";
import type { RoomData, Derived } from "@/components/auction/derive";
import { PrivatePanel } from "./PrivatePanel";
import { rpc } from "./rpc";
import { BidBudget } from "@/components/auction/BidBudget";
import { TeamDetails } from "@/components/auction/TeamDetails";
import { bidArgs, hostActionArgs } from '@/lib/room-actions';
import { useBidRequest } from '@/hooks/use-bid-request';
import { useNow } from '@/hooks/use-room';
import { toast } from 'sonner';
import { repairsEnabled } from '@/lib/post-launch-controls';
import { PostLaunchDesk } from './PostLaunchDesk';

export function Auction({ data, d, sound }: { data: RoomData; d: Derived; sound: boolean }) {
  const room = data.room;
  const me = d.me;
  const bidRequest = useBidRequest(async () => { await data.reload('rooms'); await data.reload('bids'); });
  const [hostBusy, setHostBusy] = useState<string | null>(null);
  const hostPending = useRef(false);
  const [strategy,setStrategy] = useState(false);
  const [sale,setSale] = useState<SaleSnapshot|null>(null);
  const saleQueue = useRef<SaleSnapshot[]>([]);
  const [pulse,setPulse] = useState("");
  const [increment,setIncrement] = useState(0);
  const bidSeen = useRef(new Set<string|number>());
  const saleSeen = useRef(new Set<string|number>());
  const initialized = useRef(false);
  const previousPrice = useRef<number|null>(null);
  const previousConnection = useRef(data.connection);
  const reconnectCutoff = useRef(0);
  const soundRef = useRef(sound); soundRef.current = sound;
  const rp = data.pool.find(x=>x.id===room?.current_rp);
  const player = rp?.player;
  const lastSold=data.sales.find(x=>!x.undone && x.participant_id);
  const lastLot=lastSold ? data.pool.find(x=>x.id===lastSold.room_player_id) : null;
  const lastTeam=lastSold?.participant_id ? d.partById.get(lastSold.participant_id) : null;
  useEffect(() => {
    if (!data.loaded) return;
    const reconnect = previousConnection.current !== "connected" && data.connection === "connected";
    previousConnection.current = data.connection;
    if (!initialized.current || reconnect) {
      if (reconnect) reconnectCutoff.current = Date.now() + data.offset;
      unseenEvents(data.sales,saleSeen.current,false);
      saleQueue.current = []; setSale(null);
      unseenEvents(data.bids,bidSeen.current,false);
      previousPrice.current = room?.current_bid == null ? null : Number(room.current_bid);
      initialized.current = true;
      return;
    }
    const fresh = unseenEvents(data.bids,bidSeen.current,true);
    const bid = fresh[0];
    if (bid && bid.room_player_id===room?.current_rp) {
      setIncrement(bidChange(bid,previousPrice.current));
      previousPrice.current=Number(bid.amount); setPulse(bid.id);
      if(sound)playBid();
    }
    for (const record of [...data.sales].reverse()) {
      if (record.undone || saleSeen.current.has(record.id)) continue;
      if (new Date(record.created_at).getTime() <= reconnectCutoff.current) { saleSeen.current.add(record.id); continue; }
      const snapshot = saleSnapshot(record, data.pool, data.participants);
      // Do not consume IDs until the exact player and buyer can be resolved.
      if (snapshot) { saleSeen.current.add(record.id); saleQueue.current.push(snapshot); }
    }
    saleQueue.current = saleQueue.current.filter(snapshot => data.sales.some(record => record.id === snapshot.id && !record.undone)).slice(-8);
    if (sale && !data.sales.some(record => record.id === sale.id && !record.undone)) setSale(null);
    if (!sale && saleQueue.current.length) setSale(saleQueue.current.shift() ?? null);
  },[data.bids,data.sales,data.pool,data.participants,data.loaded,data.connection,d.partById,room?.current_bid,room?.current_rp,sound,sale]);
  useEffect(()=>{if(!sale)return;if(sale.kind==='sold' && soundRef.current)playHammer();const t=setTimeout(()=>setSale(saleQueue.current.shift() ?? null),2600);return()=>clearTimeout(t);},[sale]);
  useEffect(()=>{if(!pulse)return;const t=setTimeout(()=>{setPulse("");setIncrement(0);},1400);return()=>clearTimeout(t);},[pulse]);
  useEffect(()=>{previousPrice.current=null;},[room?.current_rp]);
  if(!room || !me) return null;
  const s=room.settings;
  const paused=room.status === "paused";
  const leader=room.current_bidder ? d.partById.get(room.current_bidder) : null;
  const amount=player ? nextBidAmount(s,room.current_bid == null ? null : Number(room.current_bid),Number(player.base_price)) : 0;
  const block=player ? bidBlockReason(s,Number(me.purse),d.myCounts,player,amount,room.current_bidder===me.id) : "Waiting for a player";
  const bid=()=>{
    const remaining = room.lot_ends_at ? new Date(room.lot_ends_at).getTime() - Date.now() - data.offset : 0;
    if(block || paused || remaining<=0 || data.connection!=="connected")return;
    void bidRequest.submit(bidArgs(room,amount,crypto.randomUUID()));
  };
  const hostAction=async(action:string, saleId?:string)=>{
    if (hostPending.current) return;
    hostPending.current=true;setHostBusy(action);
    try { await rpc("host_control",hostActionArgs(room,action,saleId),{timeoutMs:8000}); }
    catch { toast.warning("Host action outcome unconfirmed. Refreshing the room; no automatic retry."); }
    finally {
      try { await data.reload("rooms"); await Promise.all([data.reload("sales"),data.reload("bids"),data.reload("squads"),data.reload("participants")]); }
      catch { toast.warning("Could not refresh the room. Check the connection before another host action."); }
      finally { hostPending.current=false;setHostBusy(null); }
    }
  };
  const toggleStar=()=>{if(!player)return;const targets={...data.notes.targets};if(targets[player.id])delete targets[player.id];else targets[player.id]={};data.saveNotes({...data.notes,targets});};
  const upcoming=pendingLots(data.pool).slice(0,6);
  const roundPool=data.pool.filter(x=>x.round===(rp?.round ?? 1));
  const done=roundPool.filter(x=>x.status==="sold"||x.status==="unsold").length;
  return <div className="auction-room space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-2"><div className="flex flex-wrap items-center gap-3"><span className="live-indicator"/><h1 className="text-xl font-bold uppercase">Live auction</h1><span className="text-xs text-muted-foreground">{room.repair_flow ? `Round ${room.auction_round??1}` : rp?.round===2 ? "Accelerated" : "First round"} · {done+1} / {roundPool.length} lots</span></div><Button variant="outline" size="sm" onClick={()=>setStrategy(true)}><Lock className="h-3.5 w-3.5"/>My strategy<ChevronRight className="h-3.5 w-3.5"/></Button></div>
    {player && <AuctionStage player={player} currency={s.currency} price={room.current_bid == null ? Number(player.base_price):Number(room.current_bid)} leader={leader ? {name:leader.team_name,color:leader.color}:null} remaining={0} clock={{endsAt:room.lot_ends_at,offset:data.offset,paused,pausedRemaining:room.paused_remaining_ms??0}} total={s.bid_timer*1000} paused={paused} connection={data.connection} label={`${room.format} / ${rp?.round===2 ? "Accelerated round" : "First round"}`} bids={data.bids.filter(b=>b.room_player_id===room.current_rp).map(b=>({id:b.id,amount:Number(b.amount),team:d.partById.get(b.participant_id)?.team_name??"Team",color:d.partById.get(b.participant_id)?.color??"var(--electric)",time:new Date(b.created_at).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit",second:"2-digit"})}))} pulse={pulse} increment={increment} starred={!!data.notes.targets[player.id]} onStar={toggleStar}>
      <div className="bid-bar bid-bar-budget"><BidBudget settings={s} purse={Number(me.purse)} counts={d.myCounts} player={player} blocked={d.myCounts.total>=s.max_squad || (player.nationality_type==="Overseas" && d.myCounts.overseas>=s.max_overseas)} /><LiveBidButton block={block} data={data} paused={paused} amount={amount} state={bidRequest.state} accepted={bidRequest.accepted} onBid={bid} onRetry={()=>void bidRequest.retry()}/></div>
    </AuctionStage>}
    {repairsEnabled(room,data.capabilities) ? <PostLaunchDesk data={data} d={d}/> : d.isHost && <div className="flex flex-wrap gap-2 border-b pb-4" aria-busy={!!hostBusy}><span className="mr-2 self-center text-xs uppercase text-muted-foreground">Host desk {hostBusy && <Loader2 className="inline h-4 w-4 animate-spin"/>}</span><Button variant="outline" size="sm" className="min-h-11" disabled={!!hostBusy} onClick={()=>void hostAction(paused?"resume":"pause")}>{paused?<Play className="h-3.5 w-3.5"/>:<Pause className="h-3.5 w-3.5"/>}{paused?"Resume":"Pause"}</Button><Button variant="outline" size="sm" className="min-h-11" disabled={!!hostBusy} onClick={()=>void hostAction("skip")}><SkipForward className="h-3.5 w-3.5"/>Skip player</Button><Confirm disabled={!!hostBusy || !lastSold} label="Undo last sale" icon={<Undo2 className="h-3.5 w-3.5"/>} desc="Return the last sold player and refund their buyer." onYes={()=>void hostAction("undo",lastSold?.id)}/><Confirm disabled={!!hostBusy} label="End auction" icon={<Square className="h-3.5 w-3.5"/>} desc="Mark all remaining players unsold?" onYes={()=>void hostAction("end")}/></div>}
    {lastSold && lastLot && lastTeam && <section aria-label="Last sold" className="flex flex-wrap items-center gap-3 border-y py-3"><span className="text-xs uppercase text-gold">Last sold</span><PlayerProfile player={lastLot.player} currency={s.currency}><div className="flex items-center gap-3"><PlayerPortrait player={lastLot.player} className="h-16 w-12 rounded" /><strong>{lastLot.player.name}</strong></div></PlayerProfile><TeamDetails name={lastTeam.team_name} players={d.squadOf(lastTeam.id)} price={lastSold.price} currency={s.currency}/></section>}
    {s.surprise_reveal ? <section className="flex items-center gap-4 border border-electric/30 bg-secondary/30 p-5"><span className="font-display text-6xl text-electric" aria-hidden="true">?</span><div><h3 className="text-xl font-bold uppercase">Surprise player reveal</h3><p className="text-sm text-muted-foreground">{data.pool.filter(x=>x.status==="pending").length} players remaining in this round · next identity revealed when the lot opens</p></div></section> : <section><div className="mb-3 flex items-center justify-between"><h3 className="text-lg font-bold uppercase">Coming up next</h3><span className="text-xs text-muted-foreground">{upcoming.length ? "Next on the block" : "Final lot"}</span></div><div className="upcoming-strip">{upcoming.map(x=><PlayerProfile key={x.id} player={x.player} currency={s.currency}><div className="upcoming-player"><PlayerPortrait player={x.player} className="h-20 w-16 shrink-0 rounded-md"/><div className="min-w-0"><p className="truncate font-display text-lg font-semibold uppercase">{x.player.name}</p><p className="text-xs text-muted-foreground">{x.player.sub_role}</p><p className="mt-1 text-xs text-primary">{formatMoney(Number(x.player.base_price),s.currency)}</p></div></div></PlayerProfile>)}</div></section>}
    <Sheet open={strategy} onOpenChange={setStrategy}><SheetContent className="w-full overflow-y-auto sm:max-w-lg"><SheetTitle className="font-display text-3xl uppercase">My strategy</SheetTitle><SheetDescription>{me.team_name} · Private team desk</SheetDescription><div className="mt-5"><PrivatePanel data={data} d={d}/></div></SheetContent></Sheet>
    {sale && <SaleReveal key={sale.id} sale={sale} currency={s.currency}/>}
  </div>;
}

export function AuctionLog({ data }: { data: RoomData }) {
  return (
    <div className="panel p-4">
      <h4 className="mb-2 text-lg font-bold uppercase">Auction log</h4>
      <ul className="max-h-56 space-y-1 overflow-y-auto text-sm">
        {data.events.map((e) => (
          <li key={e.id} className={cn(e.kind === "sold" && "text-success", e.kind === "unsold" && "text-muted-foreground", e.kind === "trade" && "text-electric")}>
            <span className="mr-2 text-xs text-muted-foreground tabular">{new Date(e.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
            {e.message}
          </li>
        ))}
      </ul>
    </div>
  );
}

function LiveBidButton({ data, paused, block, amount, state, accepted, onBid, onRetry }: { data: RoomData; paused: boolean; block: string | null; amount: number; state: "idle"|"pending"|"uncertain"; accepted: boolean; onBid:()=>void; onRetry:()=>void }) {
  const now=useNow(data.offset,250);
  const room=data.room;
  if(!room)return null;
  const expired=!room.lot_ends_at || new Date(room.lot_ends_at).getTime()<=now;
  const uncertain=state==='uncertain';
  return <Button onClick={uncertain?onRetry:onBid} disabled={state==='pending'||(!uncertain&&(!!block||paused||expired||data.connection!=="connected"))} className={cn("bid-action h-16 w-full flex-1 bg-gold font-display text-2xl font-bold uppercase text-primary-foreground",accepted&&"bid-accepted")} aria-busy={state==='pending'}>{state==='pending'?<><Loader2 className="h-5 w-5 animate-spin"/>Confirming bid…</>:uncertain?"Check & retry same bid":accepted?<><Check className="h-5 w-5"/>Bid accepted</>:paused?"Auction paused":data.connection!=="connected"?"Reconnecting…":expired?"Hammer falling…":block??`Bid ${formatMoney(amount,room.settings.currency)}`}</Button>;
}

function Confirm({ label, icon, desc, onYes, disabled }: { label: string; icon: React.ReactNode; desc: string; onYes: () => void; disabled?:boolean }) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="outline" className="min-h-11" disabled={disabled}>{icon} {label}</Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{label}?</AlertDialogTitle>
          <AlertDialogDescription>{desc}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onYes}>{label}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
