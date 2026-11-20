import type { bidArgs } from "./room-actions";

type BidArgs = ReturnType<typeof bidArgs>;

// A suspended tab can be discarded after the server receives a bid but before it replies.
export function readPendingBid(key: string, roomId: string): BidArgs | undefined {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return;
    const bid = JSON.parse(raw);
    if (
      bid?.p_room === roomId &&
      typeof bid.p_lot === "string" &&
      bid.p_lot &&
      typeof bid.p_request === "string" &&
      bid.p_request &&
      Number.isSafeInteger(bid.p_version) &&
      Number.isFinite(bid.p_amount) &&
      bid.p_amount > 0
    )
      return bid;
  } catch {
    /* Storage can be unavailable in a private browser. */
  }
  return undefined;
}

export function rememberPendingBid(key: string, bid?: BidArgs) {
  try {
    if (bid) sessionStorage.setItem(key, JSON.stringify(bid));
    else sessionStorage.removeItem(key);
  } catch {
    /* The active tab still retains its in-memory bid guard. */
  }
}
