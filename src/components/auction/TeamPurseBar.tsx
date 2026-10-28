import { cn } from "@/lib/utils";
import { formatMoney, type Settings } from "@/lib/auction-rules";
import type { Participant } from "@/hooks/use-room";

export function TeamDot({ color, className }: { color: string; className?: string }) {
  return <span className={cn("inline-block h-3 w-3 shrink-0 rounded-full", className)} style={{ backgroundColor: color }} />;
}

export function TeamPurseBar({
  participants,
  squadCount,
  settings,
  highlight,
  now,
}: {
  participants: Participant[];
  squadCount: (id: string) => number;
  settings: Settings;
  highlight?: string | null;
  now: number;
}) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {participants.map((p) => {
        const online = now - new Date(p.last_seen).getTime() < 30000;
        return (
          <div
            key={p.id}
            className={cn(
              "panel min-w-[150px] flex-1 px-3 py-2 transition-all",
              highlight === p.id && "ring-2 ring-primary shadow-glow",
            )}
          >
            <div className="flex items-center gap-2">
              <TeamDot color={p.color} />
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
          </div>
        );
      })}
    </div>
  );
}
