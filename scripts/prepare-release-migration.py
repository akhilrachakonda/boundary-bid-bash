"""Prepare release SQL in /tmp; apply only through the managed migration tool."""
from pathlib import Path
base = Path('drizzle/migrations/0000_auction_schema.sql').read_text()
def definition(name):
    start = base.index('create or replace function public.' + name + '(')
    end = base.index('end $$;', start) + len('end $$;')
    return base[start:end]
sql = r"""
ALTER TABLE public.rooms ADD COLUMN IF NOT EXISTS lot_version bigint NOT NULL DEFAULT 0;
ALTER TABLE public.bids ADD COLUMN IF NOT EXISTS request_id uuid;
CREATE UNIQUE INDEX IF NOT EXISTS bids_request_id ON public.bids(participant_id,request_id) WHERE request_id IS NOT NULL;
CREATE TABLE public.action_limits(user_id uuid NOT NULL, action text NOT NULL, window_start timestamptz NOT NULL, attempts integer NOT NULL DEFAULT 0, PRIMARY KEY(user_id,action));
GRANT ALL ON public.action_limits TO service_role;
ALTER TABLE public.action_limits ENABLE ROW LEVEL SECURITY;
CREATE FUNCTION public._release_limit(p_action text,p_limit integer,p_seconds integer) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE n integer; BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
 INSERT INTO public.action_limits VALUES(auth.uid(),p_action,clock_timestamp(),1)
 ON CONFLICT(user_id,action) DO UPDATE SET attempts=CASE WHEN action_limits.window_start < clock_timestamp()-make_interval(secs=>p_seconds) THEN 1 ELSE action_limits.attempts+1 END,window_start=CASE WHEN action_limits.window_start < clock_timestamp()-make_interval(secs=>p_seconds) THEN clock_timestamp() ELSE action_limits.window_start END RETURNING attempts INTO n;
 RETURN n<=p_limit;
END $$;
CREATE FUNCTION public._release_lot_version() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 IF NEW.status='live' AND OLD.status IS DISTINCT FROM 'live' THEN UPDATE public.rooms SET lot_version=lot_version+1 WHERE id=NEW.room_id; END IF; RETURN NEW; END $$;
CREATE TRIGGER release_lot_version AFTER UPDATE OF status ON public.room_players FOR EACH ROW EXECUTE FUNCTION public._release_lot_version();
CREATE FUNCTION public.place_bid(p_room uuid,p_amount numeric,p_lot uuid,p_version bigint,p_request uuid) RETURNS numeric LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.rooms; me public.participants; old_bid public.bids; amount numeric;
BEGIN
 me:=public._me(p_room); SELECT * INTO r FROM public.rooms WHERE id=p_room FOR UPDATE;
 IF p_request IS NULL THEN RAISE EXCEPTION 'Bid request ID required'; END IF;
 SELECT * INTO old_bid FROM public.bids WHERE participant_id=me.id AND request_id=p_request;
 IF FOUND THEN
  IF old_bid.room_id IS DISTINCT FROM p_room OR old_bid.room_player_id IS DISTINCT FROM p_lot OR old_bid.amount IS DISTINCT FROM p_amount THEN RAISE EXCEPTION 'Request ID already used'; END IF;
  RETURN old_bid.amount;
 END IF;
 IF p_lot IS DISTINCT FROM r.current_rp OR p_version IS DISTINCT FROM r.lot_version THEN RAISE EXCEPTION 'Player changed; refresh before bidding'; END IF;
 IF NOT public._release_limit('bid',120,60) THEN RAISE EXCEPTION 'Too many bids; wait a minute'; END IF;
 amount:=public.place_bid(p_room,p_amount);
 UPDATE public.bids SET request_id=p_request WHERE id=(SELECT id FROM public.bids WHERE participant_id=me.id AND room_player_id=p_lot ORDER BY created_at DESC,id DESC LIMIT 1);
 RETURN amount;
END $$;
CREATE FUNCTION public.host_control(p_room uuid,p_action text,p_version bigint,p_status text,p_sale uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.rooms; latest uuid; BEGIN
 PERFORM public._me(p_room); SELECT * INTO r FROM public.rooms WHERE id=p_room FOR UPDATE;
 IF r.host_id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Only the host can do that'; END IF;
 IF p_version IS DISTINCT FROM r.lot_version OR p_status IS DISTINCT FROM r.status THEN RAISE EXCEPTION 'Room changed; refresh before acting'; END IF;
 IF p_action='undo' THEN SELECT id INTO latest FROM public.sales WHERE room_id=p_room AND participant_id IS NOT NULL AND NOT undone ORDER BY created_at DESC,id DESC LIMIT 1;
 IF p_sale IS NULL OR p_sale IS DISTINCT FROM latest THEN RAISE EXCEPTION 'Sale changed; refresh before undo'; END IF; END IF;
 PERFORM public.host_control(p_room,p_action);
END $$;
CREATE FUNCTION public._release_settings_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE s jsonb:=NEW.settings; k text; inc jsonb; last_threshold numeric:=0; BEGIN
 IF TG_OP='UPDATE' AND s=OLD.settings THEN RETURN NEW; END IF;
 IF jsonb_typeof(s) IS DISTINCT FROM 'object' OR octet_length(s::text)>8192 THEN RAISE EXCEPTION 'Invalid room settings'; END IF;
 FOREACH k IN ARRAY ARRAY['max_teams','min_squad','max_squad','min_wk','min_bat','min_ar','min_bowl','max_overseas','min_spinners','min_pacers','bid_timer','bid_reset','review_seconds'] LOOP
 IF NOT(s ? k) OR s->>k !~ '^[0-9]{1,4}$' THEN RAISE EXCEPTION 'Invalid numeric setting: %',k; END IF; END LOOP;
 IF (s->>'max_teams')::int NOT BETWEEN 2 AND 10 OR (s->>'min_squad')::int NOT BETWEEN 1 AND 25 OR (s->>'max_squad')::int NOT BETWEEN (s->>'min_squad')::int AND 25 THEN RAISE EXCEPTION 'Teams must be 2–10; squad size must be 1–25'; END IF;
 FOREACH k IN ARRAY ARRAY['min_wk','min_bat','min_ar','min_bowl','max_overseas','min_spinners','min_pacers'] LOOP IF (s->>k)::int>(s->>'max_squad')::int THEN RAISE EXCEPTION 'Role limit exceeds squad size'; END IF; END LOOP;
 IF (s->>'min_wk')::int+(s->>'min_bat')::int+(s->>'min_ar')::int+(s->>'min_bowl')::int>(s->>'min_squad')::int THEN RAISE EXCEPTION 'Role minimums exceed minimum squad'; END IF;
 IF (s->>'bid_timer')::int NOT BETWEEN 1 AND 120 OR (s->>'bid_reset')::int NOT BETWEEN 1 AND 120 OR (s->>'review_seconds')::int NOT BETWEEN 1 AND 600 THEN RAISE EXCEPTION 'Timer out of bounds'; END IF;
 IF s->>'purse' IS NULL OR s->>'purse' !~ '^[0-9]+(\.[0-9]{1,2})?$' OR (s->>'purse')::numeric NOT BETWEEN 1 AND 100000 OR s->>'min_base' IS DISTINCT FROM '0.2' THEN RAISE EXCEPTION 'Invalid purse or minimum base reserve'; END IF;
 IF s->>'currency' NOT IN ('cr','lakh','coins') OR (s->>'pool_size'<>'all' AND (s->>'pool_size' !~ '^[0-9]{1,3}$' OR (s->>'pool_size')::int NOT BETWEEN 1 AND 150)) THEN RAISE EXCEPTION 'Invalid display or pool setting'; END IF;
 IF jsonb_typeof(s->'increments') IS DISTINCT FROM 'array' OR jsonb_array_length(s->'increments') NOT BETWEEN 1 AND 10 THEN RAISE EXCEPTION 'Invalid bid increments'; END IF;
 FOR inc IN SELECT * FROM jsonb_array_elements(s->'increments') LOOP
 IF inc->>'step' IS NULL OR inc->>'step' !~ '^[0-9]+(\.[0-9]{1,2})?$' OR (inc->>'step')::numeric NOT BETWEEN 0.01 AND 1000 THEN RAISE EXCEPTION 'Bid step must be positive'; END IF;
 IF inc->>'upto' IS NOT NULL THEN IF (inc->>'upto')::numeric<=last_threshold THEN RAISE EXCEPTION 'Bid thresholds must increase'; END IF; last_threshold:=(inc->>'upto')::numeric; END IF;
 END LOOP;
 IF TG_OP='INSERT' THEN IF NOT public._release_limit('create',5,3600) THEN RAISE EXCEPTION 'Room creation limit reached; try later'; END IF; END IF;
 RETURN NEW; END $$;
CREATE TRIGGER release_settings BEFORE INSERT OR UPDATE OF settings ON public.rooms FOR EACH ROW EXECUTE FUNCTION public._release_settings_guard();
CREATE FUNCTION public._release_player_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$ BEGIN
 IF length(NEW.name)>100 OR length(NEW.country)>60 OR NEW.base_price NOT BETWEEN 0.2 AND 1000 OR length(coalesce(NEW.photo_url,''))>4096 OR length(coalesce(NEW.photo_source,''))>4096 OR length(coalesce(NEW.photo_credit,''))>1000 THEN RAISE EXCEPTION 'Player fields out of bounds'; END IF;
 IF coalesce(NEW.photo_url,'')<>'' AND NEW.photo_url !~ '^https://' AND NEW.photo_url !~ '^/__l5e/assets-v1/' THEN RAISE EXCEPTION 'Photo must use HTTPS'; END IF;
 IF coalesce(NEW.photo_source,'')<>'' AND NEW.photo_source !~ '^https://' THEN RAISE EXCEPTION 'Source must use HTTPS'; END IF; RETURN NEW; END $$;
CREATE TRIGGER release_player BEFORE INSERT OR UPDATE ON public.players FOR EACH ROW EXECUTE FUNCTION public._release_player_guard();
CREATE FUNCTION public._release_notes_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$ BEGIN
 IF NOT public.is_room_member(NEW.room_id) OR length(NEW.notes)>20000 OR octet_length(NEW.targets::text)>32768 OR octet_length(NEW.xi::text)>8192 THEN RAISE EXCEPTION 'Private notes out of bounds or wrong room'; END IF; RETURN NEW; END $$;
CREATE TRIGGER release_notes BEFORE INSERT OR UPDATE ON public.private_notes FOR EACH ROW EXECUTE FUNCTION public._release_notes_guard();
"""
join = definition('join_room').replace("if auth.uid() is null then raise exception 'Not signed in'; end if;", "if auth.uid() is null then raise exception 'Not signed in'; end if;\n  if not public._release_limit('join',30,60) then return null; end if;\n  if coalesce(p_code,'') !~ '^[A-Za-z2-9]{6}$' or length(coalesce(p_nickname,''))>24 or length(coalesce(p_team,''))>30 or coalesce(p_color,'#22d3ee') !~ '^#[0-9a-fA-F]{6}$' then return null; end if;")
for old in ["raise exception 'No room with that code'", "raise exception 'This auction has already started'", "raise exception 'Room is full'"]:
    join = join.replace(old, 'return null')
sql += join + '\n'
trade = definition('propose_trade').replace('where id = p_room;', 'where id = p_room for update;')
trade = trade.replace("if p_to = me.id", "if cardinality(p_offer)>25 or cardinality(p_request)>25 or abs(coalesce(p_cash,0))>100000 or coalesce(p_cash,0)::text in ('NaN','Infinity','-Infinity') then raise exception 'Trade out of bounds'; end if;\n  if (select count(*) from public.trades where room_id=p_room and from_participant=me.id and created_at>now()-interval '1 minute')>=20 then raise exception 'Too many trades; wait a minute'; end if;\n  if p_parent is not null and not exists(select 1 from public.trades where id=p_parent and room_id=p_room and to_participant=me.id and from_participant=p_to) then raise exception 'Invalid counter trade'; end if;\n  if p_to = me.id")
sql += trade + '\n'
sql += r"""
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE ALL ON public.rooms,public.room_players,public.action_limits FROM authenticated;
REVOKE INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON public.user_roles,public.participants,public.bids,public.sales,public.squads,public.trades,public.room_events,public.room_updates,public.evaluation_snapshots,public.evidence_matches,public.evidence_innings,public.evidence_players,public.evidence_positions,public.leadership_reviews,public.evaluation_lineups,public.room_evaluation_inputs,public.room_evaluations FROM authenticated;
DO $$ DECLARE p record; BEGIN FOR p IN SELECT oid::regprocedure AS sig FROM pg_proc WHERE pronamespace='public'::regnamespace LOOP EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC,anon',p.sig); END LOOP; END $$;
REVOKE EXECUTE ON FUNCTION public.place_bid(uuid,numeric),public.host_control(uuid,text),public._release_limit(text,integer,integer),public._release_lot_version(),public._release_settings_guard(),public._release_player_guard(),public._release_notes_guard(),public.attach_sale_event_lot() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.place_bid(uuid,numeric,uuid,bigint,uuid),public.host_control(uuid,text,bigint,text,uuid) TO authenticated;
ALTER FUNCTION public._is_pacer(text,text) SET search_path=public;
ALTER FUNCTION public._is_spinner(text) SET search_path=public;
ALTER FUNCTION public._max_bid(jsonb,numeric,jsonb,text) SET search_path=public;
ALTER FUNCTION public.next_bid_amount(jsonb,numeric,numeric) SET search_path=public;
ALTER FUNCTION public.server_now() SET search_path=public;
COMMENT ON FUNCTION public.place_bid(uuid,numeric) IS 'DEPRECATED: internal only; use lot/version/request-bound overload';
COMMENT ON FUNCTION public.host_control(uuid,text) IS 'DEPRECATED: internal only; use version/status/sale-bound overload';
"""
Path('/tmp/release-hardening.sql').write_text(sql)
print(sql)