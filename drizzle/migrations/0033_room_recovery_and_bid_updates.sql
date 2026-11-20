-- Track pool changes separately so clients can skip unchanged pool rows on a bid.
ALTER TABLE public.room_updates ADD COLUMN pool_revision bigint NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public._notify_room_update() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE rid uuid; pool_change int := 0;
BEGIN
 IF TG_TABLE_NAME='rooms' THEN
   rid:=NEW.id;
   IF TG_OP='UPDATE' THEN
     IF (OLD.settings->'surprise_reveal') IS DISTINCT FROM (NEW.settings->'surprise_reveal') THEN pool_change:=1; END IF;
   END IF;
 ELSE
   IF TG_OP='DELETE' THEN rid:=OLD.room_id; ELSE rid:=NEW.room_id; END IF;
   IF TG_TABLE_NAME='room_players' THEN pool_change:=1; END IF;
 END IF;
 IF EXISTS(SELECT FROM public.rooms WHERE id=rid) THEN
   INSERT INTO public.room_updates(room_id,revision,pool_revision) VALUES(rid,1,pool_change)
   ON CONFLICT(room_id) DO UPDATE SET revision=room_updates.revision+1,
     pool_revision=room_updates.pool_revision+excluded.pool_revision;
 END IF;
 RETURN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.room_projection(p_room uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT public._room_projection_full(p_room)||jsonb_build_object(
   'revision',u.revision,'pool_revision',u.pool_revision,
   'capabilities',jsonb_build_object('auction_controls',1,'action_sync',1,'bounded_poll',1,'community',1,
                                     'stage_reopen',1,'compact_sync',1,'seat_recovery',1))
 FROM (SELECT 1) anchor LEFT JOIN public.room_updates u ON u.room_id=p_room
$$;

CREATE FUNCTION public.room_poll_changes(p_room uuid,p_revision bigint,p_pool_revision bigint) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE u public.room_updates; r public.rooms;
BEGIN
 PERFORM public._me(p_room);
 SELECT * INTO u FROM public.room_updates WHERE room_id=p_room;
 IF NOT FOUND THEN RETURN public.room_sync(p_room); END IF;
 IF u.revision=p_revision AND u.pool_revision=p_pool_revision THEN RETURN NULL; END IF;
 IF u.pool_revision IS DISTINCT FROM p_pool_revision THEN
   RETURN public.room_sync(p_room)||jsonb_build_object('pool_revision',u.pool_revision);
 END IF;
 SELECT * INTO STRICT r FROM public.rooms WHERE id=p_room;
 RETURN jsonb_build_object(
   'room',(to_jsonb(r)-'first_round_order'-'accelerated_order')||jsonb_build_object(
      'evaluation_snapshot',(SELECT snapshot_id FROM public.room_evaluation_inputs WHERE room_id=p_room)),
   'pool_revision',u.pool_revision,'revision',u.revision,'states',NULL,
   'bids',(SELECT coalesce(jsonb_agg(to_jsonb(b) ORDER BY b.accepted_order DESC NULLS LAST,b.created_at DESC,b.id DESC),'[]'::jsonb)
           FROM (SELECT * FROM public.bids WHERE room_id=p_room AND room_player_id=r.current_rp AND NOT undone
                 AND (NOT r.repair_flow OR lot_session=r.bid_session)
                 ORDER BY accepted_order DESC NULLS LAST,created_at DESC,id DESC LIMIT 30) b));
END $$;

CREATE FUNCTION public.place_bid_with_changes(p_room uuid,p_amount numeric,p_lot uuid,p_version bigint,p_request uuid,p_pool_revision bigint)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE accepted numeric;
BEGIN
 accepted:=public.place_bid(p_room,p_amount,p_lot,p_version,p_request);
 RETURN jsonb_build_object('amount',accepted,'live',public.room_poll_changes(p_room,-1,p_pool_revision));
END $$;

-- A recovery code belongs to one guest seat. Only its digest is stored.
CREATE TABLE public.guest_seat_codes (
 participant_id uuid PRIMARY KEY REFERENCES public.participants(id) ON DELETE CASCADE,
 digest bytea NOT NULL UNIQUE
);
ALTER TABLE public.guest_seat_codes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.guest_seat_codes FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.issue_seat_code(p_room uuid) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE me public.participants; token uuid:=gen_random_uuid();
BEGIN
 PERFORM 1 FROM public.rooms WHERE id=p_room FOR UPDATE;
 me:=public._me(p_room);
 IF NOT EXISTS(SELECT FROM auth.users WHERE id=me.user_id AND is_anonymous) THEN
   RAISE EXCEPTION 'Use your email to return to this seat'; END IF;
 INSERT INTO public.guest_seat_codes VALUES(me.id,sha256(uuid_send(token)))
 ON CONFLICT(participant_id) DO UPDATE SET digest=excluded.digest;
 RETURN token;
END $$;

CREATE FUNCTION public.reclaim_guest_seat(p_code text,p_token uuid) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.rooms; seat public.participants; uid uuid:=auth.uid();
BEGIN
 IF uid IS NULL OR NOT public._release_limit('reclaim seat',12,60) THEN RETURN NULL; END IF;
 SELECT * INTO r FROM public.rooms WHERE code=upper(trim(p_code)) FOR UPDATE;
 IF NOT FOUND THEN RETURN NULL; END IF;
 IF EXISTS(SELECT FROM public.participants WHERE room_id=r.id AND user_id=uid) THEN RETURN r.id; END IF;
 SELECT p.* INTO seat FROM public.participants p JOIN public.guest_seat_codes c ON c.participant_id=p.id
 JOIN auth.users a ON a.id=p.user_id AND a.is_anonymous
 WHERE p.room_id=r.id AND c.digest=sha256(uuid_send(p_token)) FOR UPDATE OF p,a;
 IF NOT FOUND THEN RETURN NULL; END IF;
 DELETE FROM public.guest_seat_codes WHERE participant_id=seat.id;
 UPDATE public.participants SET user_id=uid,last_seen=clock_timestamp() WHERE id=seat.id;
 IF r.host_id=seat.user_id THEN UPDATE public.rooms SET host_id=uid WHERE id=r.id; END IF;
 IF EXISTS(SELECT FROM public.private_notes WHERE room_id=r.id AND user_id=seat.user_id) THEN
   DELETE FROM public.private_notes WHERE room_id=r.id AND user_id=uid;
   UPDATE public.private_notes SET user_id=uid WHERE room_id=r.id AND user_id=seat.user_id;
 END IF;
 RETURN r.id;
END $$;

CREATE OR REPLACE FUNCTION public.transfer_host(p_room uuid,p_participant uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.rooms; me public.participants; target public.participants; host_seen timestamptz;
BEGIN
 SELECT * INTO STRICT r FROM public.rooms WHERE id=p_room FOR UPDATE;
 me:=public._me(p_room);
 SELECT * INTO target FROM public.participants WHERE id=p_participant AND room_id=p_room;
 IF NOT FOUND THEN RAISE EXCEPTION 'Unknown team'; END IF;
 IF r.host_id<>me.user_id THEN
   IF target.id<>me.id THEN RAISE EXCEPTION 'You can only claim host for yourself'; END IF;
   SELECT last_seen INTO host_seen FROM public.participants WHERE room_id=p_room AND user_id=r.host_id FOR UPDATE;
   IF host_seen>clock_timestamp()-interval '2 minutes' THEN RAISE EXCEPTION 'The host is still connected'; END IF;
 END IF;
 UPDATE public.rooms SET host_id=target.user_id WHERE id=p_room;
 PERFORM public._log(p_room,'info',target.team_name||' is now the host');
END $$;

REVOKE ALL ON FUNCTION public.room_poll_changes(uuid,bigint,bigint),public.place_bid_with_changes(uuid,numeric,uuid,bigint,uuid,bigint),
 public.issue_seat_code(uuid),public.reclaim_guest_seat(text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.room_poll_changes(uuid,bigint,bigint),public.place_bid_with_changes(uuid,numeric,uuid,bigint,uuid,bigint),
 public.issue_seat_code(uuid),public.reclaim_guest_seat(text,uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.room_entry(p_code text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.rooms; me public.participants;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
 IF NOT public._release_limit('room_entry',40,60) THEN RETURN NULL; END IF;
 IF coalesce(trim(p_code),'') !~ '^[A-Za-z2-9]{6}$' THEN RETURN NULL; END IF;
 SELECT * INTO r FROM public.rooms WHERE code=upper(trim(p_code)); IF NOT FOUND THEN RETURN NULL; END IF;
 SELECT * INTO me FROM public.participants WHERE room_id=r.id AND user_id=auth.uid();
 RETURN jsonb_build_object('seat_recovery',true,'name',r.name,'format',r.format,'status',r.status,'ipl_franchises',r.ipl_franchises,'is_member',me.id IS NOT NULL,'my_team',me.ipl_team,
  'taken',(SELECT coalesce(jsonb_agg(ipl_team),'[]') FROM public.participants WHERE room_id=r.id AND ipl_team IS NOT NULL),
  'full',(SELECT count(*) FROM public.participants WHERE room_id=r.id)>=(r.settings->>'max_teams')::int);
END $$;
