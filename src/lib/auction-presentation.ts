import type { Bid, RoomEvent, RoomPlayer, Sale, Participant } from "@/hooks/use-room";
import type { SaleSnapshot } from "@/components/auction/SaleReveal";

/** Sale rows, not mutable lot state or parsed log messages, supply winner and price. */
export function saleSnapshot(record: Sale, pool: RoomPlayer[], participants: Participant[]): SaleSnapshot | null {
  if (record.undone) return null;
  const lot = pool.find(rp => rp.id === record.room_player_id);
  const team = participants.find(p => p.id === record.participant_id);
  if (!lot || (record.participant_id && !team)) return null;
  return { id: record.id, kind: record.participant_id ? "sold" : "unsold", player: { ...lot.player }, price: record.price == null ? null : Number(record.price), ...(team ? { team: { name: team.team_name, color: team.color } } : {}) };
}

/** Match the server's queue, including accelerated lots and explicit undo priority. */
export function pendingLots(pool: RoomPlayer[]) {
  return pool.filter(p => p.status === "pending").sort((a, b) => a.round - b.round || a.lot_order - b.lot_order);
}

/** Baseline historic IDs once; an initially empty feed must still celebrate its first event. */
export function unseenEvents<T extends { id: string | number }>(items: T[], seen: Set<string | number>, initialized: boolean): T[] {
  const fresh = initialized ? items.filter(item => !seen.has(item.id)) : [];
  items.forEach(item => seen.add(item.id));
  return fresh;
}
export function resolvedLot(event: RoomEvent, pool: RoomPlayer[]) {
  if(event.room_player_id) return pool.find(p=>p.id===event.room_player_id && p.status===event.kind);
  return pool.filter(p => p.status === event.kind && event.message.startsWith(p.player.name + " ")).sort((a,b) => b.round-a.round)[0];
}
export function bidChange(bid: Bid, previous: number | null) {
  return previous == null ? 0 : Math.max(0, Math.round((Number(bid.amount)-previous)*100)/100);
}