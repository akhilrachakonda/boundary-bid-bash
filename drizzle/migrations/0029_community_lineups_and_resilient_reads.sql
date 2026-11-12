-- New rooms opt in through create_social_room; historical rooms keep their rules.
ALTER TABLE public.rooms ADD COLUMN community_mode boolean NOT NULL DEFAULT false;
ALTER TABLE public.rooms ADD COLUMN post_phase text CHECK(post_phase IN ('lineup','rating','done'));
ALTER TABLE public.rooms ADD COLUMN phase_ends_at timestamptz;
CREATE TABLE public.community_lineups (
 room_id uuid NOT NULL REFERENCES public.rooms ON DELETE CASCADE,
 participant_id uuid NOT NULL REFERENCES public.participants ON DELETE CASCADE,
 batting_order uuid[] NOT NULL DEFAULT '{}', bowling_overs jsonb NOT NULL DEFAULT '{}',
 batting_phases jsonb NOT NULL DEFAULT '{}', confirmed boolean NOT NULL DEFAULT false,
 updated_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(room_id,participant_id)
);
CREATE TABLE public.community_votes (
 room_id uuid NOT NULL REFERENCES public.rooms ON DELETE CASCADE,
 rater uuid NOT NULL REFERENCES public.participants ON DELETE CASCADE,
 target uuid NOT NULL REFERENCES public.participants ON DELETE CASCADE,
 top_order integer NOT NULL CHECK(top_order BETWEEN 1 AND 10),
 middle_finishing integer NOT NULL CHECK(middle_finishing BETWEEN 1 AND 10),
 bowling integer NOT NULL CHECK(bowling BETWEEN 1 AND 10),
 PRIMARY KEY(room_id,rater,target), CHECK(rater<>target)
);
ALTER TABLE public.community_lineups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_votes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.community_lineups,public.community_votes FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.community_lineups,public.community_votes TO service_role;
-- No raw table publication or participant reads: private drafts and votes stay private.
CREATE TRIGGER community_lineup_notify AFTER INSERT OR UPDATE ON public.community_lineups FOR EACH ROW EXECUTE FUNCTION public._notify_room_update();
CREATE TRIGGER community_vote_notify AFTER INSERT OR UPDATE ON public.community_votes FOR EACH ROW EXECUTE FUNCTION public._notify_room_update();

CREATE FUNCTION public._community_room_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE k text;
BEGIN
 IF NEW.community_mode THEN
  FOREACH k IN ARRAY ARRAY['trade_minutes','lineup_minutes'] LOOP
   IF NEW.settings ? k AND (NEW.settings->>k IS NULL OR NEW.settings->>k !~ '^[0-9]{1,3}$' OR (NEW.settings->>k)::int NOT BETWEEN 1 AND 120) THEN RAISE EXCEPTION 'Stage timers must be 1–120 minutes'; END IF;
  END LOOP;
  IF TG_OP='UPDATE' AND OLD.status<>'results' AND NEW.status='results' THEN
   NEW.post_phase:='lineup'; NEW.phase_ends_at:=clock_timestamp()+make_interval(mins=>coalesce((NEW.settings->>'lineup_minutes')::int,5));
  END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER community_room_guard BEFORE INSERT OR UPDATE ON public.rooms FOR EACH ROW EXECUTE FUNCTION public._community_room_guard();

CREATE FUNCTION public.create_social_room(p_name text,p_format text,p_settings jsonb,p_nickname text,p_team text,p_color text) RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE result json;
BEGIN
 result:=public.create_catalogue_room(p_name,p_format,p_settings,p_nickname,p_team,p_color);
 UPDATE public.rooms SET community_mode=true WHERE id=(result->>'room_id')::uuid;
 RETURN result;
END $$;

CREATE FUNCTION public._community_advance(p_room uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.rooms; n integer;
BEGIN
 SELECT * INTO r FROM public.rooms WHERE id=p_room FOR UPDATE;
 IF NOT r.community_mode OR r.status<>'results' THEN RETURN; END IF;
 SELECT count(*) INTO n FROM public.participants WHERE room_id=p_room;
 IF r.post_phase='lineup' AND (clock_timestamp()>=r.phase_ends_at OR (SELECT count(*) FROM public.community_lineups WHERE room_id=p_room AND confirmed)=n) THEN
  UPDATE public.rooms SET post_phase='rating',phase_ends_at=NULL WHERE id=p_room;
  PERFORM public._log(p_room,'info','Playing XIs revealed; rate the other teams');
 ELSIF r.post_phase='rating' AND (SELECT count(*) FROM public.community_votes WHERE room_id=p_room)=n*(n-1) THEN
  UPDATE public.rooms SET post_phase='done',phase_ends_at=NULL WHERE id=p_room;
  PERFORM public._log(p_room,'info','All team ratings received');
 END IF;
END $$;

CREATE FUNCTION public.community_control(p_room uuid,p_action text,p_status text,p_phase text,p_payload jsonb DEFAULT '{}') RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.rooms; tm integer; lm integer; n integer;
BEGIN
 PERFORM public._me(p_room); SELECT * INTO r FROM public.rooms WHERE id=p_room FOR UPDATE;
 IF r.host_id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Only the host can do that'; END IF;
 IF r.status IS DISTINCT FROM p_status OR r.post_phase IS DISTINCT FROM p_phase THEN RAISE EXCEPTION 'Stage changed; refresh before acting'; END IF;
 IF p_action='enable' THEN
  IF r.status<>'lobby' THEN RAISE EXCEPTION 'Choose team voting before the auction starts'; END IF;
  UPDATE public.rooms SET community_mode=true WHERE id=p_room; RETURN true;
 END IF;
 IF NOT r.community_mode THEN RAISE EXCEPTION 'This room uses historical evaluation'; END IF;
 IF p_action='timers' THEN
  IF r.post_phase IN ('rating','done') THEN RAISE EXCEPTION 'Timed stages have finished'; END IF;
  IF p_payload->>'trade_minutes' IS NULL OR p_payload->>'lineup_minutes' IS NULL OR p_payload->>'trade_minutes' !~ '^[0-9]{1,3}$' OR p_payload->>'lineup_minutes' !~ '^[0-9]{1,3}$' THEN RAISE EXCEPTION 'Enter whole minutes'; END IF;
  tm:=(p_payload->>'trade_minutes')::int; lm:=(p_payload->>'lineup_minutes')::int;
  IF tm NOT BETWEEN 1 AND 120 OR lm NOT BETWEEN 1 AND 120 THEN RAISE EXCEPTION 'Stage timers must be 1–120 minutes'; END IF;
  UPDATE public.rooms SET settings=settings||jsonb_build_object('trade_minutes',tm,'lineup_minutes',lm),
   trade_ends_at=CASE WHEN status='trade' THEN clock_timestamp()+make_interval(mins=>tm) ELSE trade_ends_at END,
   phase_ends_at=CASE WHEN post_phase='lineup' THEN clock_timestamp()+make_interval(mins=>lm) ELSE phase_ends_at END WHERE id=p_room;
 ELSIF p_action='reveal' THEN
  IF r.post_phase IS DISTINCT FROM 'lineup' THEN RAISE EXCEPTION 'Not choosing XIs'; END IF;
  UPDATE public.rooms SET phase_ends_at=clock_timestamp() WHERE id=p_room; PERFORM public._community_advance(p_room);
 ELSIF p_action='finish' THEN
  IF r.post_phase IS DISTINCT FROM 'rating' THEN RAISE EXCEPTION 'Not rating teams'; END IF;
  SELECT count(*) INTO n FROM public.participants WHERE room_id=p_room;
  IF (SELECT count(*) FROM public.community_votes WHERE room_id=p_room)<n*(n-1) AND p_payload->'allow_incomplete' IS DISTINCT FROM 'true'::jsonb THEN RAISE EXCEPTION 'Confirm closing with missing ratings'; END IF;
  UPDATE public.rooms SET post_phase='done',phase_ends_at=NULL WHERE id=p_room;
 ELSE RAISE EXCEPTION 'Unknown stage action'; END IF;
 RETURN true;
END $$;

CREATE FUNCTION public.save_community_lineup(p_room uuid,p_order uuid[],p_overs jsonb,p_batting jsonb,p_confirm boolean DEFAULT false) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.rooms; me public.participants; owned integer; lim integer; maxo integer; total integer:=0; selected_player uuid; v jsonb; k text;
BEGIN
 SELECT * INTO r FROM public.rooms WHERE id=p_room FOR UPDATE; me:=public._me(p_room);
 IF NOT r.community_mode OR r.status<>'results' OR r.post_phase IS DISTINCT FROM 'lineup' OR clock_timestamp()>=r.phase_ends_at THEN RAISE EXCEPTION 'Playing XI selection is closed'; END IF;
 IF p_order IS NULL OR p_confirm IS NULL OR cardinality(p_order)>11 OR cardinality(p_order)<>(SELECT count(DISTINCT x) FROM unnest(p_order) x) THEN RAISE EXCEPTION 'Choose up to eleven distinct players'; END IF;
 IF (SELECT count(*) FROM public.squads WHERE room_id=p_room AND participant_id=me.id AND player_id=ANY(p_order))<>cardinality(p_order) THEN RAISE EXCEPTION 'Only players you own can enter your XI'; END IF;
 IF jsonb_typeof(p_overs) IS DISTINCT FROM 'object' OR jsonb_typeof(p_batting) IS DISTINCT FROM 'object' OR octet_length(p_overs::text)>4000 OR octet_length(p_batting::text)>6000 THEN RAISE EXCEPTION 'Invalid match plan'; END IF;
 IF EXISTS(SELECT FROM jsonb_object_keys(p_overs) x WHERE NOT x=ANY(p_order::text[])) OR EXISTS(SELECT FROM jsonb_object_keys(p_batting) x WHERE NOT x=ANY(p_order::text[])) THEN RAISE EXCEPTION 'Plan contains a player outside the XI'; END IF;
 lim:=CASE WHEN r.format='ODI' THEN 10 ELSE 4 END; maxo:=lim*5;
 FOREACH selected_player IN ARRAY p_order LOOP
  IF coalesce(p_overs->>selected_player::text,'0') !~ '^[0-9]{1,2}$' OR coalesce((p_overs->>selected_player::text)::int,0) NOT BETWEEN 0 AND lim THEN RAISE EXCEPTION 'Bowling allocation must be 0–% whole overs per player',lim; END IF;
  total:=total+coalesce((p_overs->>selected_player::text)::int,0);
  v:=p_batting->selected_player::text;
  IF v IS NOT NULL THEN
   IF jsonb_typeof(v) IS DISTINCT FROM 'object' OR v->>'from' IS NULL OR v->>'to' IS NULL OR v->>'from' !~ '^[0-9]{1,2}$' OR v->>'to' !~ '^[0-9]{1,2}$' THEN RAISE EXCEPTION 'Enter a batting-over range'; END IF;
   IF (v->>'from')::int NOT BETWEEN 1 AND maxo OR (v->>'to')::int NOT BETWEEN (v->>'from')::int AND maxo THEN RAISE EXCEPTION 'Batting-over range is outside the innings'; END IF;
  ELSIF p_confirm THEN RAISE EXCEPTION 'Set each player batting-over plan'; END IF;
 END LOOP;
 IF total>maxo THEN RAISE EXCEPTION 'Too many bowling overs'; END IF;
 SELECT count(*) INTO owned FROM public.squads WHERE room_id=p_room AND participant_id=me.id;
 IF p_confirm AND (cardinality(p_order)<>least(11,owned) OR total<>least(maxo,lim*cardinality(p_order))) THEN RAISE EXCEPTION 'Select your XI and allocate the available innings overs'; END IF;
 INSERT INTO public.community_lineups(room_id,participant_id,batting_order,bowling_overs,batting_phases,confirmed) VALUES(p_room,me.id,p_order,p_overs,p_batting,p_confirm)
 ON CONFLICT(room_id,participant_id) DO UPDATE SET batting_order=EXCLUDED.batting_order,bowling_overs=EXCLUDED.bowling_overs,batting_phases=EXCLUDED.batting_phases,confirmed=EXCLUDED.confirmed,updated_at=clock_timestamp();
 PERFORM public._community_advance(p_room); RETURN true;
END $$;

CREATE FUNCTION public.rate_community_team(p_room uuid,p_target uuid,p_top integer,p_middle integer,p_bowling integer) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.rooms; me public.participants;
BEGIN
 SELECT * INTO r FROM public.rooms WHERE id=p_room FOR UPDATE; me:=public._me(p_room);
 IF NOT r.community_mode OR r.post_phase IS DISTINCT FROM 'rating' THEN RAISE EXCEPTION 'Team ratings are closed'; END IF;
 IF p_target=me.id OR NOT EXISTS(SELECT FROM public.participants WHERE id=p_target AND room_id=p_room) THEN RAISE EXCEPTION 'Rate another team in this room'; END IF;
 IF p_top IS NULL OR p_middle IS NULL OR p_bowling IS NULL OR p_top NOT BETWEEN 1 AND 10 OR p_middle NOT BETWEEN 1 AND 10 OR p_bowling NOT BETWEEN 1 AND 10 THEN RAISE EXCEPTION 'Each rating must be 1–10'; END IF;
 INSERT INTO public.community_votes VALUES(p_room,me.id,p_target,p_top,p_middle,p_bowling)
 ON CONFLICT(room_id,rater,target) DO UPDATE SET top_order=EXCLUDED.top_order,middle_finishing=EXCLUDED.middle_finishing,bowling=EXCLUDED.bowling;
 PERFORM public._community_advance(p_room); RETURN true;
END $$;

CREATE FUNCTION public.community_state(p_room uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.rooms; me public.participants; visible boolean;
BEGIN
 me:=public._me(p_room); SELECT * INTO r FROM public.rooms WHERE id=p_room;
 IF NOT r.community_mode THEN RETURN NULL; END IF; visible:=r.post_phase IN ('rating','done');
 RETURN jsonb_build_object('phase',r.post_phase,'deadline',r.phase_ends_at,
  'lineups',(SELECT coalesce(jsonb_agg(to_jsonb(l)),'[]') FROM public.community_lineups l WHERE room_id=p_room AND (visible OR participant_id=me.id)),
  'confirmed',(SELECT coalesce(jsonb_agg(participant_id),'[]') FROM public.community_lineups WHERE room_id=p_room AND confirmed),
  'my_votes',(SELECT coalesce(jsonb_agg(to_jsonb(v)),'[]') FROM public.community_votes v WHERE room_id=p_room AND rater=me.id),
  'votes_received',(SELECT count(*) FROM public.community_votes WHERE room_id=p_room),
  'results',CASE WHEN r.post_phase='done' THEN (SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY overall DESC NULLS LAST,participant_id),'[]') FROM (
   SELECT p.id AS participant_id,count(v.rater)::int AS voters,avg(v.top_order) AS top_order,avg(v.middle_finishing) AS middle_finishing,avg(v.bowling) AS bowling,avg((v.top_order+v.middle_finishing+v.bowling)/3.0) AS overall
   FROM public.participants p LEFT JOIN public.community_votes v ON v.room_id=p.room_id AND v.target=p.id AND v.rater<>p.id WHERE p.room_id=p_room GROUP BY p.id
  ) t) ELSE '[]'::jsonb END);
END $$;

-- Preserve ownership/cash validation while removing composition and size restrictions in community trades.
DO $$ DECLARE d text; BEGIN
 d:=pg_get_functiondef('public.propose_trade(uuid,uuid,uuid[],uuid[],numeric,uuid)'::regprocedure);
 IF strpos(d,'cardinality(p_offer)>25')=0 THEN RAISE EXCEPTION 'Unexpected trade proposal function'; END IF;
 d:=replace(d,'cardinality(p_offer)>25','cardinality(p_offer)>(CASE WHEN r.community_mode THEN 273 ELSE 25 END)');
 d:=replace(d,'cardinality(p_request)>25','cardinality(p_request)>(CASE WHEN r.community_mode THEN 273 ELSE 25 END)'); EXECUTE replace(d,'now()','clock_timestamp()');
 d:=pg_get_functiondef('public.respond_trade(uuid,text)'::regprocedure);
 IF strpos(d,'perform public._check_after_trade(r.settings, b_from, t.from_participant);')=0 THEN RAISE EXCEPTION 'Unexpected trade function'; END IF;
 d:=replace(d,'perform public._check_after_trade(r.settings, b_from, t.from_participant);', 'IF r.community_mode THEN IF EXISTS(SELECT FROM public.participants WHERE id IN(t.from_participant,t.to_participant) AND purse<0) THEN RAISE EXCEPTION ''Not enough purse for this trade''; END IF; ELSE perform public._check_after_trade(r.settings, b_from, t.from_participant);');
 d:=replace(d,'perform public._check_after_trade(r.settings, b_to, t.to_participant);','perform public._check_after_trade(r.settings, b_to, t.to_participant); END IF;'); EXECUTE replace(d,'now()','clock_timestamp()');
 -- Avoid per-bid full-projection quadratic scans through the frozen player array.
 d:=pg_get_functiondef('public._room_projection_full(uuid)'::regprocedure);
 d:=replace(d,'inputs public.room_evaluation_inputs;','inputs public.room_evaluation_inputs; facts_by_id jsonb;');
 d:=replace(d,'surprise:=', 'SELECT coalesce(jsonb_object_agg(f->>''id'',f),''{}'') INTO facts_by_id FROM jsonb_array_elements(coalesce(inputs.player_facts,''[]''::jsonb)) f; surprise:=');
 d:=replace(d,'(SELECT fact FROM jsonb_array_elements(coalesce(inputs.player_facts,''[]''::jsonb)) fact WHERE fact->>''id''=p.id::text LIMIT 1),public._catalogue_player_json(p_room,p.id)', 'facts_by_id->p.id::text,e.player_facts,to_jsonb(p)');
 d:=replace(d,'JOIN public.players p ON p.id=rp.player_id WHERE', 'JOIN public.players p ON p.id=rp.player_id LEFT JOIN public.player_catalogue_entries e ON e.version=r.catalogue_version AND e.player_id=p.id WHERE'); EXECUTE d;
 d:=pg_get_functiondef('public.tick(uuid)'::regprocedure);
 IF strpos(d,'select * into r from public.rooms where id = p_room for update;')=0 THEN RAISE EXCEPTION 'Unexpected tick'; END IF;
 d:=replace(d,'select * into r from public.rooms where id = p_room for update;', 'select * into r from public.rooms where id = p_room for update skip locked; IF NOT FOUND THEN RETURN ''busy''; END IF; IF r.community_mode AND r.status=''results'' THEN PERFORM public._community_advance(p_room); RETURN ''community''; END IF;');
 EXECUTE replace(d,'now()','clock_timestamp()');
END $$;
CREATE INDEX IF NOT EXISTS bids_live_room_order ON public.bids(room_id,room_player_id,lot_session,accepted_order DESC,created_at DESC,id DESC) WHERE NOT undone;
CREATE FUNCTION public.room_poll(p_room uuid,p_revision bigint) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
 PERFORM public._me(p_room);
 IF (SELECT revision FROM public.room_updates WHERE room_id=p_room)<=p_revision THEN RETURN NULL; END IF;
 RETURN public.room_sync(p_room);
END $$;
CREATE OR REPLACE FUNCTION public.room_projection(p_room uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN RETURN public._room_projection_full(p_room)||jsonb_build_object('revision',(SELECT revision FROM public.room_updates WHERE room_id=p_room),'capabilities',jsonb_build_object('auction_controls',1,'action_sync',1,'bounded_poll',1,'community',1)); END $$;
DO $$ DECLARE f record; BEGIN
 FOR f IN SELECT oid::regprocedure sig,proname FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname IN ('_community_room_guard','_community_advance','create_social_room','community_control','save_community_lineup','rate_community_team','community_state','room_poll') LOOP
 EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated',f.sig);
 IF left(f.proname,1)<>'_' THEN EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated',f.sig); END IF;
 END LOOP;
END $$;
