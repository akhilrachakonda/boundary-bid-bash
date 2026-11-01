export type BidRequestState = "idle" | "pending" | "uncertain";
export type BidReply = "accepted" | "rejected" | "uncertain";
/** One captured request, no click queue. Unknown outcomes retain the original idempotency key. */
export class BidRequestGate<T> {
  state: BidRequestState = "idle";
  private request: T | undefined;
  constructor(private send: (request: T) => Promise<BidReply>, private reconcile: (request: T) => Promise<"accepted" | "absent" | "unknown">, private changed: (state: BidRequestState, accepted: boolean) => void) {}
  async submit(request: T) {
    if (this.state !== "idle") return;
    this.request = request;
    await this.execute(request);
  }
  async retry() {
    if (this.state !== "uncertain" || this.request === undefined) return;
    const request = this.request;
    this.set("pending");
    let result: "accepted" | "absent" | "unknown" = "unknown";
    try { result = await this.reconcile(request); } catch { /* Keep unknown outcome locked. */ }
    if (result === "accepted") { this.request = undefined; this.set("idle", true); }
    else if (result === "absent") await this.execute(request);
    else this.set("uncertain");
  }
  private set(state: BidRequestState, accepted = false) { this.state = state; this.changed(state, accepted); }
  private async execute(request: T) {
    this.set("pending");
    let result: BidReply = "uncertain";
    try { result = await this.send(request); } catch { /* Transport failure is not a rejected bid. */ }
    if (result === "uncertain") {
      try { if (await this.reconcile(request) === "accepted") result = "accepted"; } catch { /* Remain locked. */ }
    }
    if (result === "uncertain") this.set("uncertain");
    else { this.request = undefined; this.set("idle", result === "accepted"); }
  }
}