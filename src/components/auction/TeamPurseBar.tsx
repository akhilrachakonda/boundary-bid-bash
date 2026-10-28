import { cn } from "@/lib/utils";
import { formatMoney, type Settings } from "@/lib/auction-rules";
import type { Participant } from "@/hooks/use-room";
import { Button } from "@/components/ui/button";
import { TeamCrest } from "./TeamCrest";

export function TeamDot({ color, className }: { color: string; className?: string }) {
  return <span className={cn("inline-block h-3 w-3 shrink-0 rounded-full", className)} style={{ backgroundColor: color }} />;
}

export function TeamPurseBar({
  participants,
  squadCount,
  settings,
  highlight,
  now,
  onSelect,
}: {
  participants: Participant[];
  squadCount: (id: string) => number;
  settings: Settings;
  highlight?: string | null;
  now: number;
  onSelect?: (id: string) => void;
}) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {participants.map((p) => {
        const online = now - new Date(p.last_seen).getTime() < 30000;
        return (
          <Button variant="ghost" onClick={()=>onSelect?.(p.id)} aria-label={`View ${p.team_name} squad`}
            key={p.id}
            className={cn(
              "team-rail-item h-auto min-w-[170px] flex-1 flex-col items-stretch rounded-md border bg-card px-3 py-3 transition-all",
              highlight === p.id && "border-primary bg-primary/5",
            )}
          >
            <div className="flex items-center gap-2">
              <TeamCrest name={p.team_name} color={p.color} className="h-7 w-7" />
              <span className="truncate text-sm font-semibold">{p.team_name}</span>
              <span className={cn("ml-auto h-1.5 w-1.5 rounded-full", online ? "bg-success" : "bg-muted-foreground/40")} />
            </div>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="font-display text-lg font-bold tabular">{formatMoney(Number(p.purse), settings.currency)}</span>
              <span className="text-xs text-muted-foreground tabular">
                {squadCount(p.id)}/{settings.max_squad}
              </span>
            </div>
            <div className="mt-1 h-1 overflow-hidden rounded bg-secondary">
              <div className="h-full" style={{ width: `${(Number(p.purse) / settings.purse) * 100}%`, backgroundColor: p.color }} />
            </div>
          </Button>
        );
      })}
    </div>
  );
}
