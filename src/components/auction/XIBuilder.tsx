import { useState } from "react";
import { ArrowDown, ArrowUp, GripVertical, Minus, Plus, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { bestXI, isBowlingOption, overseasXILimit, xiWarnings, type Player } from "@/lib/auction-rules";
import type { Notes } from "@/hooks/use-room";
import { PlayerPortrait } from "./PlayerPortrait";
import { PlayerProfile } from "./PlayerProfile";

import {useCommunityMode} from './CommunityContext';

export function XIBuilder({
  squad,
  notes,
  onChange,
  format,
}: {
  squad: Player[];
  notes: Notes;
  onChange: (n: Notes) => void;
  format: string;
}) {
  const community=useCommunityMode();
  const [drag, setDrag] = useState<number | null>(null);
  const byId = new Map(squad.map((p) => [p.id, p]));
  const order = notes.xi.order.filter((id) => byId.has(id));
  const xi = order.map((id) => byId.get(id)!);
  const bench = squad.filter((p) => !order.includes(p.id)).sort((a, b) => b.rating - a.rating);
  const warnings = community ? [] : xiWarnings(xi, overseasXILimit(format));
  const overs = notes.xi.overs ?? {};
  const totalOvers = Object.entries(overs).filter(([id]) => order.includes(id)).reduce((a, [, v]) => a + v, 0);
  const maxOvers = format === "ODI" ? 50 : 20;
  const perBowler = format === "ODI" ? 10 : 4;

  const setOrder = (o: string[]) => onChange({ ...notes, xi: { ...notes.xi, order: o } });
  const move = (from: number, to: number) => {
    if (to < 0 || to >= order.length) return;
    const o = [...order];
    const [x] = o.splice(from, 1);
    if (x) o.splice(to, 0, x);
    setOrder(o);
  };
  const setOv = (id: string, v: number) =>
    onChange({ ...notes, xi: { ...notes.xi, overs: { ...overs, [id]: Math.max(0, Math.min(perBowler, v)) } } });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="outline" onClick={() => setOrder((community?[...squad].sort((a,b)=>b.rating-a.rating).slice(0,11):bestXI(squad, overseasXILimit(format))).map((p) => p.id))} disabled={!squad.length}>
          <Wand2 className="h-4 w-4" /> Auto-pick best XI
        </Button>
        <span className="text-xs text-muted-foreground">
          Overs planned {totalOvers}/{maxOvers}
        </span>
      </div>
      {warnings.length > 0 && squad.length > 0 && (
        <ul className="rounded-lg border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">
          {warnings.map((w) => <li key={w}>⚠ {w}</li>)}
        </ul>
      )}
      <ol className="space-y-1">
        {xi.map((p, i) => (
          <li
            key={p.id}
            draggable
            onDragStart={() => setDrag(i)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => drag != null && move(drag, i)}
            className={cn("flex flex-wrap items-center gap-2 rounded-md border bg-secondary/40 px-2 py-1.5 text-sm", drag === i && "opacity-50")}
          >
            <GripVertical className="h-4 w-4 cursor-grab text-muted-foreground" />
            <span className="w-5 font-display font-bold text-primary tabular">{i + 1}</span>
            <PlayerProfile player={p}><PlayerPortrait player={p} className="h-10 w-8 shrink-0 rounded"/></PlayerProfile>
            <span className="min-w-0 flex-1 truncate">
              {p.name}
              <span className="ml-1 text-xs text-muted-foreground">{p.sub_role}{p.nationality_type === "Overseas" ? " ✈" : ""}</span>
            </span>
            <div className="ml-auto flex w-full flex-wrap items-center justify-end gap-1">
            {(community||isBowlingOption(p)) && (
              <span className="flex items-center gap-1 text-xs">
                <button className="grid h-11 w-11 touch-manipulation place-items-center rounded border" aria-label="Fewer overs" onClick={() => setOv(p.id, (overs[p.id] ?? 0) - 1)}><Minus className="h-3 w-3" /></button>
                <span className="w-4 text-center tabular">{overs[p.id] ?? 0}</span>
                <button className="grid h-11 w-11 touch-manipulation place-items-center rounded border" aria-label="More overs" onClick={() => setOv(p.id, (overs[p.id] ?? 0) + 1)}><Plus className="h-3 w-3" /></button>
              </span>
            )}
            <button className="grid h-11 w-11 touch-manipulation place-items-center rounded border" aria-label="Move up" onClick={() => move(i, i - 1)}><ArrowUp className="h-4 w-4" /></button>
            <button className="grid h-11 w-11 touch-manipulation place-items-center rounded border" aria-label="Move down" onClick={() => move(i, i + 1)}><ArrowDown className="h-4 w-4" /></button>
            <button className="grid h-11 w-11 touch-manipulation place-items-center rounded border" aria-label="Remove from XI" onClick={() => setOrder(order.filter((x) => x !== p.id))}><Minus className="h-4 w-4 text-destructive" /></button>
            </div>
          </li>
        ))}
      </ol>
      {bench.length > 0 && (
        <div>
          <p className="mb-1 text-xs uppercase text-muted-foreground">Bench — tap to add</p>
          <div className="flex flex-wrap gap-1">
            {bench.map((p) => (
              <button
                key={p.id}
                disabled={order.length >= 11}
                onClick={() => setOrder([...order, p.id])}
                className="rounded-full border px-2 py-1 text-xs hover:border-primary disabled:opacity-40"
              >
                <PlayerPortrait player={p} className="mr-1 inline-block h-8 w-7 rounded"/>{p.name} · {p.rating}
              </button>
            ))}
          </div>
        </div>
      )}
      {!squad.length && <p className="text-sm text-muted-foreground">Buy players to build your XI.</p>}
      <Textarea
        placeholder="Strategy notes (private)"
        defaultValue={notes.notes}
        onBlur={(e) => onChange({ ...notes, notes: e.target.value })}
        rows={3}
      />
    </div>
  );
}
