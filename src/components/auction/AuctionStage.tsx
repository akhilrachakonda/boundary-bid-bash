import { ArrowUp, Radio, Star, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PlayerPortrait } from "./PlayerPortrait";
import { PlayerProfile } from "./PlayerProfile";
import { TierBadge } from "./PlayerCard";
import { TeamCrest } from "./TeamCrest";
import { LotTimer, type LotClock } from "./TimerRing";
import { formatMoney, ROLE_LABEL, type Player, type Settings } from "@/lib/auction-rules";
import { cn } from "@/lib/utils";
import { useEffect, useRef } from "react";
import { SourceStats } from "./SourceStats";

export interface StageBid { id: string; amount: number; team: string; color: string; time?: string }
export function AuctionStage({ player, currency, price, leader, remaining, total, paused, connection = "connected", bids, pulse, increment, starred, onStar, label, children, clock }: {
  player: Player; currency: Settings["currency"]; price: number; leader?: { name: string; color: string } | null;
  remaining: number; total: number; paused?: boolean; connection?: string; bids: StageBid[]; pulse?: string; increment?: number;
  starred?: boolean; onStar?: () => void; label: string; children?: React.ReactNode;
  clock?: LotClock;
}) {
  const priceRef=useRef<HTMLElement>(null);
  useEffect(()=>{if(!pulse || window.matchMedia("(prefers-reduced-motion: reduce)").matches)return;priceRef.current?.animate([{opacity:.4,transform:"translateY(10px)"},{opacity:1,transform:"translateY(0)"}],{duration:300,easing:"ease-out"});},[pulse]);
  return <div className="auction-broadcast">
    <div className="broadcast-stage">
      <div className="stage-topline"><span className="flex items-center gap-2"><Radio className="h-3.5 w-3.5 text-electric"/>{label}</span><span>{paused ? "PAUSED" : connection !== "connected" ? "RECONNECTING" : "ON THE BLOCK"}</span></div>
      <div key={player.id} className="player-stage-body lot-reveal">
        <div className="stage-portrait"><PlayerPortrait player={player} priority className="h-full w-full"/><div className="portrait-vignette"/></div>
        <div className="stage-player-info">
          <div className="mb-3 flex items-center gap-2"><TierBadge tier={player.tier}/><span className="text-xs text-muted-foreground">{player.country}</span></div>
          <PlayerProfile player={player} currency={currency}><h2 className="stage-player-name">{player.name}</h2></PlayerProfile>
          <p className="mt-2 text-sm text-electric">{ROLE_LABEL[player.role]} <span className="text-muted-foreground">/ {player.sub_role}</span></p>
          <p className="mt-2 hidden text-xs text-muted-foreground sm:block">{player.batting_hand}-hand bat · {player.bowling_style}</p>
          <SourceStats player={player}/>
          <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-border/60 pt-3"><div><span className="stat-label">Estimated base price</span><strong className="font-display text-2xl tabular">{formatMoney(Number(player.base_price),currency)}</strong></div><PlayerProfile player={player} currency={currency}><span className="text-xs text-electric underline">Performance · positions · leadership</span></PlayerProfile></div>
        </div>
        {onStar && <Button variant="ghost" size="icon" className="absolute right-3 top-12" onClick={onStar} aria-label={starred ? "Remove from targets" : "Add to my targets"}><Star className={cn("h-5 w-5",starred && "fill-primary text-primary")}/></Button>}
      </div>
      <div className={cn("price-desk",pulse && "price-desk-active")}>
        <div className="min-w-0 flex-1"><span className="stat-label">{leader ? "Current highest bid" : "Opening bid"}</span><div className="flex items-center gap-3"><strong ref={priceRef} className="broadcast-price tabular">{formatMoney(price,currency)}</strong>{!!increment && <span className="increment-rise text-sm font-bold text-success"><ArrowUp className="inline h-3 w-3"/>{formatMoney(increment,currency)}</span>}</div>
        <div className={cn("leading-team",pulse && "team-sweep")} style={leader ? {"--team-color":leader.color} as React.CSSProperties : undefined}>{leader ? <><TeamCrest name={leader.name} color={leader.color} className="h-8 w-8"/><span>{leader.name}</span><TrendingUp className="ml-auto h-4 w-4"/></> : <span className="text-sm text-muted-foreground">The floor is open</span>}</div></div>
        <LotTimer clock={clock} remainingMs={remaining} totalMs={total} paused={paused}/>
      </div>
      {children}
    </div>
    <aside className="bid-timeline"><div className="flex items-center justify-between border-b pb-4"><h3 className="text-xl font-bold uppercase">Bid history</h3><span className="text-xs text-muted-foreground tabular">{bids.length} BIDS</span></div>
      <ol className="timeline-list" aria-live="polite" aria-relevant="additions">{!bids.length && <li className="py-8 text-sm text-muted-foreground">Waiting for the opening bid</li>}{bids.map((bid,i) => <li key={bid.id} className={cn("timeline-entry",i===0 && bid.id===pulse && "timeline-new")}><div className="timeline-marker"><TeamCrest name={bid.team} color={bid.color}/></div><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{bid.team}</p><p className="text-[11px] text-muted-foreground">{i===0 ? "Leading bid" : bid.time ?? "Accepted bid"}</p></div><strong className={cn("font-display text-xl tabular",i===0 && "text-primary")}>{formatMoney(bid.amount,currency)}</strong></li>)}</ol>
      <div className="mt-auto border-t pt-4 text-xs text-muted-foreground">{paused ? "Auction paused" : connection !== "connected" ? "Restoring the live room…" : "All bids confirmed by the auction"}</div>
    </aside>
  </div>;
}
