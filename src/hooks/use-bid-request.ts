import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { BidRequestGate, type BidRequestState } from "@/lib/bid-request-gate";
import { bidArgs } from "@/lib/room-actions";

type Args = ReturnType<typeof bidArgs>;
export function useBidRequest(reload: () => Promise<unknown>) {
  const [state, setState] = useState<BidRequestState>("idle");
  const [accepted, setAccepted] = useState(false);
  const alive = useRef(true);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const refresh = useRef(reload); refresh.current = reload;
  const [gate] = useState(() => new BidRequestGate<Args>(async args => {
    const { data, error } = await supabase.rpc("place_bid", args).abortSignal(AbortSignal.timeout(8000));
    if (!error && data != null) { void refresh.current().catch(() => {}); return "accepted"; }
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