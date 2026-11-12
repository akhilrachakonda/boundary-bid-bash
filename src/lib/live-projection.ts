import type { Bid, Participant, Room, RoomPlayer, Sale, SquadRow } from '@/hooks/use-room';

export interface LiveProjection {
  room: Room;
  states: Partial<RoomPlayer>[];
  revision?: number;
  bids?: Bid[];
  participants?: Participant[];
  squads?: SquadRow[];
  sales?: Sale[];
}

/** Refuse stale replies or partial snapshots from another room or catalogue. */
export function mergeLiveProjection(current: Room, pool: RoomPlayer[], live: LiveProjection, revision: number) {
  if (current.id !== live.room.id || (live.revision ?? 0) < revision ||
      current.evaluation_snapshot !== live.room.evaluation_snapshot || live.states.length !== pool.length) return null;
  const states = new Map(live.states.map(state => [state.id, state]));
  if (states.size !== pool.length || pool.some(player => !states.has(player.id))) return null;
  return pool.map(player => {
    const state = states.get(player.id)!;
    const changed = Object.entries(state).some(([key, value]) => player[key as keyof RoomPlayer] !== value);
    return changed ? { ...player, ...state } : player;
  });
}
