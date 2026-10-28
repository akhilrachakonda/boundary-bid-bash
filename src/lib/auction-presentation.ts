import type { Bid, RoomEvent, RoomPlayer } from "@/hooks/use-room";

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