import { useEffect, useState } from "react";
import { RotateCcw, Gavel } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AuctionStage, type StageBid } from "./AuctionStage";
import { SaleReveal, type SaleSnapshot } from "./SaleReveal";
import { DEFAULT_SETTINGS, nextBidAmount, formatMoney, type Player } from "@/lib/auction-rules";
import { withCanonicalPhoto } from "@/lib/player-photos";

const demoPlayer=withCanonicalPhoto({id:"demo-bumrah",name:"Jasprit Bumrah",country:"India",format:"IPL",role:"BOWL",sub_role:"Pace",batting_hand:"Right",bowling_style:"Right-arm fast",rating:98,base_price:2.25,nationality_type:"Indian",tier:"Marquee"} as Player);
export function AuctionDemo() {
  const [bids,setBids]=useState<StageBid[]>([{id:"demo-1",amount:4.25,team:"Coastal Kings",color:"var(--electric)"},{id:"demo-0",amount:4,team:"Royal Strikers",color:"var(--primary)"}]);
  const [remaining,setRemaining]=useState(18000);
  const [pulse,setPulse]=useState("");
  const [increment,setIncrement]=useState(0);
  const [sale,setSale]=useState<SaleSnapshot|null>(null);
  const [finished,setFinished]=useState(false);
  const leader=bids[0];
  const current=leader?.amount ?? 4.25;
  const next=nextBidAmount(DEFAULT_SETTINGS,current,2.25);
  useEffect(()=>{const t=setInterval(()=>setRemaining(v=>Math.max(0,v-100)),100);return()=>clearInterval(t);},[]);
  useEffect(()=>{if(remaining>0||finished||!leader)return;setFinished(true);setSale({id:1,kind:"sold",player:demoPlayer,team:{name:leader.team,color:leader.color},price:leader.amount});},[remaining,finished,leader]);
  useEffect(()=>{if(!sale)return;const t=setTimeout(()=>setSale(null),3200);return()=>clearTimeout(t);},[sale]);
  const bid=()=>{const id=`demo-${Date.now()}`;setIncrement(Math.round((next-current)*100)/100);setBids(v=>[{id,amount:next,team:"Royal Strikers",color:"var(--primary)"},...v]);setRemaining(20000);setPulse(id);setSale(null);};
  const reset=()=>{setSale(null);setFinished(false);setBids([{id:"demo-reset",amount:4.25,team:"Coastal Kings",color:"var(--electric)"}]);setRemaining(18000);setPulse("");};
  return <section className="landing-demo"><div className="landing-demo-label"><span className="flex items-center gap-2"><span className="live-indicator"/>INTERACTIVE DEMO · LOCAL SIMULATION</span><Button variant="ghost" size="icon" aria-label="Reset demo" title="Reset demo" onClick={reset}><RotateCcw className="h-4 w-4"/></Button></div><AuctionStage player={demoPlayer} currency="cr" price={current} leader={leader ? {name:leader.team,color:leader.color} : null} remaining={remaining} total={20000} bids={bids} pulse={pulse} increment={pulse ? increment : 0} label="IPL / MARQUEE / LOT 01"><div className="bid-bar"><span className="hidden text-xs text-muted-foreground sm:block">Royal Strikers<strong className="ml-2 text-foreground">₹100 Cr purse</strong></span><Button onClick={sale ? reset : bid} className="bid-action h-16 flex-1 bg-gold font-display text-2xl font-bold uppercase text-primary-foreground"><Gavel className="h-5 w-5"/>{sale ? "Start another demo" : `Demo bid ${formatMoney(next,"cr")}`}</Button></div></AuctionStage>{sale&&<SaleReveal sale={sale} currency="cr"/>}</section>;
}