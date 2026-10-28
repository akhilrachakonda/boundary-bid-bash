import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

type RpcFn = (fn: string, args?: object) => Promise<{ data: unknown; error: { message: string } | null }>;

/** Calls a server-authoritative database function and toasts any rejection. */
export async function rpc<T = unknown>(fn: string, args?: object, opts?: { quiet?: boolean }): Promise<T | undefined> {
  const { data, error } = await (supabase.rpc as unknown as RpcFn)(fn, args);
  if (error) {
    if (!opts?.quiet) toast.error(error.message);
    return undefined;
  }
  return (data ?? true) as T;
}
