-- Opt-in IPL franchise reservations; existing rooms retain their chosen identities.
ALTER TABLE public.rooms ADD COLUMN ipl_franchises boolean NOT NULL DEFAULT false;
ALTER TABLE public.participants ADD COLUMN ipl_team text CHECK (ipl_team IN ('CSK','MI','RCB','KKR','DC','PBKS','RR','SRH','LSG','GT'));
CREATE UNIQUE INDEX participants_unique_ipl_team ON public.participants(room_id,ipl_team) WHERE ipl_team IS NOT NULL;
ALTER TABLE public.community_votes ADD COLUMN comment text NOT NULL DEFAULT '' CHECK (char_length(comment)<=500);

CREATE FUNCTION public._ipl_team(p_code text) RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path=public AS $$
 SELECT jsonb_build_object('code',code,'name',name,'color',color) FROM (VALUES
 ('CSK','Chennai Super Kings','#f5b301'),
 ('MI','Mumbai Indians','#168bdf'),
 ('RCB','Royal Challengers Bengaluru','#ef4444'),
 ('KKR','Kolkata Knight Riders','#a855f7'),
 ('DC','Delhi Capitals','#3b82f6'),
 ('PBKS','Punjab Kings','#f43f5e'),
 ('RR','Rajasthan Royals','#ec4899'),
 ('SRH','Sunrisers Hyderabad','#f97316'),
 ('LSG','Lucknow Super Giants','#22d3ee'),
 ('GT','Gujarat Titans','#94a3b8')
 ) t(code,name,color) WHERE code=p_code;
$$;
CREATE FUNCTION public._ipl_identity_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE r public.rooms; t jsonb;
BEGIN
 IF TG_OP='UPDATE' AND NEW.ipl_team IS NOT DISTINCT FROM OLD.ipl_team AND NEW.team_name IS NOT DISTINCT FROM OLD.team_name AND NEW.color IS NOT DISTINCT FROM OLD.color THEN RETURN NEW; END IF;
 SELECT * INTO r FROM public.rooms WHERE id=NEW.room_id;
 IF NEW.ipl_team IS NOT NULL THEN
  IF NOT r.ipl_franchises OR r.format<>'IPL' THEN RAISE EXCEPTION 'This room does not use IPL team selection'; END IF;
  IF TG_OP='UPDATE' AND NEW.ipl_team IS DISTINCT FROM OLD.ipl_team AND r.status<>'lobby' THEN RAISE EXCEPTION 'Teams are locked after the lobby'; END IF;
  t:=public._ipl_team(NEW.ipl_team);
  IF t IS NULL THEN RAISE EXCEPTION 'Choose an IPL team'; END IF;
  NEW.team_name:=t->>'name'; NEW.color:=t->>'color';
 ELSIF TG_OP='UPDATE' AND OLD.ipl_team IS NOT NULL THEN RAISE EXCEPTION 'Choose a replacement IPL team';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER ipl_identity_guard BEFORE INSERT OR UPDATE ON public.participants FOR EACH ROW EXECUTE FUNCTION public._ipl_identity_guard();
CREATE FUNCTION public._ipl_start_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF NEW.ipl_franchises AND OLD.status='lobby' AND NEW.status<>'lobby' AND EXISTS(SELECT FROM public.participants WHERE room_id=NEW.id AND ipl_team IS NULL) THEN RAISE EXCEPTION 'Every participant must choose an available IPL team first'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER ipl_start_guard BEFORE UPDATE ON public.rooms FOR EACH ROW EXECUTE FUNCTION public._ipl_start_guard();

CREATE FUNCTION public.claim_ipl_team(p_room uuid,p_team text) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.rooms; me public.participants;
BEGIN
 SELECT * INTO r FROM public.rooms WHERE id=p_room FOR UPDATE; me:=public._me(p_room);
 IF NOT r.ipl_franchises OR r.format<>'IPL' OR r.status<>'lobby' THEN RAISE EXCEPTION 'IPL teams can only be selected in the lobby'; END IF;
 IF public._ipl_team(p_team) IS NULL THEN RAISE EXCEPTION 'Choose an IPL team'; END IF;
 IF EXISTS(SELECT FROM public.participants WHERE room_id=p_room AND ipl_team=p_team AND id<>me.id) THEN RAISE EXCEPTION 'That IPL team was just taken. Choose another team.'; END IF;
 UPDATE public.participants SET ipl_team=p_team,is_ready=CASE WHEN ipl_team IS DISTINCT FROM p_team THEN false ELSE is_ready END,last_seen=clock_timestamp() WHERE id=me.id;
 RETURN true;
END $$;
CREATE FUNCTION public.enable_ipl_teams(p_room uuid) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.rooms;
BEGIN
 SELECT * INTO r FROM public.rooms WHERE id=p_room FOR UPDATE; PERFORM public._me(p_room);
 IF r.host_id IS DISTINCT FROM auth.uid() OR r.status<>'lobby' OR r.format<>'IPL' THEN RAISE EXCEPTION 'Only the host can enable IPL teams in an IPL lobby'; END IF;
 UPDATE public.rooms SET ipl_franchises=true WHERE id=p_room; RETURN true;
END $$;
CREATE FUNCTION public.create_franchise_room(p_name text,p_settings jsonb,p_nickname text,p_team text) RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE result json; t jsonb:=public._ipl_team(p_team);
BEGIN
 IF t IS NULL THEN RAISE EXCEPTION 'Choose an IPL team'; END IF;
 result:=public.create_social_room(p_name,'IPL',p_settings,p_nickname,t->>'name',t->>'color');
 UPDATE public.rooms SET ipl_franchises=true WHERE id=(result->>'room_id')::uuid;
 PERFORM public.claim_ipl_team((result->>'room_id')::uuid,p_team); RETURN result;
END $$;
CREATE FUNCTION public.room_entry(p_code text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.rooms; me public.participants;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
 IF NOT public._release_limit('room_entry',40,60) THEN RETURN NULL; END IF;
 IF coalesce(trim(p_code),'') !~ '^[A-Za-z2-9]{6}$' THEN RETURN NULL; END IF;
 SELECT * INTO r FROM public.rooms WHERE code=upper(trim(p_code)); IF NOT FOUND THEN RETURN NULL; END IF;
 SELECT * INTO me FROM public.participants WHERE room_id=r.id AND user_id=auth.uid();
 RETURN jsonb_build_object('name',r.name,'format',r.format,'status',r.status,'ipl_franchises',r.ipl_franchises,'is_member',me.id IS NOT NULL,'my_team',me.ipl_team,
  'taken',(SELECT coalesce(jsonb_agg(ipl_team),'[]') FROM public.participants WHERE room_id=r.id AND ipl_team IS NOT NULL),
  'full',(SELECT count(*) FROM public.participants WHERE room_id=r.id)>=(r.settings->>'max_teams')::int);
END $$;
CREATE FUNCTION public.join_franchise_room(p_code text,p_nickname text,p_team text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.rooms; rid uuid; t jsonb:=public._ipl_team(p_team);
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
 SELECT * INTO r FROM public.rooms WHERE code=upper(trim(p_code)) FOR UPDATE;
 IF NOT FOUND OR NOT r.ipl_franchises THEN RAISE EXCEPTION 'Check the room code'; END IF;
 IF EXISTS(SELECT FROM public.participants WHERE room_id=r.id AND user_id=auth.uid()) THEN RETURN r.id; END IF;
 IF t IS NULL THEN RAISE EXCEPTION 'Choose an IPL team'; END IF;
 IF EXISTS(SELECT FROM public.participants WHERE room_id=r.id AND ipl_team=p_team) THEN RAISE EXCEPTION 'That IPL team was just taken. Choose another team.'; END IF;
 rid:=public.join_room(p_code,p_nickname,t->>'name',t->>'color');
 IF rid IS NULL THEN RAISE EXCEPTION 'Room full, closed, or unavailable. Refresh and try again.'; END IF;
 PERFORM public.claim_ipl_team(rid,p_team); RETURN rid;
END $$;

CREATE FUNCTION public.rate_community_team(p_room uuid,p_target uuid,p_top integer,p_middle integer,p_bowling integer,p_comment text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.rooms; me public.participants;
BEGIN
 SELECT * INTO r FROM public.rooms WHERE id=p_room FOR UPDATE; me:=public._me(p_room);
 IF NOT r.community_mode OR r.post_phase IS DISTINCT FROM 'rating' THEN RAISE EXCEPTION 'Team ratings are closed'; END IF;
 IF p_target=me.id OR NOT EXISTS(SELECT FROM public.participants WHERE id=p_target AND room_id=p_room) THEN RAISE EXCEPTION 'Rate another team in this room'; END IF;
 IF p_top IS NULL OR p_middle IS NULL OR p_bowling IS NULL OR p_top NOT BETWEEN 1 AND 10 OR p_middle NOT BETWEEN 1 AND 10 OR p_bowling NOT BETWEEN 1 AND 10 THEN RAISE EXCEPTION 'Each rating must be 1–10'; END IF;
 IF char_length(coalesce(p_comment,''))>500 THEN RAISE EXCEPTION 'Comments must be 500 characters or fewer'; END IF;
 INSERT INTO public.community_votes(room_id,rater,target,top_order,middle_finishing,bowling,comment) VALUES(p_room,me.id,p_target,p_top,p_middle,p_bowling,trim(coalesce(p_comment,'')))
 ON CONFLICT(room_id,rater,target) DO UPDATE SET top_order=EXCLUDED.top_order,middle_finishing=EXCLUDED.middle_finishing,bowling=EXCLUDED.bowling,comment=EXCLUDED.comment;
 PERFORM public._community_advance(p_room); RETURN true;
END $$;

CREATE OR REPLACE FUNCTION public.community_state(p_room uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.rooms; me public.participants; visible boolean;
BEGIN
 me:=public._me(p_room); SELECT * INTO r FROM public.rooms WHERE id=p_room;
 IF NOT r.community_mode THEN RETURN NULL; END IF; visible:=r.post_phase IN ('rating','done');
 RETURN jsonb_build_object('phase',r.post_phase,'deadline',r.phase_ends_at,
  'lineups',(SELECT coalesce(jsonb_agg(to_jsonb(l)),'[]') FROM public.community_lineups l WHERE room_id=p_room AND (visible OR participant_id=me.id)),
  'confirmed',(SELECT coalesce(jsonb_agg(participant_id),'[]') FROM public.community_lineups WHERE room_id=p_room AND confirmed),
  'my_votes',(SELECT coalesce(jsonb_agg(to_jsonb(v)),'[]') FROM public.community_votes v WHERE room_id=p_room AND rater=me.id),
  'visible_votes',(SELECT coalesce(jsonb_agg(to_jsonb(v) ORDER BY v.rater),'[]') FROM public.community_votes v WHERE room_id=p_room AND visible AND (target=me.id OR r.post_phase='done')),
  'votes_received',(SELECT count(*) FROM public.community_votes WHERE room_id=p_room),
  'results',CASE WHEN r.post_phase='done' THEN (SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY overall DESC NULLS LAST,participant_id),'[]') FROM (
   SELECT p.id AS participant_id,count(v.rater)::int AS voters,avg(v.top_order) AS top_order,avg(v.middle_finishing) AS middle_finishing,avg(v.bowling) AS bowling,avg((v.top_order+v.middle_finishing+v.bowling)/3.0) AS overall
   FROM public.participants p LEFT JOIN public.community_votes v ON v.room_id=p.room_id AND v.target=p.id AND v.rater<>p.id WHERE p.room_id=p_room GROUP BY p.id
  ) t) ELSE '[]'::jsonb END);
END $$;

-- Old clients remain compatible; their submission has an empty optional comment.
CREATE OR REPLACE FUNCTION public.rate_community_team(p_room uuid,p_target uuid,p_top integer,p_middle integer,p_bowling integer) RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$
 SELECT public.rate_community_team(p_room,p_target,p_top,p_middle,p_bowling,'');
$$;
REVOKE ALL ON FUNCTION public._ipl_team(text),public._ipl_identity_guard(),public._ipl_start_guard() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.claim_ipl_team(uuid,text),public.enable_ipl_teams(uuid),public.create_franchise_room(text,jsonb,text,text),public.room_entry(text),public.join_franchise_room(text,text,text),public.rate_community_team(uuid,uuid,integer,integer,integer,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.claim_ipl_team(uuid,text),public.enable_ipl_teams(uuid),public.create_franchise_room(text,jsonb,text,text),public.room_entry(text),public.join_franchise_room(text,text,text),public.rate_community_team(uuid,uuid,integer,integer,integer,text) TO authenticated;
