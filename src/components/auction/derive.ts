import { squadCounts, type Player } from "@/lib/auction-rules";
import type { useRoom } from "@/hooks/use-room";

export type RoomData = ReturnType<typeof useRoom>;

export function derive(d: RoomData, userId: string | undefined) {
  const me = d.participants.find((p) => p.user_id === userId) ?? null;
  const playerById = new Map<string, Player>();
  d.pool.forEach((rp) => playerById.set(rp.player_id, rp.player));
  const partById = new Map(d.participants.map((p) => [p.id, p]));
  const squadOf = (pid: string) =>
    d.squads.filter((s) => s.participant_id === pid).map((s) => playerById.get(s.player_id)!).filter(Boolean);
  const mySquad = me ? squadOf(me.id) : [];
  const ownerOf = (playerId: string) => {
    const s = d.squads.find((x) => x.player_id === playerId);
    return s ? partById.get(s.participant_id) ?? null : null;
  };
  const isHost = !!d.room && d.room.host_id === userId;
  const spentOf = (pid: string) =>
    d.squads.filter((s) => s.participant_id === pid).reduce((a, s) => a + Number(s.price), 0);
  return {
    me,
    isHost,
    playerById,
    partById,
    squadOf,
    mySquad,
    myCounts: squadCounts(mySquad),
    ownerOf,
    spentOf,
  };
}
export type Derived = ReturnType<typeof derive>;
