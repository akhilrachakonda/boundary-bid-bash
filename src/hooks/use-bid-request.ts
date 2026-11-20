import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { BidRequestGate, type BidRequestState } from "@/lib/bid-request-gate";
import { bidArgs } from "@/lib/room-actions";
import type { LiveProjection } from '@/lib/live-projection';

type Args = ReturnType<typeof bidArgs>;
export function useBidRequest(reload: () => Promise<unknown>, live?: { enabled: boolean; compact?: boolean; poolRevision?: {current:number|null}; apply: (projection: LiveProjection) => boolean }) {
  const [state, setState] = useState<BidRequestState>("idle");
  const [accepted, setAccepted] = useState(false);
  const alive = useRef(true);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const refresh = useRef(reload); refresh.current = reload;
  const liveRef = useRef(live); liveRef.current = live;
  const [gate] = useState(() => new BidRequestGate<Args>(async args => {
    const synced = liveRef.current?.enabled;
    const compact = synced && liveRef.current?.compact;
    const method = compact ? "place_bid_with_changes" : synced ? "place_bid_and_sync" : "place_bid";
    const request = compact ? {...args, p_pool_revision:liveRef.current?.poolRevision?.current ?? null} : args;
    const { data, error } = await supabase.rpc(method as never, request as never).abortSignal(AbortSignal.timeout(8000));
    if (!error && data != null) {
      const reply = data as unknown as {live?: LiveProjection};
      if (!synced || !reply.live || !liveRef.current?.apply(reply.live)) void refresh.current().catch(() => {});
      return "accepted";
    }
    // PostgreSQL rejection has a SQLSTATE. Empty-code fetch/abort errors are ambiguous.
    if (error?.code && /^[0-9A-Z]{5}$/.test(error.code)) {
      toast.error(error.message); void refresh.current().catch(() => {}); return "rejected";
    }
    return "uncertain";
  }, async args => {
    const { data, error } = await supabase.from("bids").select("id")
      .eq("request_id", args.p_request).eq("room_id", args.p_room).limit(1)
      .abortSignal(AbortSignal.timeout(5000));
    if (error) return "unknown";
    await refresh.current();
    return data.length ? "accepted" : "absent";
  }, (next, success) => {
    if (!alive.current) return;
    setState(next);
    if (next === "uncertain") toast.warning("Bid outcome not confirmed. Check and retry the same bid before placing another.");
    if (success) { setAccepted(true); clearTimeout(timer.current); timer.current = setTimeout(() => setAccepted(false), 700); }
  }));
  useEffect(() => { alive.current = true; return () => { alive.current = false; clearTimeout(timer.current); }; }, []);
  return { state, accepted, submit: (args: Args) => gate.submit(args), retry: () => gate.retry() };
}
