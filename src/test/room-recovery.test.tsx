import { act, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useRoom } from "@/hooks/use-room";
import { supabase } from "@/integrations/supabase/client";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc: vi.fn(), from: vi.fn(), channel: vi.fn(), removeChannel: vi.fn() },
}));

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

it("opens while the clock is stalled, retries an initial participant failure and replaces a closed channel", async () => {
  vi.useFakeTimers();
  const room = { id: "room", status: "lobby" };
  const member = { id: "participant", user_id: "user" };
  const rpc = vi.mocked(supabase.rpc);
  rpc.mockImplementation(
    (fn) =>
      ({
        abortSignal: () =>
          fn === "server_now"
            ? new Promise(() => {})
            : Promise.resolve({
                data: { room, pool: [], revision: 1, capabilities: {} },
                error: null,
              }),
      }) as never,
  );
  let reads = 0;
  vi.mocked(supabase.from).mockImplementation((table) => {
    const reply =
      table === "participants" && ++reads === 1
        ? { error: { message: "Unavailable" } }
        : { data: table === "participants" ? [member] : [], error: null };
    const result = Promise.resolve(reply);
    const query = {
      select: () => query,
      eq: () => query,
      order: () => query,
      limit: () => query,
      abortSignal: () => query,
      maybeSingle: () => Promise.resolve({ data: null }),
      then: result.then.bind(result),
    };
    return query as never;
  });
  const callbacks: ((status: string) => void)[] = [];
  vi.mocked(supabase.channel).mockImplementation(() => {
    const channel = {
      on: () => channel,
      subscribe: (fn: (s: string) => void) => {
        callbacks.push(fn);
        return channel;
      },
    };
    return channel as never;
  });
  const hook = renderHook(() => useRoom("room", "user"));
  try {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(hook.result.current.room?.id).toBe("room");
    expect(hook.result.current.participants).toEqual([]);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
    });
    expect(hook.result.current.participants).toEqual([member]);
    await act(async () => {
      callbacks[0]!("CLOSED");
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(callbacks).toHaveLength(2);
    await act(async () => {
      callbacks[1]!("SUBSCRIBED");
      await vi.advanceTimersByTimeAsync(250);
    });
    expect(hook.result.current.connection).toBe("connected");
    act(() => callbacks[0]!("CLOSED"));
    expect(hook.result.current.connection).toBe("connected");
  } finally {
    hook.unmount();
  }
});
