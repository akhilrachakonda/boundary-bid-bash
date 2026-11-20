import type { Bid, Participant, Room, RoomPlayer, Sale, SquadRow } from '@/hooks/use-room';

export interface LiveProjection {
  room: Room;
  states: Partial<RoomPlayer>[] | null;
  pool_revision?: number;
  revision?: number;
  bids?: Bid[];
  participants?: Participant[];
  squads?: SquadRow[];
  sales?: Sale[];
}

/** Refuse stale replies or partial snapshots from another room or catalogue. */
export function mergeLiveProjection(current: Room, pool: RoomPlayer[], live: LiveProjection, revision: number, poolRevision: number | null = null) {
  if (current.id !== live.room.id || (live.revision ?? 0) < revision ||
      current.evaluation_snapshot !== live.room.evaluation_snapshot) return null;
  if (live.states === null) {
    return poolRevision !== null && live.pool_revision === poolRevision ? pool : null;
  }
  if (!Array.isArray(live.states) || live.states.length !== pool.length) return null;
  const states = new Map(live.states.map(state => [state.id, state]));
  if (states.size !== pool.length || pool.some(player => !states.has(player.id))) return null;
  return pool.map(player => {
    const state = states.get(player.id)!;
    const changed = Object.entries(state).some(([key, value]) => player[key as keyof RoomPlayer] !== value);
    return changed ? { ...player, ...state } : player;
  });
}
