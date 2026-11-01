import { afterEach, describe, expect, it, vi } from "vitest";
import { BidRequestGate } from "@/lib/bid-request-gate";
import { createRefetchCoordinator } from "@/lib/refetch-coordinator";

afterEach(() => vi.useRealTimers());
describe("bounded bid requests", () => {
  it("coalesces 100 pending presses into exactly one captured request, without autobids", async () => {
    let finish: (value: "accepted") => void = () => {};
    const send = vi.fn(() => new Promise<"accepted">(resolve => { finish = resolve; }));
    const gate = new BidRequestGate(send, async () => "absent", () => {});
    const first = gate.submit({ id: "original", lot: "lot-1", version: 3, amount: 2 });
    for (let i = 0; i < 100; i++) void gate.submit({ id: `extra-${i}`, lot: "lot-2", version: 4, amount: 3 });
    expect(send).toHaveBeenCalledTimes(1); expect(gate.state).toBe("pending");
    finish("accepted"); await first;
    expect(gate.state).toBe("idle"); expect(send).toHaveBeenCalledTimes(1);
  });
  it("reconciles before retry and reuses the exact original lot/version/amount/request ID", async () => {
    const calls: string[] = [];
    const args = { id: "retry-1", lot: "lot-1", version: 8, amount: 2.5 };
    const send = vi.fn(async (_request: typeof args) => { calls.push("send"); return "uncertain" as const; });
    const gate = new BidRequestGate(send, async () => { calls.push("read"); return "absent"; }, () => {});
    await gate.submit(args); await gate.submit({ ...args, id: "wrong", lot: "next" }); await gate.retry();
    expect(calls).toEqual(["send", "read", "read", "send", "read"]);
    expect(send.mock.calls).toEqual([[args], [args]]); expect(gate.state).toBe("uncertain");
  });
  it("does not resend an accepted request or retry while reconciliation is unavailable", async () => {
    const send = vi.fn(async () => "uncertain" as const);
    const read = vi.fn().mockResolvedValueOnce("unknown").mockResolvedValueOnce("unknown").mockResolvedValueOnce("accepted");
    const gate = new BidRequestGate(send, read, () => {});
    await gate.submit("original"); await gate.retry(); expect(gate.state).toBe("uncertain");
    await gate.retry(); expect(gate.state).toBe("idle"); expect(send).toHaveBeenCalledTimes(1);
  });
  it("clears pending on explicit rejection and contains transport exceptions", async () => {
    const gate = new BidRequestGate(async () => "rejected", async () => "unknown", () => {});
    await gate.submit("rejected"); expect(gate.state).toBe("idle");
    const broken = new BidRequestGate(async () => { throw Error("offline"); }, async () => { throw Error("offline"); }, () => {});
    await broken.submit("unknown"); expect(broken.state).toBe("uncertain");
  });
});
describe("revision read coordination", () => {
  it("flushes sustained bursts in a fixed 80ms window instead of postponing indefinitely", async () => {
    vi.useFakeTimers(); const read = vi.fn(async () => {}); const queue = createRefetchCoordinator(read);
    for (let i = 0; i < 8; i++) { queue.schedule("rooms"); await vi.advanceTimersByTimeAsync(10); }
    expect(read).toHaveBeenCalledTimes(1); queue.dispose();
  });
  it("allows one in-flight read plus one coalesced trailing read per table", async () => {
    vi.useFakeTimers(); let finish: () => void = () => {};
    const read = vi.fn(() => new Promise<void>(resolve => { finish = resolve; }));
    const queue = createRefetchCoordinator(read); queue.schedule("rooms"); await vi.advanceTimersByTimeAsync(80);
    for (let i = 0; i < 100; i++) queue.schedule("rooms"); await vi.advanceTimersByTimeAsync(80);
    expect(read).toHaveBeenCalledTimes(1); finish(); await vi.advanceTimersByTimeAsync(80);
    expect(read).toHaveBeenCalledTimes(2); queue.dispose(); finish();
  });
  it("cancels scheduled reads on unmount", async () => {
    vi.useFakeTimers(); const read = vi.fn(async () => {}); const queue = createRefetchCoordinator(read);
    queue.schedule("rooms"); queue.dispose(); await vi.advanceTimersByTimeAsync(1000); expect(read).not.toHaveBeenCalled();
  });
});