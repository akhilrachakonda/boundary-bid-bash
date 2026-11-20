import { actionError, transportFailure } from "@/lib/connection-recovery";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

type RpcFn = (
  fn: string,
  args?: object,
) => PromiseLike<{ data: unknown; error: { message: string; code?: string } | null }> & {
  abortSignal: (
    signal: AbortSignal,
  ) => PromiseLike<{ data: unknown; error: { message: string; code?: string } | null }>;
};

/** Calls a server-authoritative database function and toasts any rejection. */
export async function rpc<T = unknown>(
  fn: string,
  args?: object,
  opts?: { quiet?: boolean; preserveNull?: boolean; timeoutMs?: number },
): Promise<T | undefined> {
  try {
    const query = (supabase.rpc as unknown as RpcFn)(fn, args);
    const { data, error } = await (opts?.timeoutMs
      ? query.abortSignal(AbortSignal.timeout(opts.timeoutMs))
      : query);
    if (error) {
      if (!opts?.quiet)
        toast.error(
          actionError(error),
          transportFailure(error) ? { id: "room-connection" } : undefined,
        );
      return undefined;
    }
    return (opts?.preserveNull ? data : (data ?? true)) as T;
  } catch (cause) {
    if (!opts?.quiet)
      toast.error(
        actionError(
          cause instanceof Error
            ? cause
            : { message: "Connection interrupted. Check the room before trying again." },
        ),
        { id: "room-connection" },
      );
    return undefined;
  }
}
