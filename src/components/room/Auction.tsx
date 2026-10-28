import { useEffect, useRef, useState } from "react";
import { Check, Loader2, Pause, Play, SkipForward, Square, Undo2, Lock, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { bidBlockReason, formatMoney, nextBidAmount } from "@/lib/auction-rules";
import { unseenEvents, resolvedLot, bidChange, pendingLots } from "@/lib/auction-presentation";
import { playHammer, playBid } from "@/lib/sound";
import { AuctionStage } from "@/components/auction/AuctionStage";
import { SaleReveal, type SaleSnapshot } from "@/components/auction/SaleReveal";
import { PlayerPortrait } from "@/components/auction/PlayerPortrait";
import { PlayerProfile } from "@/components/auction/PlayerProfile";
import type { RoomData, Derived } from "@/components/auction/derive";
import { PrivatePanel } from "./PrivatePanel";
import { rpc } from "./rpc";
import { BidBudget } from "@/components/auction/BidBudget";

export function Auction({ data, d, now, sound }: { data: RoomData; d: Derived; now: number; sound: boolean }) {
  const room = data.room;
  const me = d.me;
  const [busy,setBusy] = useState(false);
  const pending = useRef(false);
  const [accepted,setAccepted] = useState(false);
  const [strategy,setStrategy] = useState(false);
  const [sale,setSale] = useState<SaleSnapshot|null>(null);
  const [pulse,setPulse] = useState("");
  const [increment,setIncrement] = useState(0);
  const bidSeen = useRef(new Set<string|number>());
  const eventSeen = useRef(new Set<string|number>());
  const initialized = useRef(false);
  const previousPrice = useRef<number|null>(null);
  const previousConnection = useRef(data.connection);
  const rp = data.pool.find(x=>x.id===room?.current_rp);
  const player = rp?.player;
  useEffect(() => {
    if (!data.loaded) return;
    const reconnect = previousConnection.current !== "connected" && data.connection === "connected";
    previousConnection.current = data.connection;
    if (!initialized.current || reconnect) {
      unseenEvents(data.events,eventSeen.current,false);
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
    const event = data.events.find(e => (e.kind === "sold" || e.kind === "unsold") && !eventSeen.current.has(e.id));
    if (event) {
      const lot = resolvedLot(event,data.pool);
      if (lot) {
        eventSeen.current.add(event.id);
        const buyer=lot.sold_to ? d.partById.get(lot.sold_to) : null;
        setSale({id:event.id,kind:event.kind as "sold"|"unsold",player:{...lot.player},price:lot.sold_price == null ? null : Number(lot.sold_price),...(buyer ? {team:{name:buyer.team_name,color:buyer.color}} : {})});
        if(event.kind === "sold" && sound) playHammer();
      }
    }
  },[data.bids,data.events,data.pool,data.loaded,data.connection,d.partById,room?.current_bid,room?.current_rp,sound]);
  useEffect(()=>{if(!sale)return;const t=setTimeout(()=>setSale(null),3200);return()=>clearTimeout(t);},[sale]);
  useEffect(()=>{if(!pulse)return;const t=setTimeout(()=>{setPulse("");setIncrement(0);},1400);return()=>clearTimeout(t);},[pulse]);
  useEffect(()=>{previousPrice.current=null;},[room?.current_rp]);
  if(!room || !me) return null;
  const s=room.settings;
  const paused=room.status === "paused";
  const remaining=paused ? room.paused_remaining_ms ?? 0 : room.lot_ends_at ? new Date(room.lot_ends_at).getTime()-now : 0;
  const leader=room.current_bidder ? d.partById.get(room.current_bidder) : null;
  const amount=player ? nextBidAmount(s,room.current_bid == null ? null : Number(room.current_bid),Number(player.base_price)) : 0;
  const block=player ? bidBlockReason(s,Number(me.purse),d.myCounts,player,amount,room.current_bidder===me.id) : "Waiting for a player";
  const bid=async()=>{
    if(block || pending.current || paused || remaining<=0 || data.connection!=="connected")return;
    pending.current=true;setBusy(true);
    try { const result=await rpc("place_bid",{p_room:room.id,p_amount:amount}); if(result!==undefined){setAccepted(true);setTimeout(()=>setAccepted(false),700);} }
    finally {pending.current=false;setBusy(false);}
  };
  const toggleStar=()=>{if(!player)return;const targets={...data.notes.targets};if(targets[player.id])delete targets[player.id];else targets[player.id]={};data.saveNotes({...data.notes,targets});};
  const upcoming=pendingLots(data.pool).slice(0,6);
  const roundPool=data.pool.filter(x=>x.round===(rp?.round ?? 1));
  const done=roundPool.filter(x=>x.status==="sold"||x.status==="unsold").length;
  return <div className="auction-room space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-2"><div className="flex items-center gap-3"><span className="live-indicator"/><h1 className="text-xl font-bold uppercase">Live auction</h1><span className="text-xs text-muted-foreground">{rp?.round===2 ? "Accelerated" : "First round"} · {done+1} / {roundPool.length} lots</span></div><Button variant="outline" size="sm" onClick={()=>setStrategy(true)}><Lock className="h-3.5 w-3.5"/>My strategy<ChevronRight className="h-3.5 w-3.5"/></Button></div>
    {player && <AuctionStage player={player} currency={s.currency} price={room.current_bid == null ? Number(player.base_price):Number(room.current_bid)} leader={leader ? {name:leader.team_name,color:leader.color}:null} remaining={remaining} total={s.bid_timer*1000} paused={paused} connection={data.connection} label={`${room.format} / ${rp?.round===2 ? "Accelerated round" : "First round"}`} bids={data.bids.filter(b=>b.room_player_id===room.current_rp).map(b=>({id:b.id,amount:Number(b.amount),team:d.partById.get(b.participant_id)?.team_name??"Team",color:d.partById.get(b.participant_id)?.color??"var(--electric)",time:new Date(b.created_at).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit",second:"2-digit"})}))} pulse={pulse} increment={increment} starred={!!data.notes.targets[player.id]} onStar={toggleStar}>
      <div className="bid-bar bid-bar-budget"><BidBudget settings={s} purse={Number(me.purse)} counts={d.myCounts} player={player} blocked={d.myCounts.total>=s.max_squad || (player.nationality_type==="Overseas" && d.myCounts.overseas>=s.max_overseas)} /><Button onClick={bid} disabled={!!block||busy||paused||remaining<=0||data.connection!=="connected"} className={cn("bid-action h-16 w-full flex-1 bg-gold font-display text-2xl font-bold uppercase text-primary-foreground",accepted&&"bid-accepted")} aria-busy={busy}>{busy ? <><Loader2 className="h-5 w-5 animate-spin"/>Confirming bid…</> : accepted ? <><Check className="h-5 w-5"/>Bid accepted</> : paused ? "Auction paused" : data.connection!=="connected" ? "Reconnecting…" : remaining<=0 ? "Hammer falling…" : block ?? `Bid ${formatMoney(amount,s.currency)}`}</Button></div>
    </AuctionStage>}
    {d.isHost && <div className="flex flex-wrap gap-2 border-b pb-4"><span className="mr-2 self-center text-xs uppercase text-muted-foreground">Host desk</span><Button variant="outline" size="sm" onClick={()=>rpc("host_control",{p_room:room.id,p_action:paused?"resume":"pause"})}>{paused?<Play className="h-3.5 w-3.5"/>:<Pause className="h-3.5 w-3.5"/>}{paused?"Resume":"Pause"}</Button><Button variant="outline" size="sm" onClick={()=>rpc("host_control",{p_room:room.id,p_action:"skip"})}><SkipForward className="h-3.5 w-3.5"/>Skip player</Button><Confirm label="Undo last sale" icon={<Undo2 className="h-3.5 w-3.5"/>} desc="Return the last sold player and refund their buyer." onYes={()=>rpc("host_control",{p_room:room.id,p_action:"undo"})}/><Confirm label="End auction" icon={<Square className="h-3.5 w-3.5"/>} desc="Mark all remaining players unsold?" onYes={()=>rpc("host_control",{p_room:room.id,p_action:"end"})}/></div>}
    <section><div className="mb-3 flex items-center justify-between"><h3 className="text-lg font-bold uppercase">Coming up next</h3><span className="text-xs text-muted-foreground">{upcoming.length ? "Next on the block" : "Final lot"}</span></div><div className="upcoming-strip">{upcoming.map(x=><PlayerProfile key={x.id} player={x.player} currency={s.currency}><div className="upcoming-player"><PlayerPortrait player={x.player} priority className="h-20 w-16 shrink-0 rounded-md"/><div className="min-w-0"><p className="truncate font-display text-lg font-semibold uppercase">{x.player.name}</p><p className="text-xs text-muted-foreground">{x.player.sub_role}</p><p className="mt-1 text-xs text-primary">{formatMoney(Number(x.player.base_price),s.currency)}</p></div></div></PlayerProfile>)}</div></section>
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

function Confirm({ label, icon, desc, onYes }: { label: string; icon: React.ReactNode; desc: string; onYes: () => void }) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="outline">{icon} {label}</Button>
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
