import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Player, Settings } from "@/lib/auction-rules";
import { withCanonicalPhoto } from "@/lib/player-photos";
import { createRefetchCoordinator } from "@/lib/refetch-coordinator";
import { repairsEnabled, type RepairCapabilities } from "@/lib/post-launch-controls";
import { mergeLiveProjection, type LiveProjection } from '@/lib/live-projection';

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
  catalogue_version?: string | null;
  community_mode?: boolean;
  post_phase?: "lineup" | "rating" | "done" | null;
  phase_ends_at?: string | null;
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
  const channelHealthy=useRef(false);
  const participantsRef=useRef(participants); participantsRef.current=participants;
  const generation = useRef(0);
  const projectionRef = useRef("");
  const revisionRef = useRef(0);
  const readVersions = useRef({participants:0,bids:0,squads:0,sales:0});
  roomRef.current = room;

  const applyLive = useCallback((live: LiveProjection) => {
    if (!roomRef.current || live.room.id !== roomId) return false;
    const merged = mergeLiveProjection(roomRef.current, poolRef.current, live, revisionRef.current);
    if (!merged) return false;
    revisionRef.current = live.revision ?? revisionRef.current;
    if (merged.some((player,index) => player !== poolRef.current[index])) {
      poolRef.current = merged;
      setPool(merged);
    }
    if (live.bids) { readVersions.current.bids++; setBids(live.bids); }
    if (live.participants) { readVersions.current.participants++; setParticipants(live.participants); }
    if (live.squads) { readVersions.current.squads++; setSquads(live.squads); }
    if (live.sales) { readVersions.current.sales++; setSales(live.sales); }
    projectionRef.current = '';
    roomRef.current = live.room;
    setRoom(live.room);
    setError(null);
    if(channelHealthy.current)setConnection("connected");
    return true;
  }, [roomId]);

  const load = useCallback(
    async (t: Table) => {
      const epoch = generation.current;
      const collection = t as keyof typeof readVersions.current;
      const readVersion = readVersions.current[collection];
      const current = () => epoch === generation.current && readVersions.current[collection] === readVersion;
      switch (t) {
        case "rooms": {
          if(repairsEnabled(roomRef.current,capabilitiesRef.current) && poolRef.current.length && roomRef.current?.status!=="lobby") {
            try {
              const sync = capabilitiesRef.current.action_sync === 1;
              const bounded=capabilitiesRef.current.bounded_poll===1;
              const {data,error}=await supabase.rpc((bounded?"room_poll":sync ? "room_sync" : "room_live_projection") as never,(bounded?{p_room:roomId,p_revision:revisionRef.current}:{p_room:roomId}) as never).abortSignal(AbortSignal.timeout(5000));
              if(!current())return null;
              if(!error && bounded && data===null){if(channelHealthy.current)setConnection("connected");return roomRef.current;}
              const live=data as unknown as LiveProjection | null;
              if (!error && live && (live.revision ?? 0) < revisionRef.current) return roomRef.current;
              if(!error && live && applyLive(live)) return live.room;
            } catch { if(!current())return null; /* Fall back to the full bounded projection. */ }
          }
          const { data, error } = await supabase.rpc("room_projection", { p_room: roomId }).abortSignal(AbortSignal.timeout(5000));
          const projection = data as unknown as { room: Room; pool: RoomPlayer[]; revision?: number; capabilities?: RepairCapabilities } | null;
          if (!current()) return null;
          if (projection && (projection.revision ?? 0) < revisionRef.current) return roomRef.current;
          if (error) { if (!roomRef.current || error.code === 'P0001') setError(error.message); else setConnection('reconnecting'); }
          else if (!projection) setError("Room not found or you are not a member.");
          else {
            if(channelHealthy.current)setConnection("connected");
            revisionRef.current = projection.revision ?? revisionRef.current;
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
    [roomId, applyLive],
  );

  const coordinator = useRef<ReturnType<typeof createRefetchCoordinator<Table>> | null>(null);
  const reload = useCallback((t: Table) => coordinator.current?.refresh(t) ?? Promise.resolve(null), []);
  useEffect(() => {
    generation.current++;
    projectionRef.current = "";
    revisionRef.current = 0;
    readVersions.current = {participants:0,bids:0,squads:0,sales:0};
    capabilitiesRef.current={};setCapabilities({});poolRef.current=[];roomRef.current=null;setRoom(null);setLoaded(false);
    const queue = createRefetchCoordinator(load,240);
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
    const tables: Table[] = ["participants", "squads", "trades", "sales"];
    let ch = supabase.channel(`room-${roomId}-${Math.random().toString(36).slice(2)}`);
    for (const t of tables) {
      ch = ch.on(
        "postgres_changes",
        { event: "*", schema: "public", table: t, filter: `room_id=eq.${roomId}` },
        () => {
          if (t === 'bids' && capabilitiesRef.current.action_sync === 1) return; // The room revision carries the accepted bid.
          else queue(t);
        },
      );
    }
    ch=ch.on("postgres_changes",{event:"*",schema:"public",table:"room_updates",filter:`room_id=eq.${roomId}`},(payload)=>{const revision=(payload.new as {revision?:number}).revision;if(revision==null||revision>revisionRef.current){queue("rooms");if(capabilitiesRef.current.action_sync!==1)queue("bids");}});
    ch.subscribe((status) => {
      channelHealthy.current=status === "SUBSCRIBED";
      setConnection(channelHealthy.current ? "connected" : "reconnecting");
      // on (re)connect, resync everything so reconnects restore state
      if (status === "SUBSCRIBED") { tables.forEach(queue);queue("rooms"); }
    });
    return () => {
      channelHealthy.current=false;
      void supabase.removeChannel(ch);
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
      const deadline = r.status==='review'?r.review_ends_at:r.status==='auction'?r.lot_ends_at:r.status==='trade'?r.trade_ends_at:r.community_mode&&r.post_phase==='lineup'?r.phase_ends_at:null;
      const active=participantsRef.current.filter(p=>now-new Date(p.last_seen).getTime()<30000).sort((a,b)=>Number(b.user_id===r.host_id)-Number(a.user_id===r.host_id)||a.id.localeCompare(b.id));
      const rank=Math.max(0,active.findIndex(p=>p.user_id===userId));
      const due=deadline && now>=new Date(deadline).getTime()+(rank?800+rank*250:0);
      if (!due) return;
      inflight = true;
      nextAttempt = Date.now() + 2000;
      try { await supabase.rpc("tick", { p_room: roomId }).abortSignal(AbortSignal.timeout(5000)); coordinator.current?.schedule("rooms"); }
      catch { /* Bounded retry after a transport failure. */ }
      finally { inflight = false; }
    }, 700);
    const recovery=setInterval(()=>{
      coordinator.current?.schedule('rooms');
      coordinator.current?.schedule('room_events');
      if(!channelHealthy.current)(['participants','squads','sales'] as Table[]).forEach(t=>coordinator.current?.schedule(t));
    },5000);
    const onFocus = () => (["rooms", "participants", "squads", "sales", "trades", "bids"] as Table[]).forEach(t => coordinator.current?.schedule(t));
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(hb);
      clearInterval(tk);
      clearInterval(recovery);
      window.removeEventListener("focus", onFocus);
    };
  }, [loaded, roomId, offset, load, userId]);

  return useMemo(() => ({ room, participants, pool, bids, squads, sales, trades, events, notes, saveNotes, error, loaded, offset, connection, capabilities, reload, applyLive }),
    [room, participants, pool, bids, squads, sales, trades, events, notes, saveNotes, error, loaded, offset, connection, capabilities, reload, applyLive]);
}

export function useNow(offset: number, ms = 100) {
  const [now, setNow] = useState(() => Date.now() + offset);
  useEffect(() => {
    const i = setInterval(() => setNow(Date.now() + offset), ms);
    return () => clearInterval(i);
  }, [offset, ms]);
  return now;
}
