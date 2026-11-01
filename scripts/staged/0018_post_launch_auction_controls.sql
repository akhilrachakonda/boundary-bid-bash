-- STAGED ONLY. Do not apply to the shared live database during development.
ALTER TABLE public.rooms ADD COLUMN repair_flow boolean NOT NULL DEFAULT false;
ALTER TABLE public.rooms ADD COLUMN auction_stage text NOT NULL DEFAULT 'round';
ALTER TABLE public.rooms ADD COLUMN auction_round integer NOT NULL DEFAULT 1;
ALTER TABLE public.rooms ADD COLUMN control_revision bigint NOT NULL DEFAULT 0;
ALTER TABLE public.rooms ADD COLUMN next_lot_settings jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.rooms ADD COLUMN bid_session bigint NOT NULL DEFAULT 0;
ALTER TABLE public.bids ADD COLUMN undone boolean NOT NULL DEFAULT false;
ALTER TABLE public.bids ADD COLUMN lot_session bigint NOT NULL DEFAULT 0;

CREATE TABLE public.auction_nominations (
 room_id uuid NOT NULL REFERENCES public.rooms(id),
 room_player_id uuid NOT NULL REFERENCES public.room_players(id),
 participant_id uuid NOT NULL REFERENCES public.participants(id),
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(room_id,room_player_id,participant_id)
);
GRANT SELECT ON public.auction_nominations TO authenticated;
GRANT ALL ON public.auction_nominations TO service_role;
ALTER TABLE public.auction_nominations ENABLE ROW LEVEL SECURITY;
CREATE POLICY members_read_nominations ON public.auction_nominations FOR SELECT TO authenticated USING(public.is_room_member(room_id));

CREATE TABLE public.auction_commands (
 room_id uuid NOT NULL REFERENCES public.rooms(id), request_id uuid NOT NULL,
 user_id uuid NOT NULL, args jsonb NOT NULL, result jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(room_id,request_id)
);
GRANT ALL ON public.auction_commands TO service_role;
ALTER TABLE public.auction_commands ENABLE ROW LEVEL SECURITY;

-- Preserve the historical implementation without exposing a new public RPC.
DO $$ DECLARE d text; BEGIN
 d:=pg_get_functiondef('public._advance_lot(uuid)'::regprocedure);
 EXECUTE replace(d,'public._advance_lot(', 'public._advance_lot_pre_repair(');
 d:=pg_get_functiondef('public.room_projection(uuid)'::regprocedure);
 EXECUTE replace(d,'public.room_projection(', 'public._room_projection_full(');
END $$;

CREATE FUNCTION public._repair_new_room() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN NEW.repair_flow:=true; RETURN NEW; END $$;
CREATE TRIGGER repair_new_room BEFORE INSERT ON public.rooms FOR EACH ROW EXECUTE FUNCTION public._repair_new_room();

CREATE FUNCTION public._repair_live_lot() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NEW.status='live' AND OLD.status IS DISTINCT FROM 'live' THEN
  UPDATE public.rooms SET bid_session=lot_version WHERE id=NEW.room_id;
 END IF; RETURN NEW;
END $$;
-- Alphabetical trigger ordering: release_lot_version runs before zz_repair_session.
CREATE TRIGGER zz_repair_session AFTER UPDATE OF status ON public.room_players FOR EACH ROW EXECUTE FUNCTION public._repair_live_lot();
CREATE FUNCTION public._repair_bid_session() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN SELECT bid_session INTO NEW.lot_session FROM public.rooms WHERE id=NEW.room_id; RETURN NEW; END $$;
CREATE TRIGGER repair_bid_session BEFORE INSERT ON public.bids FOR EACH ROW EXECUTE FUNCTION public._repair_bid_session();

CREATE OR REPLACE FUNCTION public._advance_lot(p_room uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.rooms; nxt uuid;
BEGIN
 SELECT * INTO r FROM public.rooms WHERE id=p_room FOR UPDATE;
 IF NOT r.repair_flow THEN PERFORM public._advance_lot_pre_repair(p_room); RETURN; END IF;
 IF r.auction_stage='round' THEN
  SELECT id INTO nxt FROM public.room_players WHERE room_id=p_room AND status='pending' ORDER BY round,lot_order,id LIMIT 1;
 END IF;
 IF nxt IS NULL THEN
  UPDATE public.rooms SET status='completed',auction_stage='final_call',current_rp=null,current_bid=null,current_bidder=null,lot_ends_at=null,paused_remaining_ms=null,control_revision=control_revision+1 WHERE id=p_room;
  PERFORM public._log(p_room,'info','FINAL CALL: nominate unsold players, rerun a round, or close to trades'); RETURN;
 END IF;
 IF r.next_lot_settings<>'{}'::jsonb THEN
  UPDATE public.rooms SET settings=settings||next_lot_settings,next_lot_settings='{}' WHERE id=p_room;
  r.settings:=r.settings||r.next_lot_settings;
 END IF;
 UPDATE public.room_players SET status='live' WHERE id=nxt;
 UPDATE public.rooms SET status='auction',current_rp=nxt,current_bid=null,current_bidder=null,
  lot_ends_at=clock_timestamp()+make_interval(secs=>(r.settings->>'bid_timer')::int),paused_remaining_ms=null WHERE id=p_room;
END $$;

CREATE FUNCTION public._repair_eligible(p_room uuid,p_lot uuid,p_part uuid) RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.rooms; p public.players; t public.participants; c jsonb;
BEGIN
 SELECT * INTO r FROM public.rooms WHERE id=p_room;
 SELECT pl.* INTO p FROM public.room_players rp JOIN public.players pl ON pl.id=rp.player_id WHERE rp.id=p_lot AND rp.room_id=p_room AND rp.status='unsold' AND NOT EXISTS(SELECT 1 FROM public.squads s WHERE s.room_id=p_room AND s.player_id=rp.player_id);
 IF NOT FOUND THEN RETURN false; END IF;
 SELECT * INTO t FROM public.participants WHERE id=p_part AND room_id=p_room;
 IF NOT FOUND THEN RETURN false; END IF;
 c:=public._squad_counts(p_part);
 RETURN (c->>'total')::int<(r.settings->>'max_squad')::int AND
  (p.nationality_type<>'Overseas' OR (c->>'overseas')::int<(r.settings->>'max_overseas')::int) AND
  p.base_price<=public._max_bid(r.settings,t.purse,c,p.role);
END $$;

CREATE FUNCTION public.nominate_unsold(p_room uuid,p_lot uuid,p_version bigint,p_revision bigint) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.rooms; me public.participants;
BEGIN
 me:=public._me(p_room); SELECT * INTO r FROM public.rooms WHERE id=p_room FOR UPDATE;
 IF NOT r.repair_flow OR r.status<>'completed' OR r.auction_stage<>'final_call' OR r.lot_version IS DISTINCT FROM p_version OR r.control_revision IS DISTINCT FROM p_revision THEN RAISE EXCEPTION 'Final call changed; refresh'; END IF;
 IF NOT public._release_limit('nominate',60,60) THEN RAISE EXCEPTION 'Nomination limit reached'; END IF;
 IF NOT public._repair_eligible(p_room,p_lot,me.id) THEN RAISE EXCEPTION 'Player unavailable or not affordable for your roster'; END IF;
 INSERT INTO public.auction_nominations(room_id,room_player_id,participant_id) VALUES(p_room,p_lot,me.id) ON CONFLICT DO NOTHING;
 -- Contending nominations share a revision; close commands include an exact summary.
 UPDATE public.room_updates SET revision=revision+1 WHERE room_id=p_room;
END $$;

CREATE FUNCTION public.auction_command(p_room uuid,p_action text,p_lot uuid,p_version bigint,p_status text,p_revision bigint,p_request uuid,p_payload jsonb DEFAULT '{}'::jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.rooms; saved public.auction_commands; a jsonb; b public.bids; prev public.bids;
 ids uuid[]; sl public.sales; n integer; summary uuid[]; result jsonb; timers jsonb;
BEGIN
 PERFORM public._me(p_room); SELECT * INTO r FROM public.rooms WHERE id=p_room FOR UPDATE;
 IF auth.uid() IS NULL OR r.host_id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Only the host can do that'; END IF;
 IF p_request IS NULL OR octet_length(p_payload::text)>8192 THEN RAISE EXCEPTION 'Invalid command'; END IF;
 a:=jsonb_build_object('action',p_action,'lot',p_lot,'version',p_version,'status',p_status,'revision',p_revision,'payload',p_payload);
 SELECT * INTO saved FROM public.auction_commands WHERE room_id=p_room AND request_id=p_request;
 IF FOUND THEN IF saved.user_id IS DISTINCT FROM auth.uid() OR saved.args IS DISTINCT FROM a THEN RAISE EXCEPTION 'Request ID already used'; END IF; RETURN saved.result; END IF;
 IF NOT r.repair_flow OR r.lot_version IS DISTINCT FROM p_version OR r.status IS DISTINCT FROM p_status OR r.current_rp IS DISTINCT FROM p_lot OR r.control_revision IS DISTINCT FROM p_revision THEN RAISE EXCEPTION 'Auction changed; refresh before acting'; END IF;
 IF NOT public._release_limit('host_command',120,60) THEN RAISE EXCEPTION 'Host command limit reached'; END IF;
 IF p_action='settings' THEN
  IF r.status NOT IN ('auction','paused','completed') OR r.auction_stage='closed' THEN RAISE EXCEPTION 'Settings locked'; END IF;
  IF jsonb_typeof(p_payload) IS DISTINCT FROM 'object' OR p_payload-'bid_timer'-'bid_reset'<>'{}'::jsonb OR p_payload->>'bid_timer' IS NULL OR p_payload->>'bid_reset' IS NULL OR p_payload->>'bid_timer' !~ '^[0-9]{1,3}$' OR p_payload->>'bid_reset' !~ '^[0-9]{1,3}$' THEN RAISE EXCEPTION 'Only next-lot timers may change'; END IF;
  IF (p_payload->>'bid_timer')::int NOT BETWEEN 1 AND 120 OR (p_payload->>'bid_reset')::int NOT BETWEEN 1 AND 120 THEN RAISE EXCEPTION 'Timers must be 1–120 seconds'; END IF;
  UPDATE public.rooms SET next_lot_settings=p_payload WHERE id=p_room;
  PERFORM public._log(p_room,'settings','Saved next-lot timer '||(p_payload->>'bid_timer')||'s; extension '||(p_payload->>'bid_reset')||'s; active deadline unchanged');
 ELSIF p_action='undo_bid' THEN
  IF r.status NOT IN ('auction','paused') OR r.current_rp IS NULL OR (r.status='auction' AND clock_timestamp()>=r.lot_ends_at) THEN RAISE EXCEPTION 'Only an unresolved open lot can undo a bid'; END IF;
  SELECT * INTO b FROM public.bids WHERE room_id=p_room AND room_player_id=r.current_rp AND lot_session=r.bid_session AND NOT undone ORDER BY created_at DESC,id DESC LIMIT 1;
  IF NOT FOUND OR b.id IS DISTINCT FROM (p_payload->>'bid_id')::uuid THEN RAISE EXCEPTION 'Latest bid changed'; END IF;
  SELECT * INTO prev FROM public.bids WHERE room_id=p_room AND room_player_id=r.current_rp AND lot_session=r.bid_session AND NOT undone AND id<>b.id ORDER BY created_at DESC,id DESC LIMIT 1;
  UPDATE public.bids SET undone=true WHERE id=b.id;
  UPDATE public.rooms SET current_bid=prev.amount,current_bidder=prev.participant_id,lot_version=lot_version+1,
   lot_ends_at=CASE WHEN r.status='auction' THEN greatest(r.lot_ends_at,clock_timestamp()+make_interval(secs=>(r.settings->>'bid_reset')::int)) ELSE r.lot_ends_at END,
   paused_remaining_ms=CASE WHEN r.status='paused' THEN greatest(coalesce(r.paused_remaining_ms,0),(r.settings->>'bid_reset')::int*1000) ELSE r.paused_remaining_ms END WHERE id=p_room;
  PERFORM public._log(p_room,'bid_undo','Bid '||b.id||' withdrawn; prior leader restored; at least one extension window remains');
 ELSIF p_action IN ('pause','resume','skip') THEN
  IF p_action='pause' AND (r.status<>'auction' OR clock_timestamp()>=r.lot_ends_at) THEN RAISE EXCEPTION 'Lot already closed'; END IF;
  PERFORM public.host_control(p_room,p_action);
 ELSIF p_action='final_call' THEN
  IF r.status NOT IN ('auction','paused') THEN RAISE EXCEPTION 'No active auction'; END IF;
  -- Resolve the active bid normally, never discard a fair winning bid on close.
  PERFORM public._resolve_lot(p_room,false);
  UPDATE public.room_players SET status='unsold' WHERE room_id=p_room AND status='pending';
  UPDATE public.rooms SET auction_stage='final_call' WHERE id=p_room;
  PERFORM public._advance_lot(p_room);
 ELSIF p_action='rerun' THEN
  IF r.status<>'completed' OR r.auction_stage<>'final_call' THEN RAISE EXCEPTION 'Finish the current lot first'; END IF;
  SELECT array_agg(rp.player_id ORDER BY rp.id) INTO ids FROM public.room_players rp WHERE rp.room_id=p_room AND rp.status='unsold' AND EXISTS(SELECT 1 FROM public.participants t WHERE t.room_id=p_room AND public._repair_eligible(p_room,rp.id,t.id));
  IF coalesce(cardinality(ids),0)=0 THEN RAISE EXCEPTION 'No eligible unsold players; final call remains open'; END IF;
  ids:=public._shuffle_player_ids(ids);
  UPDATE public.rooms SET auction_round=auction_round+1,auction_stage='round',status='auction' WHERE id=p_room;
  UPDATE public.room_players rp SET status='pending',round=r.auction_round+1,lot_order=x.ordinality::int FROM unnest(ids) WITH ORDINALITY x(player_id,ordinality) WHERE rp.room_id=p_room AND rp.player_id=x.player_id AND rp.status='unsold';
  DELETE FROM public.auction_nominations WHERE room_id=p_room;
  PERFORM public._log(p_room,'info','Host started shuffled unsold round '||(r.auction_round+1));
  PERFORM public._advance_lot(p_room);
 ELSIF p_action='open_nomination' THEN
  IF r.status<>'completed' OR r.auction_stage<>'final_call' THEN RAISE EXCEPTION 'Final call is not open'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.auction_nominations n WHERE n.room_id=p_room AND n.room_player_id=(p_payload->>'nomination')::uuid) OR NOT EXISTS(SELECT 1 FROM public.participants t WHERE t.room_id=p_room AND public._repair_eligible(p_room,(p_payload->>'nomination')::uuid,t.id)) THEN RAISE EXCEPTION 'Nomination no longer eligible'; END IF;
  IF r.next_lot_settings<>'{}'::jsonb THEN UPDATE public.rooms SET settings=settings||next_lot_settings,next_lot_settings='{}' WHERE id=p_room; r.settings:=r.settings||r.next_lot_settings; END IF;
  UPDATE public.room_players SET status='live' WHERE id=(p_payload->>'nomination')::uuid AND room_id=p_room AND status='unsold';
  UPDATE public.rooms SET status='auction',current_rp=(p_payload->>'nomination')::uuid,current_bid=null,current_bidder=null,lot_ends_at=clock_timestamp()+make_interval(secs=>(r.settings->>'bid_timer')::int) WHERE id=p_room;
  DELETE FROM public.auction_nominations WHERE room_id=p_room AND room_player_id=(p_payload->>'nomination')::uuid;
 ELSIF p_action='undo_sale' THEN
  IF r.status NOT IN ('auction','paused','completed') OR r.auction_stage='closed' THEN RAISE EXCEPTION 'Purchases locked'; END IF;
  SELECT * INTO sl FROM public.sales WHERE room_id=p_room AND participant_id IS NOT NULL AND NOT undone ORDER BY created_at DESC,id DESC LIMIT 1;
  IF NOT FOUND OR sl.id IS DISTINCT FROM (p_payload->>'sale_id')::uuid THEN RAISE EXCEPTION 'Sale changed'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.squads WHERE room_player_id=sl.room_player_id AND participant_id=sl.participant_id) THEN RAISE EXCEPTION 'Player has moved'; END IF;
  DELETE FROM public.squads WHERE room_player_id=sl.room_player_id;
  UPDATE public.participants SET purse=purse+sl.price WHERE id=sl.participant_id;
  UPDATE public.sales SET undone=true WHERE id=sl.id;
  UPDATE public.room_players SET status=CASE WHEN r.auction_stage='round' AND r.status<>'completed' THEN 'pending' ELSE 'unsold' END,sold_to=null,sold_price=null WHERE id=sl.room_player_id;
  PERFORM public._log(p_room,'sale_undo','Sale '||sl.id||' undone; buyer refunded');
 ELSIF p_action='close_trades' THEN
  IF r.status<>'completed' OR r.auction_stage<>'final_call' THEN RAISE EXCEPTION 'Resolve the current lot first'; END IF;
  SELECT coalesce(array_agg(DISTINCT room_player_id ORDER BY room_player_id),'{}') INTO summary FROM public.auction_nominations WHERE room_id=p_room;
  SELECT coalesce(array_agg(v::uuid ORDER BY v::uuid),'{}') INTO ids FROM jsonb_array_elements_text(coalesce(p_payload->'pending','[]')) v;
  IF ids IS DISTINCT FROM summary THEN RAISE EXCEPTION 'Nominations changed; review pending summary again'; END IF;
  IF p_payload->>'minutes' IS NULL OR p_payload->>'minutes' !~ '^[0-9]{1,3}$' OR (p_payload->>'minutes')::int NOT BETWEEN 1 AND 120 THEN RAISE EXCEPTION 'Invalid trade duration'; END IF;
  UPDATE public.rooms SET auction_stage='closed',status='trade',trade_ends_at=clock_timestamp()+make_interval(mins=>(p_payload->>'minutes')::int) WHERE id=p_room;
  DELETE FROM public.auction_nominations WHERE room_id=p_room;
  PERFORM public._log(p_room,'info','Auction purchases closed; trades open; '||cardinality(summary)||' pending nominations dismissed');
 ELSE RAISE EXCEPTION 'Unknown command'; END IF;
 UPDATE public.rooms SET control_revision=control_revision+1 WHERE id=p_room;
 result:=jsonb_build_object('accepted',true,'request_id',p_request);
 INSERT INTO public.auction_commands(room_id,request_id,user_id,args,result) VALUES(p_room,p_request,auth.uid(),a,result);
 RETURN result;
END $$;

CREATE OR REPLACE FUNCTION public.room_projection(p_room uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN RETURN public._room_projection_full(p_room)||jsonb_build_object('capabilities',jsonb_build_object('auction_controls',1)); END $$;
CREATE FUNCTION public.room_live_projection(p_room uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.rooms; states jsonb; inputs public.room_evaluation_inputs;
BEGIN
 PERFORM public._me(p_room); SELECT * INTO r FROM public.rooms WHERE id=p_room;
 SELECT snapshot_id INTO inputs.snapshot_id FROM public.room_evaluation_inputs WHERE room_id=p_room;
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'status',status,'round',round,'lot_order',CASE WHEN coalesce((r.settings->>'surprise_reveal')::boolean,false) THEN 0 ELSE lot_order END,'sold_to',sold_to,'sold_price',sold_price) ORDER BY player_id),'[]') INTO states FROM public.room_players WHERE room_id=p_room;
 RETURN jsonb_build_object('room',(to_jsonb(r)-'first_round_order'-'accelerated_order')||jsonb_build_object('evaluation_snapshot',inputs.snapshot_id),'states',states);
END $$;

-- Prevent legacy entry points from bypassing repair stage or observed guards.
DO $$ DECLARE d text; BEGIN
 d:=pg_get_functiondef('public.host_control(uuid,text,bigint,text,uuid)'::regprocedure);
 d:=replace(d,'PERFORM public.host_control(p_room,p_action);','IF r.repair_flow AND r.status NOT IN (''lobby'',''review'',''trade'',''results'') THEN RAISE EXCEPTION ''Use guarded auction commands''; END IF; PERFORM public.host_control(p_room,p_action);'); EXECUTE d;
 d:=pg_get_functiondef('public.open_trades(uuid,integer)'::regprocedure);
 d:=replace(d,'if r.status <> ''completed''', 'if r.repair_flow then raise exception ''Confirm close with pending nomination summary''; end if; if r.status <> ''completed'''); EXECUTE d;
 d:=pg_get_functiondef('public.place_bid(uuid,numeric)'::regprocedure);
 d:=replace(d,'now()', 'clock_timestamp()'); EXECUTE d;
END $$;
REVOKE EXECUTE ON FUNCTION public._advance_lot_pre_repair(uuid),public._room_projection_full(uuid),public._repair_new_room(),public._repair_live_lot(),public._repair_bid_session(),public._repair_eligible(uuid,uuid,uuid) FROM PUBLIC,anon,authenticated;
REVOKE EXECUTE ON FUNCTION public.auction_command(uuid,text,uuid,bigint,text,bigint,uuid,jsonb),public.nominate_unsold(uuid,uuid,bigint,bigint),public.room_live_projection(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.auction_command(uuid,text,uuid,bigint,text,bigint,uuid,jsonb),public.nominate_unsold(uuid,uuid,bigint,bigint),public.room_live_projection(uuid) TO authenticated;
COMMENT ON COLUMN public.rooms.next_lot_settings IS 'Timer-only edits applied on the next activation; active and paused deadlines preserved';