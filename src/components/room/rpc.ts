import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

type RpcFn = (fn: string, args?: object) => PromiseLike<{ data: unknown; error: { message: string } | null }> & { abortSignal: (signal: AbortSignal) => PromiseLike<{ data: unknown; error: { message: string } | null }> };

/** Calls a server-authoritative database function and toasts any rejection. */
export async function rpc<T = unknown>(fn: string, args?: object, opts?: { quiet?: boolean; timeoutMs?: number }): Promise<T | undefined> {
  const query = (supabase.rpc as unknown as RpcFn)(fn, args);
  const { data, error } = await (opts?.timeoutMs ? query.abortSignal(AbortSignal.timeout(opts.timeoutMs)) : query);
  if (error) {
    if (!opts?.quiet) toast.error(error.message);
    return undefined;
  }
  return (data ?? true) as T;
}
