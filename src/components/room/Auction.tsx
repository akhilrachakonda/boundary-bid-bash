import { useEffect, useRef, useState } from "react";
import { Pause, Play, SkipForward, Square, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { bidBlockReason, formatMoney, nextBidAmount } from "@/lib/auction-rules";
import { playHammer } from "@/lib/sound";
import { PlayerCard } from "@/components/auction/PlayerCard";
import { TimerRing } from "@/components/auction/TimerRing";
import { TeamDot } from "@/components/auction/TeamPurseBar";
import type { RoomData, Derived } from "@/components/auction/derive";
import { PrivatePanel } from "./PrivatePanel";
import { rpc } from "./rpc";

export function Auction({ data, d, now, sound }: { data: RoomData; d: Derived; now: number; sound: boolean }) {
  const room = data.room!;
  const s = room.settings;
  const rp = data.pool.find((x) => x.id === room.current_rp);
  const player = rp?.player;
  const paused = room.status === "paused";
  const remaining = paused ? room.paused_remaining_ms ?? 0 : room.lot_ends_at ? new Date(room.lot_ends_at).getTime() - now : 0;
  const leader = room.current_bidder ? d.partById.get(room.current_bidder) : null;
  const amount = player ? nextBidAmount(s, room.current_bid != null ? Number(room.current_bid) : null, Number(player.base_price)) : 0;
  const me = d.me!;
  const block = player ? bidBlockReason(s, Number(me.purse), d.myCounts, player, amount, room.current_bidder === me.id) : "No player";
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<{ kind: "sold" | "unsold"; text: string } | null>(null);
  const lastEvent = useRef<number | null>(null);
  const starred = player ? data.notes.targets[player.id] : undefined;

  // Sold / unsold stamp animation from the server's event log
  useEffect(() => {
    const ev = data.events.find((e) => e.kind === "sold" || e.kind === "unsold");
    if (!ev) return;
    if (lastEvent.current === null) {
      lastEvent.current = ev.id;
      return;
    }
    if (ev.id === lastEvent.current) return;
    lastEvent.current = ev.id;
    setFlash({ kind: ev.kind as "sold" | "unsold", text: ev.message });
    if (ev.kind === "sold" && sound) playHammer();
    const t = setTimeout(() => setFlash(null), 2200);
    return () => clearTimeout(t);
  }, [data.events, sound]);

  const bid = async () => {
    if (block || busy) return;
    setBusy(true);
    await rpc("place_bid", { p_room: room.id, p_amount: amount });
    setBusy(false);
  };

  const toggleStar = () => {
    if (!player) return;
    const t = { ...data.notes.targets };
    if (t[player.id]) delete t[player.id];
    else t[player.id] = {};
    data.saveNotes({ ...data.notes, targets: t });
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
      <div className="space-y-4">
        <div className="relative">
          {player ? (
            <PlayerCard
              big
              player={player}
              currency={s.currency}
              starred={!!starred}
              onStar={toggleStar}
              footer={
                <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <span className="rounded bg-secondary px-2 py-0.5">{rp!.set_name}{rp!.round === 2 ? " · Accelerated" : ""}</span>
                  {starred?.max != null && <span className="rounded bg-primary/15 px-2 py-0.5 text-primary">Your max {formatMoney(starred.max, s.currency)}</span>}
                </div>
              }
            />
          ) : (
            <div className="panel grid h-40 place-items-center text-muted-foreground">Waiting for the next player…</div>
          )}
          {flash && (
            <div className="pointer-events-none absolute inset-0 grid place-items-center rounded-xl bg-background/70">
              <div className="text-center">
                <div className={cn("animate-stamp rounded-lg border-4 px-6 py-2 font-display text-6xl font-extrabold uppercase", flash.kind === "sold" ? "border-success text-success" : "border-destructive text-destructive")}>
                  {flash.kind}
                </div>
                <p className="mt-3 text-sm font-semibold">{flash.text}</p>
              </div>
            </div>
          )}
        </div>

        <div className="panel flex items-center gap-4 p-4 sm:p-5">
          <TimerRing remainingMs={remaining} totalMs={s.bid_timer * 1000} paused={paused} />
          <div className="min-w-0 flex-1">
            <p className="text-xs uppercase text-muted-foreground">{leader ? "Highest bid" : "Opening at base price"}</p>
            <p key={room.current_bid ?? "base"} className="animate-bid-pop font-display text-5xl font-extrabold tabular sm:text-6xl">
              {formatMoney(room.current_bid != null ? Number(room.current_bid) : player ? Number(player.base_price) : null, s.currency)}
            </p>
            {leader ? (
              <p className="flex items-center gap-2 truncate text-lg font-semibold" style={{ color: leader.color }}>
                <TeamDot color={leader.color} /> {leader.team_name}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">No bids yet</p>
            )}
          </div>
        </div>

        <Button
          onClick={bid}
          disabled={!!block || busy || paused || remaining <= 0}
          className="h-20 w-full bg-gold text-2xl font-extrabold uppercase text-primary-foreground shadow-glow disabled:opacity-50 sm:h-24 sm:text-3xl"
        >
          {paused ? "Paused" : block ?? `Bid ${formatMoney(amount, s.currency)}`}
        </Button>

        {d.isHost && (
          <div className="flex flex-wrap gap-2">
            {paused ? (
              <Button variant="outline" onClick={() => rpc("host_control", { p_room: room.id, p_action: "resume" })}><Play className="h-4 w-4" /> Resume</Button>
            ) : (
              <Button variant="outline" onClick={() => rpc("host_control", { p_room: room.id, p_action: "pause" })}><Pause className="h-4 w-4" /> Pause</Button>
            )}
            <Button variant="outline" onClick={() => rpc("host_control", { p_room: room.id, p_action: "skip" })}><SkipForward className="h-4 w-4" /> Skip player</Button>
            <Confirm label="Undo last sale" icon={<Undo2 className="h-4 w-4" />} desc="The last sold player goes back into the auction and the buyer gets their money back." onYes={() => rpc("host_control", { p_room: room.id, p_action: "undo" })} />
            <Confirm label="End auction" icon={<Square className="h-4 w-4" />} desc="All remaining players will be marked unsold." onYes={() => rpc("host_control", { p_room: room.id, p_action: "end" })} />
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="panel p-4">
            <h4 className="mb-2 text-lg font-bold uppercase">Bids on this player</h4>
            <ul className="max-h-56 space-y-1 overflow-y-auto text-sm">
              {data.bids.length === 0 && <li className="text-muted-foreground">No bids yet.</li>}
              {data.bids.map((b) => {
                const t = d.partById.get(b.participant_id);
                return (
                  <li key={b.id} className="flex items-center gap-2">
                    <TeamDot color={t?.color ?? "#888"} />
                    <span className="flex-1 truncate">{t?.team_name}</span>
                    <span className="font-semibold tabular">{formatMoney(Number(b.amount), s.currency)}</span>
                  </li>
                );
              })}
            </ul>
          </div>
          <AuctionLog data={data} />
        </div>
      </div>
      <PrivatePanel data={data} d={d} />
    </div>
  );
}

export function AuctionLog({ data }: { data: RoomData }) {
  return (
    <div className="panel p-4">
      <h4 className="mb-2 text-lg font-bold uppercase">Auction log</h4>
      <ul className="max-h-56 space-y-1 overflow-y-auto text-sm">
        {data.events.map((e) => (
          <li key={e.id} className={cn(e.kind === "sold" && "text-success", e.kind === "unsold" && "text-muted-foreground", e.kind === "trade" && "text-electric")}>
            <span className="mr-2 text-xs text-muted-foreground tabular">{new Date(e.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
            {e.message}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Confirm({ label, icon, desc, onYes }: { label: string; icon: React.ReactNode; desc: string; onYes: () => void }) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="outline">{icon} {label}</Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{label}?</AlertDialogTitle>
          <AlertDialogDescription>{desc}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onYes}>{label}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
