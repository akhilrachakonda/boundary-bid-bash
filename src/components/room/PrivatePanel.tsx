import { toast } from "sonner";
import { Lock } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatMoney, maxAffordableBid, needsList, ROLES, ROLE_LABEL } from "@/lib/auction-rules";
import { TargetList } from "@/components/auction/TargetList";
import { XIBuilder } from "@/components/auction/XIBuilder";
import type { Notes } from "@/hooks/use-room";
import type { RoomData, Derived } from "@/components/auction/derive";
import { PlayerPortrait } from "@/components/auction/PlayerPortrait";
import { PlayerProfile } from "@/components/auction/PlayerProfile";

export function PrivatePanel({ data, d }: { data: RoomData; d: Derived }) {
  const room = data.room!;
  const s = room.settings;
  const me = d.me!;
  const save = (n: Notes) => data.saveNotes(n).catch((e) => toast.error(e.message));
  const purse = Number(me.purse);
  return (
    <div className="space-y-4">
      <p className="mb-2 flex items-center gap-1 text-xs uppercase tracking-wider text-muted-foreground"><Lock className="h-3 w-3" /> Private — only you see this</p>
      <Tabs defaultValue="purse">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="purse">Purse</TabsTrigger>
          <TabsTrigger value="targets">Targets</TabsTrigger>
          <TabsTrigger value="xi">XI</TabsTrigger>
          <TabsTrigger value="needs">Needs</TabsTrigger>
        </TabsList>
        <TabsContent value="purse" className="space-y-3">
          <div className="rounded-lg bg-secondary/40 p-3">
            <div className="text-xs uppercase text-muted-foreground">Purse left</div>
            <div className="font-display text-4xl font-bold text-gold tabular">{formatMoney(purse, s.currency)}</div>
          </div>
          <div className="text-sm">
            <p className="mb-1 text-xs uppercase text-muted-foreground">Max you can bid and still complete your squad</p>
            <ul className="grid grid-cols-2 gap-2">
              {ROLES.map((r) => (
                <li key={r} className="rounded-md border p-2">
                  <div className="text-xs text-muted-foreground">{ROLE_LABEL[r]}</div>
                  <div className="font-display text-xl font-bold tabular">{formatMoney(Math.max(0, maxAffordableBid(s, purse, d.myCounts, r)), s.currency)}</div>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="mb-1 text-xs uppercase text-muted-foreground">My squad ({d.mySquad.length})</p>
            <ul className="space-y-1 text-sm">
              {data.squads.filter((x) => x.participant_id === me.id).map((x) => {
                const p = d.playerById.get(x.player_id);
                return p ? (
                  <li key={x.id} className="flex items-center justify-between gap-2"><PlayerProfile player={p} currency={s.currency}><div className="flex items-center gap-2"><PlayerPortrait player={p} className="h-10 w-8 shrink-0 rounded"/><span className="truncate">{p.name}</span></div></PlayerProfile><span className="shrink-0 tabular">{formatMoney(Number(x.price), s.currency)}</span></li>
                ) : null;
              })}
            </ul>
          </div>
        </TabsContent>
        <TabsContent value="targets">
          <TargetList notes={data.notes} onChange={save} pool={data.pool} d={d} currency={s.currency} />
        </TabsContent>
        <TabsContent value="xi">
          <XIBuilder squad={d.mySquad} notes={data.notes} onChange={save} format={room.format} />
        </TabsContent>
        <TabsContent value="needs">
          <ul className="space-y-2">
            {needsList(s, d.myCounts).map((n) => {
              const ok = n.have >= n.need;
              return (
                <li key={n.label} className="flex items-center gap-2 text-sm">
                  <span className={ok ? "text-success" : "text-destructive"}>{ok ? "✓" : "•"}</span>
                  <span className="flex-1">{n.label}</span>
                  <span className="tabular">{n.have}/{n.need}</span>
                </li>
              );
            })}
            <li className="flex items-center gap-2 text-sm">
              <span className="flex-1">Overseas</span>
              <span className="tabular">{d.myCounts.overseas}/{s.max_overseas} max</span>
            </li>
          </ul>
          <p className="mt-3 text-xs text-muted-foreground">
            Missing sub-roles:{" "}
            {["WK-Batter", "Top order", "Middle order", "Finisher", "Pace", "Medium pace", "Spin"]
              .filter((sr) => !d.mySquad.some((p) => p.sub_role === sr))
              .join(", ") || "none"}
          </p>
        </TabsContent>
      </Tabs>
    </div>
  );
}
