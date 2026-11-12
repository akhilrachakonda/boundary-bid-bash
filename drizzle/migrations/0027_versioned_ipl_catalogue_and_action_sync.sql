-- Per-room catalogue snapshots and one-response reconciliation for auction controls.
CREATE TABLE public.player_catalogues (
 version text PRIMARY KEY, source_url text NOT NULL, source_commit text NOT NULL,
 imported_on date NOT NULL, content_hash text NOT NULL, player_count integer NOT NULL CHECK(player_count>0)
);
CREATE TABLE public.player_catalogue_entries (
 version text NOT NULL REFERENCES public.player_catalogues(version),
 player_id uuid NOT NULL REFERENCES public.players(id), source_id text NOT NULL, player_facts jsonb NOT NULL,
 PRIMARY KEY(version,player_id), UNIQUE(version,source_id)
);
ALTER TABLE public.player_catalogues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_catalogue_entries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.player_catalogues,public.player_catalogue_entries FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.player_catalogues,public.player_catalogue_entries TO authenticated;
GRANT ALL ON public.player_catalogues,public.player_catalogue_entries TO service_role;
CREATE POLICY catalogue_read ON public.player_catalogues FOR SELECT TO authenticated USING(true);
CREATE POLICY catalogue_entries_read ON public.player_catalogue_entries FOR SELECT TO authenticated USING(true);
CREATE TRIGGER immutable_catalogue BEFORE UPDATE OR DELETE ON public.player_catalogues FOR EACH ROW EXECUTE FUNCTION public._immutable_snapshot();
CREATE TRIGGER immutable_catalogue_entry BEFORE UPDATE OR DELETE ON public.player_catalogue_entries FOR EACH ROW EXECUTE FUNCTION public._immutable_snapshot();
ALTER TABLE public.rooms ADD COLUMN catalogue_version text REFERENCES public.player_catalogues(version);

CREATE FUNCTION public._catalogue_player_json(p_room uuid,p_player uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT coalesce(e.player_facts,to_jsonb(p)) FROM public.players p
 LEFT JOIN public.rooms r ON r.id=p_room
 LEFT JOIN public.player_catalogue_entries e ON e.version=r.catalogue_version AND e.player_id=p.id
 WHERE p.id=p_player
$$;
REVOKE ALL ON FUNCTION public._catalogue_player_json(uuid,uuid) FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.create_catalogue_room(p_name text,p_format text,p_settings jsonb,p_nickname text,p_team text,p_color text)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE created json; version text; safe_settings jsonb:=p_settings;
BEGIN
 IF p_format='IPL' THEN
  SELECT c.version INTO version FROM public.player_catalogues c WHERE c.version='crickauction-ddb56cc-2026-11-12';
  IF version IS NULL THEN RAISE EXCEPTION 'The IPL catalogue is not ready'; END IF;
  IF p_settings->>'pool_size' ~ '^[0-9]{1,3}$' AND (p_settings->>'pool_size')::int>150 THEN
   safe_settings:=jsonb_set(p_settings,'{pool_size}','150');
  END IF;
 END IF;
 created:=public.create_room(p_name,p_format,safe_settings,p_nickname,p_team,p_color);
 IF version IS NOT NULL THEN
  UPDATE public.rooms SET catalogue_version=version,legacy_original_catalogue=false,settings=p_settings
  WHERE id=(created->>'room_id')::uuid;
 END IF;
 RETURN created;
END $$;
REVOKE ALL ON FUNCTION public.create_catalogue_room(text,text,jsonb,text,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.create_catalogue_room(text,text,jsonb,text,text,text) TO authenticated;

CREATE FUNCTION public.room_catalogue(p_room uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.rooms;
BEGIN
 PERFORM public._me(p_room);
 SELECT * INTO r FROM public.rooms WHERE id=p_room;
 IF r.catalogue_version IS NOT NULL THEN
  RETURN (SELECT coalesce(jsonb_agg(player_facts ORDER BY player_facts->>'name'),'[]') FROM public.player_catalogue_entries WHERE version=r.catalogue_version);
 END IF;
 RETURN (SELECT coalesce(jsonb_agg(to_jsonb(p) ORDER BY p.name),'[]') FROM public.players p
  WHERE p.format=r.format AND public.is_original_catalogue_player(p.name,p.country));
END $$;
REVOKE ALL ON FUNCTION public.room_catalogue(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.room_catalogue(uuid) TO authenticated;

DO $patch$
DECLARE d text;
BEGIN
 SELECT pg_get_functiondef('public.set_pool(uuid,uuid[])'::regprocedure) INTO d;
 IF strpos(d,'s := r.settings;')=0 OR strpos(d,'cardinality(p_player_ids)>200')=0 THEN RAISE EXCEPTION 'Unexpected set_pool version'; END IF;
 d:=replace(d,'cardinality(p_player_ids)>200','cardinality(p_player_ids)>(CASE WHEN r.catalogue_version IS NULL THEN 200 ELSE 273 END)');
 d:=replace(d,'s := r.settings;', $guard$
 IF r.catalogue_version IS NOT NULL AND EXISTS (
  SELECT FROM unnest(p_player_ids) selected(id) LEFT JOIN public.player_catalogue_entries e
  ON e.version=r.catalogue_version AND e.player_id=selected.id WHERE e.player_id IS NULL
 ) THEN RAISE EXCEPTION 'Choose players from this room catalogue'; END IF;
 s := r.settings;$guard$);
 EXECUTE d;
 SELECT pg_get_functiondef('public._release_settings_guard()'::regprocedure) INTO d;
 IF strpos(d,'NOT BETWEEN 1 AND 150')=0 THEN RAISE EXCEPTION 'Unexpected settings guard'; END IF;
 EXECUTE replace(d,'NOT BETWEEN 1 AND 150','NOT BETWEEN 1 AND (CASE WHEN NEW.catalogue_version IS NULL THEN 150 ELSE 273 END)');
 SELECT pg_get_functiondef('public.place_bid(uuid,numeric)'::regprocedure) INTO d;
 IF strpos(d,'coalesce(r.opening_price, pl.base_price)')=0 THEN RAISE EXCEPTION 'Unexpected bid base price'; END IF;
 EXECUTE replace(d,'coalesce(r.opening_price, pl.base_price)','coalesce(r.opening_price,(public._catalogue_player_json(p_room,pl.id)->>''base_price'')::numeric,pl.base_price)');
 SELECT pg_get_functiondef('public._repair_eligible(uuid,uuid,uuid)'::regprocedure) INTO d;
 IF strpos(d,'coalesce(r.opening_price,p.base_price)')=0 THEN RAISE EXCEPTION 'Unexpected final-call base price'; END IF;
 EXECUTE replace(d,'coalesce(r.opening_price,p.base_price)','coalesce(r.opening_price,(public._catalogue_player_json(p_room,p.id)->>''base_price'')::numeric,p.base_price)');
 SELECT pg_get_functiondef('public._freeze_evaluation_inputs()'::regprocedure) INTO d;
 IF strpos(d,'to_jsonb(p)||CASE')=0 THEN RAISE EXCEPTION 'Unexpected evaluation snapshot'; END IF;
 EXECUTE replace(d,'to_jsonb(p)||CASE','public._catalogue_player_json(NEW.id,p.id)||CASE');
 SELECT pg_get_functiondef('public._room_projection_full(uuid)'::regprocedure) INTO d;
 IF strpos(d,'to_jsonb(p)')=0 THEN RAISE EXCEPTION 'Unexpected full projection'; END IF;
 EXECUTE replace(d,'to_jsonb(p)','public._catalogue_player_json(p_room,p.id)');
END $patch$;

-- The monotonically increasing doorbell revision rejects late network responses.
CREATE FUNCTION public.room_sync(p_room uuid,p_full boolean DEFAULT false) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE result jsonb; r public.rooms;
BEGIN
 PERFORM public._me(p_room);
 SELECT * INTO r FROM public.rooms WHERE id=p_room;
 result:=public.room_live_projection(p_room)||jsonb_build_object(
  'revision',(SELECT revision FROM public.room_updates WHERE room_id=p_room),
  'bids',(SELECT coalesce(jsonb_agg(to_jsonb(b)),'[]') FROM (
   SELECT * FROM public.bids WHERE room_id=p_room AND room_player_id=r.current_rp AND NOT undone
   AND (NOT r.repair_flow OR lot_session=r.bid_session)
   ORDER BY accepted_order DESC NULLS LAST,created_at DESC,id DESC LIMIT 30
  ) b));
 IF p_full THEN
  result:=result||jsonb_build_object(
   'participants',(SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY joined_at),'[]') FROM public.participants t WHERE room_id=p_room),
   'squads',(SELECT coalesce(jsonb_agg(to_jsonb(t)),'[]') FROM public.squads t WHERE room_id=p_room),
   'sales',(SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY created_at DESC,id DESC),'[]') FROM public.sales t WHERE room_id=p_room));
 END IF;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.room_sync(uuid,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.room_sync(uuid,boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.room_projection(p_room uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
 RETURN public._room_projection_full(p_room)||jsonb_build_object(
  'revision',(SELECT revision FROM public.room_updates WHERE room_id=p_room),
  'capabilities',jsonb_build_object('auction_controls',1,'action_sync',1));
END $$;

CREATE FUNCTION public.place_bid_and_sync(p_room uuid,p_amount numeric,p_lot uuid,p_version bigint,p_request uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE accepted numeric;
BEGIN
 accepted:=public.place_bid(p_room,p_amount,p_lot,p_version,p_request);
 RETURN jsonb_build_object('amount',accepted,'live',public.room_sync(p_room));
END $$;
REVOKE ALL ON FUNCTION public.place_bid_and_sync(uuid,numeric,uuid,bigint,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.place_bid_and_sync(uuid,numeric,uuid,bigint,uuid) TO authenticated;

CREATE FUNCTION public.auction_command_and_sync(p_room uuid,p_action text,p_lot uuid,p_version bigint,p_status text,p_revision bigint,p_request uuid,p_payload jsonb DEFAULT '{}')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE result jsonb;
BEGIN
 result:=public.auction_command(p_room,p_action,p_lot,p_version,p_status,p_revision,p_request,p_payload);
 RETURN jsonb_build_object('result',result,'live',public.room_sync(p_room,true));
END $$;
REVOKE ALL ON FUNCTION public.auction_command_and_sync(uuid,text,uuid,bigint,text,bigint,uuid,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.auction_command_and_sync(uuid,text,uuid,bigint,text,bigint,uuid,jsonb) TO authenticated;
