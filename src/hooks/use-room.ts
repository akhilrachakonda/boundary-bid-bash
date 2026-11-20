import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Player, Settings } from "@/lib/auction-rules";
import { withCanonicalPhoto } from "@/lib/player-photos";
import { createRefetchCoordinator } from "@/lib/refetch-coordinator";
import { repairsEnabled, type RepairCapabilities } from "@/lib/post-launch-controls";
import { mergeLiveProjection, type LiveProjection } from '@/lib/live-projection';
import { membershipFailure, recoveryDelay, connectionDiagnostics, roomReadsAvailable, HEARTBEAT_MS, ONLINE_WINDOW_MS } from '@/lib/connection-recovery';

import { onlyPresenceChanged } from "@/lib/room-presence";

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
  ipl_franchises?: boolean;
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
  ipl_team?: string | null;
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
  const poolRevision = useRef<number | null>(null);
  const presence = useRef(new Map<string, number>());
  const lastSeen = useCallback((p: Participant) => Math.max(Date.parse(p.last_seen), presence.current.get(p.id) ?? 0), []);
  const readVersions = useRef({participants:0,bids:0,squads:0,sales:0});
  roomRef.current = room;

  const applyLive = useCallback((live: LiveProjection) => {
    if (!roomRef.current || live.room.id !== roomId) return false;
    const merged = mergeLiveProjection(roomRef.current, poolRef.current, live, revisionRef.current, poolRevision.current);
    if (!merged) return false;
    poolRevision.current = live.pool_revision ?? null;
    revisionRef.current = live.revision ?? revisionRef.current;
    if (merged !== poolRef.current && merged.some((player,index) => player !== poolRef.current[index])) {
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
      if (!userId || !roomReadsAvailable()) return null;
      const started = performance.now();
      connectionDiagnostics.reads++;
      const epoch = generation.current;
      const collection = t as keyof typeof readVersions.current;
      const readVersion = readVersions.current[collection];
      const current = () => epoch === generation.current && readVersions.current[collection] === readVersion;
      switch (t) {
        case "rooms": {
          if((capabilitiesRef.current.compact_sync === 1 || repairsEnabled(roomRef.current,capabilitiesRef.current)) && poolRef.current.length && roomRef.current?.status!=="lobby") {
            {
              const sync = capabilitiesRef.current.action_sync === 1;
              const bounded=capabilitiesRef.current.bounded_poll===1;
              const compact = capabilitiesRef.current.compact_sync === 1;
              const method = compact ? "room_poll_changes" : bounded ? "room_poll" : sync ? "room_sync" : "room_live_projection";
              const args = {p_room:roomId, ...(bounded ? {p_revision:revisionRef.current} : {}),
                ...(compact ? {p_pool_revision:poolRevision.current} : {})};
              const {data,error}=await supabase.rpc(method as never,args as never).abortSignal(AbortSignal.timeout(8000));
              if(!current())return null;
              if (error && !['PGRST202','42883'].includes(error.code) && !membershipFailure(error)) {
                setConnection('reconnecting');
                throw new Error('Room refresh unavailable');
              }
              if(!error && bounded && data===null){if(channelHealthy.current)setConnection("connected");return roomRef.current;}
              const live=data as unknown as LiveProjection | null;
              if (!error && live && (live.revision ?? 0) < revisionRef.current) return roomRef.current;
              if(!error && live && applyLive(live)) return live.room;
            }
          }
          const { data, error } = await supabase.rpc("room_projection", { p_room: roomId }).abortSignal(AbortSignal.timeout(15000));
          const projection = data as unknown as { room: Room; pool: RoomPlayer[]; pool_revision?: number; revision?: number; capabilities?: RepairCapabilities } | null;
          if (!current()) return null;
          if (projection && (projection.revision ?? 0) < revisionRef.current) return roomRef.current;
          if (error) {
            connectionDiagnostics.failures++; setConnection('reconnecting');
            if (membershipFailure(error)) { setError('This account is not a member of this room. Use your original device or sign-in.'); setLoaded(true); return null; }
            throw new Error('Room read unavailable');
          }
          else if (!projection) { setError("Room not found or you are not a member."); setLoaded(true); }
          else {
            connectionDiagnostics.lastReadMs = Math.round(performance.now() - started);
            connectionDiagnostics.recoveries++;
            setLoaded(true);
            if(channelHealthy.current)setConnection("connected");
            poolRevision.current = projection.pool_revision ?? null;
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
          const { data, error } = await supabase.from("participants").select("*").eq("room_id", roomId).order("joined_at").abortSignal(AbortSignal.timeout(5000));
          if(error) throw new Error('Participant read unavailable');
          if (current() && data) setParticipants(data as Participant[]);
          return;
        }
        case "sales": {
          const {data,error}=await supabase.from("sales").select("*").eq("room_id",roomId).order("created_at",{ascending:false}).order("id",{ascending:false}).abortSignal(AbortSignal.timeout(5000));
          if(error) throw new Error('Sale read unavailable');
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
          const { data, error } = await query
            .order("created_at", { ascending: false })
            .limit(30).abortSignal(AbortSignal.timeout(5000));
          if(error) throw new Error('Bid read unavailable');
          if (current() && data && rp === roomRef.current?.current_rp && session===roomRef.current?.bid_session) setBids((data as Bid[]).filter(b=>!b.undone));
          return;
        }
        case "squads": {
          const { data, error } = await supabase.from("squads").select("*").eq("room_id", roomId).abortSignal(AbortSignal.timeout(5000));
          if(error) throw new Error('Squad read unavailable');
          if (current() && data) setSquads(data as SquadRow[]);
          return;
        }
        case "trades": {
          const { data, error } = await supabase
            .from("trades")
            .select("*")
            .eq("room_id", roomId)
            .order("created_at", { ascending: false }).abortSignal(AbortSignal.timeout(5000));
          if(error) throw new Error('Trade read unavailable');
          if (current() && data) setTrades(data as Trade[]);
          return;
        }
        case "room_events": {
          const { data, error } = await supabase
            .from("room_events")
            .select("*")
            .eq("room_id", roomId)
            .order("id", { ascending: false })
            .limit(60).abortSignal(AbortSignal.timeout(5000));
          if(error) throw new Error('Event read unavailable');
          if (current() && data) setEvents(data as RoomEvent[]);
          return;
        }
      }
    },
    [roomId, userId, applyLive],
  );

  const coordinator = useRef<ReturnType<typeof createRefetchCoordinator<Table>> | null>(null);
  const reconnectSocket = useRef<(() => void) | null>(null);
  const refreshAfterResume = useCallback(() => {
    coordinator.current?.resume(["rooms", "participants", "squads", "sales", "trades", "bids", "room_events"]);
  }, []);
  const retryConnection = useCallback(() => {
    if (!roomReadsAvailable()) return;
    reconnectSocket.current?.();
    refreshAfterResume();
  }, [refreshAfterResume]);
  const reload = useCallback((t: Table) => coordinator.current?.refresh(t) ?? Promise.resolve(null), []);
  useEffect(() => {
    generation.current++;
    projectionRef.current = "";
    revisionRef.current = 0; poolRevision.current = null; presence.current.clear();
    readVersions.current = {participants:0,bids:0,squads:0,sales:0};
    capabilitiesRef.current={};setCapabilities({});poolRef.current=[];roomRef.current=null;setRoom(null);setLoaded(false);
    setError(null); setConnection(navigator.onLine ? 'connecting' : 'offline');
    setParticipants([]); setPool([]); setSquads([]); setTrades([]); setBids([]); setEvents([]); setSales([]);
    setNotes({targets:{},xi:{order:[],overs:{}},notes:''});
    const queue = createRefetchCoordinator(load,240,roomReadsAvailable);
    coordinator.current = queue;
    return () => { generation.current++; queue.dispose(); if (coordinator.current === queue) coordinator.current = null; };
  }, [load]);

  const loadNotes = useCallback(async () => {
    if (!userId) return;
    const epoch = generation.current;
    const { data } = await supabase
      .from("private_notes")
      .select("*")
      .eq("room_id", roomId)
      .eq("user_id", userId)
      .abortSignal(AbortSignal.timeout(5000)).maybeSingle();
    if (epoch === generation.current && data) setNotes({ targets: data.targets as Notes["targets"], xi: data.xi as Notes["xi"], notes: data.notes });
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
    if (!userId) return;
    let alive = true;
    const queue = coordinator.current;
    const initial: Table[] = ['rooms','participants','squads','sales','trades','room_events'];
    for (const table of initial) {
      void reload(table).catch(() => {
        if (alive) { setConnection(navigator.onLine ? 'reconnecting' : 'offline'); queue?.schedule(table); }
      });
    }
    void loadNotes().catch(() => {});
    const start = Date.now();
    void Promise.resolve(supabase.rpc('server_now').abortSignal(AbortSignal.timeout(5000)))
      .then(({ data }) => {
        if (alive && data) setOffset(new Date(data as string).getTime() - (start + Date.now()) / 2);
      }).catch(() => {});
    return () => { alive = false; };
  }, [load, reload, loadNotes, userId]);

  // reload bids when lot changes
  useEffect(() => {
    if (!userId) return;
    void reload("bids").catch(() => {});
  }, [room?.current_rp, room?.bid_session, reload]);

  // realtime
  useEffect(() => {
    if (!userId) return;
    let alive = true;
    const queue = (t: Table) => coordinator.current?.schedule(t);
    const tables: Table[] = ["participants", "squads", "trades", "sales"];
    let channel: ReturnType<typeof supabase.channel> | undefined;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let failures = 0;
    let connecting = false;
    function connect() {
      if (!alive || connecting || !roomReadsAvailable()) return;
      clearTimeout(retryTimer);
      connecting = true;
      const previous = channel;
      const next = supabase.channel(`room-${roomId}-${Math.random().toString(36).slice(2)}`);
      channel = next;
      if (previous) void supabase.removeChannel(previous);
      for (const table of tables) {
        next.on('postgres_changes', {event:'*',schema:'public',table,filter:`room_id=eq.${roomId}`},
          payload => {
            if (!alive || channel !== next || !roomReadsAvailable()) return;
            if (table === "participants" && payload.eventType === "UPDATE") {
              const row = payload.new as Record<string, unknown>;
              const member = participantsRef.current.find(p => p.id === row["id"]);
              if (member && onlyPresenceChanged(member, row)) {
                presence.current.set(member.id, Math.max(lastSeen(member), Date.parse(row["last_seen"] as string)));
                return;
              }
            }
            queue(table);
          });
      }
      next.on('postgres_changes', {event:'*',schema:'public',table:'room_updates',filter:`room_id=eq.${roomId}`}, payload => {
        if (!alive || channel !== next) return;
        const revision = (payload.new as {revision?:number}).revision;
        if (revision == null || revision > revisionRef.current) {
          queue('rooms');
          if (capabilitiesRef.current.action_sync !== 1) queue('bids');
        }
      });
      next.subscribe(status => {
        if (!alive || channel !== next) return;
        clearTimeout(retryTimer);
        connecting = false;
        channelHealthy.current = status === 'SUBSCRIBED';
        if (channelHealthy.current) {
          failures = 0;
          refreshAfterResume();
        } else {
          setConnection(navigator.onLine ? 'reconnecting' : 'offline');
          retryTimer = setTimeout(connect, recoveryDelay(++failures));
        }
      });
    }
    const resume = () => { if (!channelHealthy.current) connect(); };
    reconnectSocket.current = resume;
    connect();
    return () => {
      alive = false;
      channelHealthy.current = false;
      clearTimeout(retryTimer);
      reconnectSocket.current = null;
      if (channel) void supabase.removeChannel(channel);
    };
  }, [roomId, load, userId, refreshAfterResume, lastSeen]);

  // heartbeat + server tick driver
  useEffect(() => {
    if (!userId) return;
    let heartbeating = false;
    const heartbeat = async () => {
      if (heartbeating || !navigator.onLine || document.visibilityState === 'hidden' || !roomRef.current) return;
      heartbeating = true;
      try { await supabase.rpc('heartbeat', {p_room:roomId}).abortSignal(AbortSignal.timeout(5000)); }
      catch { /* Presence is advisory; never replace identity on failure. */ }
      finally { heartbeating = false; }
    };
    const hb = setInterval(() => { void heartbeat(); }, HEARTBEAT_MS);
    void heartbeat();
    let inflight = false;
    let nextAttempt = 0;
    const tk = setInterval(async () => {
      const r = roomRef.current;
      if (!r || inflight || Date.now() < nextAttempt || !navigator.onLine || document.visibilityState === 'hidden') return;
      const now = Date.now() + offset;
      const deadline = r.status==='review'?r.review_ends_at:r.status==='auction'?r.lot_ends_at:r.status==='trade'?r.trade_ends_at:r.community_mode&&r.post_phase==='lineup'?r.phase_ends_at:null;
      const active=participantsRef.current.filter(p=>now-lastSeen(p)<ONLINE_WINDOW_MS).sort((a,b)=>Number(b.user_id===r.host_id)-Number(a.user_id===r.host_id)||a.id.localeCompare(b.id));
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
      if (!navigator.onLine || document.visibilityState === 'hidden') return;
      coordinator.current?.schedule('rooms');
      coordinator.current?.schedule('room_events');
      if(!channelHealthy.current)(['participants','squads','sales','bids','trades'] as Table[]).forEach(t=>coordinator.current?.schedule(t));
    },5000);
    const onFocus = () => {
      if (!navigator.onLine || document.visibilityState === 'hidden') return;
      setConnection(previous => previous === "offline" ? "reconnecting" : previous);
      void heartbeat();
      retryConnection();
      void loadNotes().catch(() => {});
    };
    const onOffline = () => setConnection('offline');
    window.addEventListener("focus", onFocus);
    window.addEventListener('online',onFocus);
    window.addEventListener('offline',onOffline);
    window.addEventListener('pageshow',onFocus);
    document.addEventListener('visibilitychange',onFocus);
    return () => {
      clearInterval(hb);
      clearInterval(tk);
      clearInterval(recovery);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener('online',onFocus);
      window.removeEventListener('offline',onOffline);
      window.removeEventListener('pageshow',onFocus);
      document.removeEventListener('visibilitychange',onFocus);
    };
  }, [roomId, offset, load, userId, loadNotes, retryConnection, lastSeen]);

  return useMemo(() => ({ room, participants, pool, bids, squads, sales, trades, events, notes, saveNotes, error, loaded, offset, connection, capabilities, poolRevision, lastSeen, retryConnection, reload, applyLive }),
    [room, participants, pool, bids, squads, sales, trades, events, notes, saveNotes, error, loaded, offset, connection, capabilities, poolRevision, lastSeen, retryConnection, reload, applyLive]);
}

export function useNow(offset: number, ms = 100) {
  const [now, setNow] = useState(() => Date.now() + offset);
  useEffect(() => {
    const i = setInterval(() => setNow(Date.now() + offset), ms);
    return () => clearInterval(i);
  }, [offset, ms]);
  return now;
}
