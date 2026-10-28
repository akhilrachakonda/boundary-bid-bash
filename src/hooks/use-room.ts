import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Player, Settings } from "@/lib/auction-rules";
import { withCanonicalPhoto } from "@/lib/player-photos";

export interface Room {
  id: string;
  code: string;
  name: string;
  host_id: string;
  format: string;
  settings: Settings;
  status: "lobby" | "review" | "auction" | "paused" | "completed" | "trade" | "results";
  review_ends_at: string | null;
  current_rp: string | null;
  current_bid: number | null;
  current_bidder: string | null;
  lot_ends_at: string | null;
  paused_remaining_ms: number | null;
  accel_done: boolean;
  trade_ends_at: string | null;
}
export interface Participant {
  id: string;
  user_id: string;
  nickname: string;
  team_name: string;
  color: string;
  purse: number;
  is_ready: boolean;
  last_seen: string;
}
export interface RoomPlayer {
  id: string;
  player_id: string;
  set_name: string;
  lot_order: number;
  round: number;
  status: "pending" | "live" | "sold" | "unsold";
  sold_to: string | null;
  sold_price: number | null;
  player: Player;
}
export interface Bid {
  id: string;
  room_player_id: string;
  participant_id: string;
  amount: number;
  created_at: string;
}
export interface SquadRow {
  id: string;
  participant_id: string;
  player_id: string;
  price: number;
  acquired_via: string;
}
export interface Trade {
  id: string;
  from_participant: string;
  to_participant: string;
  offer_players: string[];
  request_players: string[];
  cash: number;
  status: string;
  parent_trade_id: string | null;
  created_at: string;
}
export interface RoomEvent {
  id: number;
  room_player_id?: string | null;
  kind: string;
  message: string;
  created_at: string;
}
export interface Notes {
  targets: Record<string, { max?: number | undefined; note?: string | undefined }>;
  xi: { order: string[]; overs: Record<string, number> };
  notes: string;
}

type Table = "rooms" | "participants" | "room_players" | "bids" | "squads" | "trades" | "room_events";

export function useRoom(roomId: string, userId: string | undefined) {
  const [room, setRoom] = useState<Room | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [pool, setPool] = useState<RoomPlayer[]>([]);
  const [bids, setBids] = useState<Bid[]>([]);
  const [squads, setSquads] = useState<SquadRow[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [events, setEvents] = useState<RoomEvent[]>([]);
  const [notes, setNotes] = useState<Notes>({ targets: {}, xi: { order: [], overs: {} }, notes: "" });
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [offset, setOffset] = useState(0);
  const [connection, setConnection] = useState("connecting");
  const roomRef = useRef<Room | null>(null);
  roomRef.current = room;

  const load = useCallback(
    async (t: Table) => {
      switch (t) {
        case "rooms": {
          const { data, error } = await supabase.from("rooms").select("*").eq("id", roomId).maybeSingle();
          if (error) setError(error.message);
          else if (!data) setError("Room not found or you are not a member.");
          else setRoom(data as unknown as Room);
          return data as unknown as Room | null;
        }
        case "participants": {
          const { data } = await supabase.from("participants").select("*").eq("room_id", roomId).order("joined_at");
          setParticipants((data ?? []) as Participant[]);
          return;
        }
        case "room_players": {
          const { data } = await supabase
            .from("room_players")
            .select("*, player:players(*)")
            .eq("room_id", roomId)
            .order("round")
            .order("lot_order");
          setPool(((data ?? []) as unknown as RoomPlayer[]).map(rp=>({...rp,player:withCanonicalPhoto(rp.player)})));
          return;
        }
        case "bids": {
          const rp = roomRef.current?.current_rp;
          if (!rp) return setBids([]);
          const { data } = await supabase
            .from("bids")
            .select("*")
            .eq("room_player_id", rp)
            .order("created_at", { ascending: false })
            .limit(30);
          setBids((data ?? []) as Bid[]);
          return;
        }
        case "squads": {
          const { data } = await supabase.from("squads").select("*").eq("room_id", roomId);
          setSquads((data ?? []) as SquadRow[]);
          return;
        }
        case "trades": {
          const { data } = await supabase
            .from("trades")
            .select("*")
            .eq("room_id", roomId)
            .order("created_at", { ascending: false });
          setTrades((data ?? []) as Trade[]);
          return;
        }
        case "room_events": {
          const { data } = await supabase
            .from("room_events")
            .select("*")
            .eq("room_id", roomId)
            .order("id", { ascending: false })
            .limit(60);
          setEvents((data ?? []) as RoomEvent[]);
          return;
        }
      }
    },
    [roomId],
  );

  const loadNotes = useCallback(async () => {
    if (!userId) return;
    const { data } = await supabase
      .from("private_notes")
      .select("*")
      .eq("room_id", roomId)
      .eq("user_id", userId)
      .maybeSingle();
    if (data) setNotes({ targets: data.targets as Notes["targets"], xi: data.xi as Notes["xi"], notes: data.notes });
  }, [roomId, userId]);

  const saveNotes = useCallback(
    async (n: Notes) => {
      setNotes(n);
      if (!userId) return;
      const { error } = await supabase.from("private_notes").upsert(
        { room_id: roomId, user_id: userId, targets: n.targets, xi: n.xi, notes: n.notes, updated_at: new Date().toISOString() },
        { onConflict: "room_id,user_id" },
      );
      if (error) throw error;
    },
    [roomId, userId],
  );

  // initial load + clock sync
  useEffect(() => {
    let alive = true;
    (async () => {
      const t0 = Date.now();
      const { data: now } = await supabase.rpc("server_now");
      const t1 = Date.now();
      if (alive && now) setOffset(new Date(now as string).getTime() - (t0 + t1) / 2);
      await load("rooms");
      await Promise.all([
        load("participants"),
        load("room_players"),
        load("bids"),
        load("squads"),
        load("trades"),
        load("room_events"),
        loadNotes(),
      ]);
      if (alive) setLoaded(true);
    })();
    return () => {
      alive = false;
    };
  }, [load, loadNotes]);

  // reload bids when lot changes
  useEffect(() => {
    load("bids");
  }, [room?.current_rp, load]);

  // realtime
  useEffect(() => {
    const timers: Partial<Record<Table, ReturnType<typeof setTimeout>>> = {};
    const queue = (t: Table) => {
      clearTimeout(timers[t]);
      timers[t] = setTimeout(() => load(t), 80);
    };
    const tables: Table[] = ["rooms", "participants", "room_players", "bids", "squads", "trades", "room_events"];
    let ch = supabase.channel(`room-${roomId}-${Math.random().toString(36).slice(2)}`);
    for (const t of tables) {
      ch = ch.on(
        "postgres_changes",
        { event: "*", schema: "public", table: t, filter: t === "rooms" ? `id=eq.${roomId}` : `room_id=eq.${roomId}` },
        () => queue(t),
      );
    }
    ch.subscribe((status) => {
      setConnection(status === "SUBSCRIBED" ? "connected" : "reconnecting");
      // on (re)connect, resync everything so reconnects restore state
      if (status === "SUBSCRIBED") tables.forEach(queue);
    });
    return () => {
      Object.values(timers).forEach((x) => clearTimeout(x));
      supabase.removeChannel(ch);
    };
  }, [roomId, load]);

  // heartbeat + server tick driver
  useEffect(() => {
    if (!loaded) return;
    const hb = setInterval(() => supabase.rpc("heartbeat", { p_room: roomId }), 10000);
    supabase.rpc("heartbeat", { p_room: roomId });
    let inflight = false;
    const tk = setInterval(async () => {
      const r = roomRef.current;
      if (!r || inflight) return;
      const now = Date.now() + offset;
      const due =
        (r.status === "review" && r.review_ends_at && now >= new Date(r.review_ends_at).getTime()) ||
        (r.status === "auction" && r.lot_ends_at && now >= new Date(r.lot_ends_at).getTime()) ||
        (r.status === "trade" && r.trade_ends_at && now >= new Date(r.trade_ends_at).getTime());
      if (!due) return;
      inflight = true;
      await supabase.rpc("tick", { p_room: roomId });
      inflight = false;
    }, 700);
    const onFocus = () => (["rooms", "participants", "room_players", "squads", "trades", "bids"] as Table[]).forEach(load);
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(hb);
      clearInterval(tk);
      window.removeEventListener("focus", onFocus);
    };
  }, [loaded, roomId, offset, load]);

  return { room, participants, pool, bids, squads, trades, events, notes, saveNotes, error, loaded, offset, connection, reload: load };
}

export function useNow(offset: number, ms = 100) {
  const [now, setNow] = useState(() => Date.now() + offset);
  useEffect(() => {
    const i = setInterval(() => setNow(Date.now() + offset), ms);
    return () => clearInterval(i);
  }, [offset, ms]);
  return now;
}
