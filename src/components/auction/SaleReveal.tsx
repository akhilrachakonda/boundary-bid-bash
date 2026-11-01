import { Gavel } from "lucide-react";
import { PlayerPortrait } from "./PlayerPortrait";
import { TeamCrest } from "./TeamCrest";
import { formatMoney, type Player, type Settings } from "@/lib/auction-rules";
import { createPortal } from "react-dom";
import { useHydrated } from "@tanstack/react-router";
export interface SaleSnapshot { id: string | number; kind: "sold" | "unsold"; player: Player; team?: { name: string; color: string }; price: number | null }
export function SaleReveal({ sale, currency }: { sale: SaleSnapshot; currency: Settings["currency"] }) {
  const hydrated = useHydrated();
  if (!hydrated) return null;
  return createPortal(<div className={`sale-reveal sale-${sale.kind}`} role="status" aria-live="polite" style={sale.team ? {"--team-color":sale.team.color} as React.CSSProperties : undefined}>
    <PlayerPortrait player={sale.player} className="h-20 w-16 shrink-0 rounded-md"/>
    <div className="min-w-0 flex-1"><div className="flex items-center gap-2"><Gavel className="hammer-motion h-5 w-5 text-primary"/><strong className="sale-stamp font-display text-3xl uppercase">{sale.kind}</strong></div><p className="truncate font-display text-xl font-bold uppercase">{sale.player.name}</p>{sale.team && <p className="flex items-center gap-1 truncate text-xs"><TeamCrest name={sale.team.name} color={sale.team.color} className="h-5 w-5"/>{sale.team.name}</p>}</div>
    {sale.price != null && <strong className="sale-price shrink-0 font-display text-2xl text-primary tabular">{formatMoney(sale.price,currency)}</strong>}
    {sale.kind==="sold" && <div className="sale-particles" aria-hidden="true">{Array.from({length:8},(_,i)=><i key={i}/>)}</div>}
  </div>, document.body);
}