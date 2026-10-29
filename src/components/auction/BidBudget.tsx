import { Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatMoney, maxAffordableBid, ROLES, type Counts, type Player, type Settings } from "@/lib/auction-rules";

export function BidBudget({ settings, purse, counts, player, blocked }: { settings: Settings; purse: number; counts: Counts; player: Player; blocked: boolean }) {
  const maximum = Math.max(0, maxAffordableBid(settings, purse, counts, player.role));
  const slots = Math.max(0, settings.min_squad - counts.total - 1);
  const roles = ROLES.map(role => ({ role, need: Math.max(0, Number(settings[`min_${role.toLowerCase()}` as keyof Settings] ?? 0) - counts[role] - (player.role === role ? 1 : 0)) })).filter(x => x.need > 0);
  return <div className="bid-budget grid w-full grid-cols-2 gap-2 text-xs">
    <div><span className="text-muted-foreground">Remaining purse</span><strong className="block break-words font-display text-xl tabular">{formatMoney(purse, settings.currency)}</strong></div>
    <Popover><PopoverTrigger asChild><Button variant="ghost" className="h-auto min-w-0 justify-end gap-2 p-0 text-right" aria-label="Explain maximum affordable bid"><span className="min-w-0"><span className="block text-xs font-normal text-muted-foreground">Max affordable {blocked ? "· not eligible" : ""}</span><strong className="block break-words font-display text-xl tabular">{formatMoney(maximum, settings.currency)}</strong></span><Info className="h-4 w-4 shrink-0 text-electric" /></Button></PopoverTrigger><PopoverContent className="max-w-[calc(100vw-24px)] text-sm"><h3 className="font-semibold">Conservative server reserve</h3><p className="mt-2">{formatMoney(purse - maximum, settings.currency)} reserved after buying this player: {slots} remaining minimum squad slots; role needs {roles.length ? roles.map(x => `${x.role} ${x.need}`).join(", ") : "none"}.</p><p className="mt-2 text-muted-foreground">Reserve = larger of remaining slots or combined role needs × {formatMoney(settings.min_base, settings.currency)}. This is the server’s conservative calculation, not guaranteed cheapest completion. Full squad, overseas limits and live bidding state still apply.</p></PopoverContent></Popover>
  </div>;
}