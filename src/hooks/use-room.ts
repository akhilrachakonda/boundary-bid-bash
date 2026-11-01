import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Player, Settings } from "@/lib/auction-rules";
import { withCanonicalPhoto } from "@/lib/player-photos";
import { createRefetchCoordinator } from "@/lib/refetch-coordinator";
import { repairsEnabled, type RepairCapabilities } from "@/lib/post-launch-controls";

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
  lot_version: number;
  bid_session?: number;
  bid_revision?: number;
  current_bid: number | null;
  current_bidder: string | null;
  lot_ends_at: string | null;
  paused_remaining_ms: number | null;
  accel_done: boolean;
  trade_ends_at: string | null;
  evaluation_version?: string;
  evaluation_snapshot?: string | null;
  repair_flow?: boolean;
  auction_stage?: "round" | "final_call" | "closed";
  auction_round?: number;
  control_revision?: number;
  next_lot_settings?: { bid_timer?: number; bid_reset?: number };
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
  lot_session?: number;
  accepted_order?: number | null;
  undone?: boolean;
  request_id?: string | null;
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

export interface Sale { id: string; room_player_id: string; participant_id: string | null; price: number | null; undone: boolean; created_at: string }
type Table = "rooms" | "participants" | "bids" | "squads" | "trades" | "room_events" | "sales";

export function useRoom(roomId: string, userId: string | undefined) {
  const [room, setRoom] = useState<Room | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [pool, setPool] = useState<RoomPlayer[]>([]);
  const [bids, setBids] = useState<Bid[]>([]);
  const [squads, setSquads] = useState<SquadRow[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [events, setEvents] = useState<RoomEvent[]>([]);
  const [notes, setNotes] = useState<Notes>({ targets: {}, xi: { order: [], overs: {} }, notes: "" });
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [capabilities,setCapabilities]=useState<RepairCapabilities>({});
  const capabilitiesRef=useRef<RepairCapabilities>({});
  const poolRef=useRef<RoomPlayer[]>([]);
  const [offset, setOffset] = useState(0);
  const [connection, setConnection] = useState("connecting");
  const roomRef = useRef<Room | null>(null);
  const generation = useRef(0);
  const projectionRef = useRef("");
  roomRef.current = room;

  const load = useCallback(
    async (t: Table) => {
      const epoch = generation.current;
      const current = () => epoch === generation.current;
      switch (t) {
        case "rooms": {
          if(repairsEnabled(roomRef.current,capabilitiesRef.current) && poolRef.current.length && roomRef.current?.status!=="lobby") {
            try {
              const {data,error}=await supabase.rpc("room_live_projection" as never,{p_room:roomId} as never).abortSignal(AbortSignal.timeout(5000));
              if(!current())return null;
              const live=data as unknown as {room:Room;states:Partial<RoomPlayer>[]} | null;
              if(!error && live && live.room.evaluation_snapshot===roomRef.current?.evaluation_snapshot && live.states.length===poolRef.current.length && live.states.every(state=>poolRef.current.some(player=>player.id===state.id))){
                const states=new Map(live.states.map(state=>[state.id,state]));
                const merged=poolRef.current.map(player=>({...player,...states.get(player.id)}));
                const changed=merged.some((player,index)=>JSON.stringify(player)!==JSON.stringify(poolRef.current[index]));
                if(changed){poolRef.current=merged;setPool(merged);}
                projectionRef.current="";
                setError(null);setRoom(live.room);roomRef.current=live.room;return live.room;
              }
            } catch { if(!current())return null; /* Fall back to the full bounded projection. */ }
          }
          const { data, error } = await supabase.rpc("room_projection", { p_room: roomId }).abortSignal(AbortSignal.timeout(5000));
          const projection = data as unknown as { room: Room; pool: RoomPlayer[]; capabilities?: RepairCapabilities } | null;
          if (!current()) return null;
          if (error) { if (!roomRef.current || error.code === 'P0001') setError(error.message); else setConnection('reconnecting'); }
          else if (!projection) setError("Room not found or you are not a member.");
          else {
            capabilitiesRef.current=projection.capabilities??{};setCapabilities(capabilitiesRef.current);
            setError(null); setRoom(projection.room); roomRef.current=projection.room;
            const poolKey = JSON.stringify(projection.pool);
            if (poolKey !== projectionRef.current) {
              projectionRef.current = poolKey;
              poolRef.current=projection.pool.map(rp=>({...rp,player:withCanonicalPhoto(rp.player)}));
              setPool(poolRef.current);
            }
          }
          return projection?.room ?? null;
        }
        case "participants": {
          const { data } = await supabase.from("participants").select("*").eq("room_id", roomId).order("joined_at").abortSignal(AbortSignal.timeout(5000));
          if (current() && data) setParticipants(data as Participant[]);
          return;
        }
        case "sales": {
          const {data}=await supabase.from("sales").select("*").eq("room_id",roomId).order("created_at",{ascending:false}).order("id",{ascending:false}).abortSignal(AbortSignal.timeout(5000));
          if (current() && data) setSales(data as Sale[]); return;
        }
        case "bids": {
          const rp = roomRef.current?.current_rp;
          if (!rp) return setBids([]);
          let query = supabase
            .from("bids")
            .select("*")
            .eq("room_player_id", rp);
          const session = roomRef.current?.bid_session;
          if (repairsEnabled(roomRef.current,capabilitiesRef.current)) {
            query = query.eq("lot_session" as never, session ?? 0).eq("undone" as never, false)
              .order("accepted_order" as never, { ascending: false, nullsFirst: false });
          }
          const { data } = await query
            .order("created_at", { ascending: false })
            .limit(30).abortSignal(AbortSignal.timeout(5000));
          if (current() && data && rp === roomRef.current?.current_rp && session===roomRef.current?.bid_session) setBids((data as Bid[]).filter(b=>!b.undone));
          return;
        }
        case "squads": {
          const { data } = await supabase.from("squads").select("*").eq("room_id", roomId).abortSignal(AbortSignal.timeout(5000));
          if (current() && data) setSquads(data as SquadRow[]);
          return;
        }
        case "trades": {
          const { data } = await supabase
            .from("trades")
            .select("*")
            .eq("room_id", roomId)
            .order("created_at", { ascending: false }).abortSignal(AbortSignal.timeout(5000));
          if (current() && data) setTrades(data as Trade[]);
          return;
        }
        case "room_events": {
          const { data } = await supabase
            .from("room_events")
            .select("*")
            .eq("room_id", roomId)
            .order("id", { ascending: false })
            .limit(60).abortSignal(AbortSignal.timeout(5000));
          if (current() && data) setEvents(data as RoomEvent[]);
          return;
        }
      }
    },
    [roomId],
  );

  const coordinator = useRef<ReturnType<typeof createRefetchCoordinator<Table>> | null>(null);
  const reload = useCallback((t: Table) => coordinator.current?.refresh(t) ?? Promise.resolve(null), []);
  useEffect(() => {
    generation.current++;
    projectionRef.current = "";
    capabilitiesRef.current={};setCapabilities({});poolRef.current=[];roomRef.current=null;setRoom(null);setLoaded(false);
    const queue = createRefetchCoordinator(load);
    coordinator.current = queue;
    return () => { generation.current++; queue.dispose(); if (coordinator.current === queue) coordinator.current = null; };
  }, [load]);

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
      if (!alive) return;
      if (alive && now) setOffset(new Date(now as string).getTime() - (t0 + t1) / 2);
      await reload("rooms");
      await Promise.all([
        reload("participants"),
        reload("squads"),
        reload("sales"),
        reload("trades"),
        reload("room_events"),
        loadNotes(),
      ]);
      if (alive) setLoaded(true);
    })().catch(() => { if (alive) setError("Could not load the room. Check your connection and refresh."); });
    return () => {
      alive = false;
    };
  }, [load, reload, loadNotes]);

  // reload bids when lot changes
  useEffect(() => {
    void reload("bids").catch(() => {});
  }, [room?.current_rp, room?.bid_session, reload]);

  // realtime
  useEffect(() => {
    const queue = (t: Table) => coordinator.current?.schedule(t);
    const tables: Table[] = ["participants", "bids", "squads", "trades", "room_events", "sales"];
    let ch = supabase.channel(`room-${roomId}-${Math.random().toString(36).slice(2)}`);
    for (const t of tables) {
      ch = ch.on(
        "postgres_changes",
        { event: "*", schema: "public", table: t, filter: `room_id=eq.${roomId}` },
        () => queue(t),
      );
    }
    ch=ch.on("postgres_changes",{event:"*",schema:"public",table:"room_updates",filter:`room_id=eq.${roomId}`},()=>queue("rooms"));
    ch.subscribe((status) => {
      setConnection(status === "SUBSCRIBED" ? "connected" : "reconnecting");
      // on (re)connect, resync everything so reconnects restore state
      if (status === "SUBSCRIBED") { tables.forEach(queue);queue("rooms"); }
    });
    return () => {
      supabase.removeChannel(ch);
    };
  }, [roomId, load]);

  // heartbeat + server tick driver
  useEffect(() => {
    if (!loaded) return;
    const hb = setInterval(() => supabase.rpc("heartbeat", { p_room: roomId }), 10000);
    supabase.rpc("heartbeat", { p_room: roomId });
    let inflight = false;
    let nextAttempt = 0;
    const tk = setInterval(async () => {
      const r = roomRef.current;
      if (!r || inflight || Date.now() < nextAttempt) return;
      const now = Date.now() + offset;
      const due =
        (r.status === "review" && r.review_ends_at && now >= new Date(r.review_ends_at).getTime()) ||
        (r.status === "auction" && r.lot_ends_at && now >= new Date(r.lot_ends_at).getTime()) ||
        (r.status === "trade" && r.trade_ends_at && now >= new Date(r.trade_ends_at).getTime());
      if (!due) return;
      inflight = true;
      nextAttempt = Date.now() + 2000;
      try { await supabase.rpc("tick", { p_room: roomId }).abortSignal(AbortSignal.timeout(5000)); coordinator.current?.schedule("rooms"); }
      catch { /* Bounded retry after a transport failure. */ }
      finally { inflight = false; }
    }, 700);
    const onFocus = () => (["rooms", "participants", "squads", "sales", "trades", "bids"] as Table[]).forEach(t => coordinator.current?.schedule(t));
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(hb);
      clearInterval(tk);
      window.removeEventListener("focus", onFocus);
    };
  }, [loaded, roomId, offset, load]);

  return useMemo(() => ({ room, participants, pool, bids, squads, sales, trades, events, notes, saveNotes, error, loaded, offset, connection, capabilities, reload }),
    [room, participants, pool, bids, squads, sales, trades, events, notes, saveNotes, error, loaded, offset, connection, capabilities, reload]);
}

export function useNow(offset: number, ms = 100) {
  const [now, setNow] = useState(() => Date.now() + offset);
  useEffect(() => {
    const i = setInterval(() => setNow(Date.now() + offset), ms);
    return () => clearInterval(i);
  }, [offset, ms]);
  return now;
}
