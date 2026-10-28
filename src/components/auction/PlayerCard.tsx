import { Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PlayerPortrait } from "./PlayerPortrait";
import { PlayerProfile } from "./PlayerProfile";
import { cn } from "@/lib/utils";
import { formatMoney, ROLE_LABEL, type Player, type Settings } from "@/lib/auction-rules";

const tierStyle: Record<string, string> = {
  Marquee: "bg-gold text-primary-foreground",
  A: "bg-electric/20 text-electric",
  B: "bg-success/20 text-success",
  C: "bg-secondary text-secondary-foreground",
  Uncapped: "bg-muted text-muted-foreground",
};

export function TierBadge({ tier }: { tier: string }) {
  return (
    <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider", tierStyle[tier])}>
      {tier}
    </span>
  );
}

export function PlayerCard({
  player,
  currency = "cr",
  big,
  starred,
  onStar,
  footer,
}: {
  player: Player;
  currency?: Settings["currency"];
  big?: boolean;
  starred?: boolean | undefined;
  onStar?: (() => void) | undefined;
  footer?: React.ReactNode;
}) {
  return (
    <div className={cn("panel relative overflow-hidden", big ? "p-5 sm:p-6" : "p-3")}>
      <div className="flex items-center gap-3">
        <PlayerProfile player={player} currency={currency}><PlayerPortrait player={player} priority={big} className={cn("shrink-0 rounded-md",big ? "h-28 w-24" : "h-16 w-14")}/></PlayerProfile>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <TierBadge tier={player.tier} />
            {player.nationality_type === "Overseas" && (
              <span className="text-[10px] font-bold uppercase text-electric">✈ Overseas</span>
            )}
          </div>
          <PlayerProfile player={player} currency={currency}><h3 className={cn("font-bold uppercase leading-tight", big ? "text-3xl sm:text-4xl" : "truncate text-lg")}>
            {player.name}
          </h3></PlayerProfile>
          <p className="truncate text-xs text-muted-foreground">
            {player.country} · {ROLE_LABEL[player.role]} · {player.sub_role}
          </p>
          {big && (
            <p className="text-xs text-muted-foreground">
              Bats {player.batting_hand} · {player.bowling_style}
            </p>
          )}
        </div>
        <div className="text-right">
          <div className={cn("font-display font-bold text-gold tabular", big ? "text-5xl" : "text-2xl")}>
            {player.rating}
          </div>
          <div className="text-[10px] uppercase text-muted-foreground">Base {formatMoney(Number(player.base_price), currency)}</div>
        </div>
        {onStar && (
          <Button variant="ghost" size="icon"
            onClick={onStar}
            aria-label={starred ? "Remove from targets" : "Add to my targets"}
            className="absolute right-1 top-1 h-7 w-7 text-muted-foreground hover:text-primary"
          >
            <Star className={cn("h-4 w-4", starred && "fill-primary text-primary")} />
          </Button>
        )}
      </div>
      {footer}
    </div>
  );
}
