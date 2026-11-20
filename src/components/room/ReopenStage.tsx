import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { RoomData } from "@/components/auction/derive";
import { auctionCommandArgs } from "@/lib/post-launch-controls";
import type { LiveProjection } from "@/lib/live-projection";
import { rpc } from "./rpc";

export function ReopenStage({ data }: { data: RoomData }) {
  const room = data.room!;
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const options = [
    {
      action: "reopen_unsold",
      label: "Unsold players",
      available: data.pool.some((p) => p.status === "unsold"),
      effect: "Pending offers expire. Accepted trades stand. Saved XIs and ratings are cleared.",
    },
    {
      action: "reopen_trades",
      label: "Trading",
      available: room.status === "results",
      effect: "The trade timer restarts. Accepted trades stand. Saved XIs and ratings are cleared.",
    },
    {
      action: "reopen_lineup",
      label: "Playing XI",
      available: room.post_phase === "rating" || room.post_phase === "done",
      effect:
        "Teams keep their saved XIs as private drafts. The XI timer restarts and previous ratings are cleared.",
    },
  ].filter((option) => option.available);
  if (!options.length) return null;
  async function reopen(option: (typeof options)[number]) {
    if (inFlight.current || !window.confirm(`Reopen ${option.label}? ${option.effect}`)) return;
    inFlight.current = true;
    setBusy(true);
    try {
      const args = auctionCommandArgs(room, option.action, crypto.randomUUID(), {
        phase: room.post_phase ?? null,
      });
      const result = await rpc<{ live: LiveProjection }>("auction_command_and_sync", args, {
        timeoutMs: 8000,
      });
      if (result?.live) data.applyLive(result.live);
    } catch {
      toast.warning("Could not confirm the stage change. Refreshing the room.");
    } finally {
      await Promise.allSettled([data.reload("rooms"), data.reload("trades")]);
      inFlight.current = false;
      setBusy(false);
    }
  }
  return (
    <details className="panel px-4 py-3">
      <summary className="cursor-pointer font-semibold">Reopen a stage</summary>
      <div className="mt-3 flex flex-wrap gap-2">
        {options.map((option) => (
          <Button
            key={option.action}
            variant="outline"
            disabled={busy}
            onClick={() => void reopen(option)}
          >
            {option.label}
          </Button>
        ))}
      </div>
    </details>
  );
}
