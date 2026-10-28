import { X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { formatMoney, type Settings } from "@/lib/auction-rules";
import type { Notes, RoomPlayer } from "@/hooks/use-room";
import type { Derived } from "./derive";

export function TargetList({
  notes,
  onChange,
  pool,
  d,
  currency,
}: {
  notes: Notes;
  onChange: (n: Notes) => void;
  pool: RoomPlayer[];
  d: Derived;
  currency: Settings["currency"];
}) {
  const ids = Object.keys(notes.targets);
  if (!ids.length)
    return <p className="text-sm text-muted-foreground">Star players in the pool to track them here.</p>;
  return (
    <ul className="space-y-2">
      {ids.map((id) => {
        const rp = pool.find((r) => r.player_id === id);
        if (!rp) return null;
        const owner = d.ownerOf(id);
        const status = owner
          ? `Sold to ${owner.team_name}`
          : rp.status === "live"
            ? "On the block now"
            : rp.status === "unsold"
              ? "Unsold"
              : "Available";
        const t = notes.targets[id] ?? {};
        return (
          <li key={id} className="rounded-lg border bg-secondary/40 p-2">
            <div className="flex items-center gap-2">
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold">{rp.player.name}</div>
                <div className="text-xs" style={owner ? { color: owner.color } : undefined}>
                  <span className={rp.status === "live" ? "font-bold text-primary" : owner ? "" : "text-muted-foreground"}>{status}</span>
                  {owner && rp.sold_price != null && ` · ${formatMoney(Number(rp.sold_price), currency)}`}
                </div>
              </div>
              <span className="font-display text-lg font-bold">{rp.player.rating}</span>
              <button
                aria-label="Remove target"
                onClick={() => {
                  const { [id]: _, ...rest } = notes.targets;
                  onChange({ ...notes, targets: rest });
                }}
              >
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>
            <div className="mt-2 flex gap-2">
              <Input
                type="number"
                step="0.25"
                placeholder="My max"
                className="h-8 w-24"
                defaultValue={t.max ?? ""}
                onBlur={(e) =>
                  onChange({ ...notes, targets: { ...notes.targets, [id]: { ...t, max: e.target.value ? Number(e.target.value) : undefined } } })
                }
              />
              <Input
                placeholder="Note"
                className="h-8"
                defaultValue={t.note ?? ""}
                onBlur={(e) => onChange({ ...notes, targets: { ...notes.targets, [id]: { ...t, note: e.target.value } } })}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
