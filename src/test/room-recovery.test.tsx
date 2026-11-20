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
  const member = { id: "participant", user_id: "user", last_seen: new Date().toISOString() };
  let holdRoom = false;
  let interrupted: AbortSignal | undefined;
  const rpc = vi.mocked(supabase.rpc);
  rpc.mockImplementation(
    (fn) =>
      ({
        abortSignal: (signal: AbortSignal) =>
          fn === "room_projection" && holdRoom
            ? new Promise(resolve => {
                interrupted = signal;
                signal.addEventListener("abort", () => resolve({data:null,error:{message:"aborted"}}),{once:true});
              })
            : fn === "server_now"
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
  const events = new Map<string,(payload:unknown)=>void>();
  const callbacks: ((status: string) => void)[] = [];
  vi.mocked(supabase.channel).mockImplementation(() => {
    const channel = {
      on: (_type: string, filter: {table:string}, fn:(payload:unknown)=>void) => {events.set(filter.table,fn);return channel;},
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
    holdRoom = true;
    await act(async () => {
      void hook.result.current.reload("rooms");
      await vi.advanceTimersByTimeAsync(0);
      window.dispatchEvent(new Event("pagehide"));
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(interrupted?.aborted).toBe(true);
    holdRoom = false;
    const roomReads = () => rpc.mock.calls.filter(([name]) => name === "room_projection").length;
    const hidden = vi.spyOn(document,"visibilityState","get").mockReturnValue("hidden");
    try {
      const before = roomReads();
      await act(async () => {
        events.get("room_updates")!({new:{revision:12}});
        await vi.advanceTimersByTimeAsync(34000);
      });
      expect(roomReads()).toBe(before);
      hidden.mockReturnValue("visible");
      await act(async () => {
        document.dispatchEvent(new Event("visibilitychange"));
        await vi.advanceTimersByTimeAsync(0);
      });
      expect(roomReads()).toBe(before + 1);
      const list = hook.result.current.participants;
      const lastRead = reads;
      const stamp = new Date(Date.now()+1000).toISOString();
      await act(async () => {
        events.get("participants")!({eventType:"UPDATE",new:{...member,last_seen:stamp}});
        await vi.advanceTimersByTimeAsync(300);
      });
      expect(reads).toBe(lastRead);
      expect(hook.result.current.participants).toBe(list);
      expect(hook.result.current.lastSeen(list[0]!)).toBe(Date.parse(stamp));
    } finally {hidden.mockRestore();}
  } finally {
    hook.unmount();
  }
});

it("skips reads while hidden and refreshes immediately on return despite a previous failure", async () => {
  vi.useFakeTimers();
  const {createRefetchCoordinator}=await import("@/lib/refetch-coordinator");
  let visible=true;
  const read=vi.fn().mockRejectedValueOnce(new Error("network")).mockResolvedValue("current lot");
  const queue=createRefetchCoordinator(read,240,()=>visible);
  try {
    queue.schedule("rooms");
    await vi.advanceTimersByTimeAsync(240);
    visible=false;
    for (let i=0;i<20;i++) {
      queue.schedule("rooms");
      await vi.advanceTimersByTimeAsync(1000);
    }
    expect(read).toHaveBeenCalledTimes(1);
    visible=true;
    queue.resume(["rooms"]);
    await vi.advanceTimersByTimeAsync(0);
    expect(read).toHaveBeenCalledTimes(2);
    // Even with a fresh network backoff, a manual retry reads immediately.
    read.mockRejectedValueOnce(new Error("network"));
    await expect(queue.refresh("rooms")).rejects.toThrow("network");
    queue.resume(["rooms"]);
    await vi.advanceTimersByTimeAsync(0);
    expect(read).toHaveBeenCalledTimes(4);
  } finally { queue.dispose(); }
});

it("recognizes heartbeat-only events and preserves team changes",async()=>{
  const {onlyPresenceChanged}=await import("@/lib/room-presence");
  const member={id:"team",user_id:"one",team_name:"CSK",purse:80,last_seen:"2026-11-20T10:00:00Z"} as import("@/hooks/use-room").Participant;
  const heartbeat={...member,last_seen:"2026-11-20T10:00:25Z"};
  expect(onlyPresenceChanged(member,heartbeat)).toBe(true);
  expect(onlyPresenceChanged(member,{...heartbeat,purse:75})).toBe(false);
  expect(onlyPresenceChanged(member,{...heartbeat,user_id:"two"})).toBe(false);
  expect(onlyPresenceChanged(member,{id:"team",last_seen:heartbeat.last_seen})).toBe(false);
});

it("explains transport failures while preserving a server bid rejection",async()=>{
  const {actionError}=await import("@/lib/connection-recovery");
  expect(actionError({message:"TypeError: Failed to fetch",code:""})).toMatch(/Connection interrupted/);
  expect(actionError({message:"signal timed out"})).toMatch(/Connection interrupted/);
  expect(actionError({message:"Player changed; refresh before bidding",code:"P0001"})).toBe("Player changed; refresh before bidding");
});
