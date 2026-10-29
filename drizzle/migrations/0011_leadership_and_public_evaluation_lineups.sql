CREATE TABLE public.leadership_reviews (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), player_id uuid NOT NULL REFERENCES public.players(id), captain_rating numeric NOT NULL DEFAULT 50 CHECK(captain_rating BETWEEN 0 AND 100), vice_captain_rating numeric NOT NULL DEFAULT 50 CHECK(vice_captain_rating BETWEEN 0 AND 100), status text NOT NULL DEFAULT 'unrated' CHECK(status IN ('unrated','evidence_only','reviewed')), rubric_version text NOT NULL DEFAULT 'leadership-1', sources jsonb NOT NULL DEFAULT '[]', rationale text NOT NULL DEFAULT '', cutoff date NOT NULL, reviewer text NOT NULL, confidence numeric NOT NULL DEFAULT 0 CHECK(confidence BETWEEN 0 AND 1), created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.leadership_reviews TO authenticated;
GRANT ALL ON public.leadership_reviews TO service_role;
ALTER TABLE public.leadership_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read public leadership rubric evidence" ON public.leadership_reviews FOR SELECT TO authenticated USING(true);
CREATE TRIGGER immutable_leadership_review BEFORE UPDATE OR DELETE ON public.leadership_reviews FOR EACH ROW EXECUTE FUNCTION public._immutable_snapshot();
CREATE TABLE public.evaluation_lineups (room_id uuid NOT NULL REFERENCES public.rooms(id), participant_id uuid NOT NULL REFERENCES public.participants(id), lineup uuid[] NOT NULL, captain uuid NOT NULL, vice_captain uuid NOT NULL, updated_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(room_id,participant_id));
GRANT SELECT ON public.evaluation_lineups TO authenticated;
GRANT ALL ON public.evaluation_lineups TO service_role;
ALTER TABLE public.evaluation_lineups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read public submitted lineups" ON public.evaluation_lineups FOR SELECT TO authenticated USING(public.is_room_member(room_id));
CREATE TRIGGER notify_public_lineup AFTER INSERT OR UPDATE OR DELETE ON public.evaluation_lineups FOR EACH ROW EXECUTE FUNCTION public._notify_room_update();
CREATE OR REPLACE FUNCTION public.submit_evaluation_lineup(p_room uuid,p_lineup uuid[],p_captain uuid,p_vice uuid,p_auto boolean DEFAULT false) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.rooms; me public.participants; rules jsonb; overseas integer; bowlers integer; keeper integer;
BEGIN
 SELECT * INTO r FROM public.rooms WHERE id=p_room FOR UPDATE; me:=public._me(p_room);
 IF r.evaluation_version<>'v2.1' OR r.status NOT IN ('completed','trade') OR EXISTS(SELECT 1 FROM public.room_evaluations WHERE room_id=p_room) OR (r.status='trade' AND r.trade_ends_at<=now()) THEN RAISE EXCEPTION 'Lineups can only change after the auction and before finalization'; END IF;
 IF p_auto THEN DELETE FROM public.evaluation_lineups WHERE room_id=p_room AND participant_id=me.id; RETURN; END IF;
 IF cardinality(p_lineup)<>11 OR (SELECT count(DISTINCT v) FROM unnest(p_lineup) v)<>11 OR array_position(p_lineup,NULL) IS NOT NULL THEN RAISE EXCEPTION 'Choose 11 distinct players in positions 1-11'; END IF;
 IF p_captain=p_vice OR NOT(p_captain=ANY(p_lineup)) OR NOT(p_vice=ANY(p_lineup)) OR p_captain IS NULL OR p_vice IS NULL THEN RAISE EXCEPTION 'Captain and vice-captain must be distinct XI players'; END IF;
 IF (SELECT count(*) FROM public.squads WHERE room_id=p_room AND participant_id=me.id AND player_id=ANY(p_lineup))<>11 THEN RAISE EXCEPTION 'XI players must belong to your current squad'; END IF;
 SELECT rules INTO rules FROM public.room_evaluation_inputs WHERE room_id=p_room;
 SELECT count(*) FILTER(WHERE f->>'nationality_type'='Overseas'), count(*) FILTER(WHERE f->>'role' IN ('BOWL','AR')),count(*) FILTER(WHERE f->>'role'='WK') INTO overseas,bowlers,keeper FROM public.room_evaluation_inputs i CROSS JOIN LATERAL jsonb_array_elements(i.player_facts) f WHERE i.room_id=p_room AND (f->>'id')::uuid=ANY(p_lineup);
 IF keeper<1 OR bowlers<5 OR overseas>least(coalesce((r.settings->>'max_overseas')::integer,11),CASE WHEN r.format='IPL' THEN 4 ELSE 11 END) THEN RAISE EXCEPTION 'XI requires keeper, five bowling options and legal overseas count'; END IF;
 INSERT INTO public.evaluation_lineups VALUES(p_room,me.id,p_lineup,p_captain,p_vice,now()) ON CONFLICT(room_id,participant_id) DO UPDATE SET lineup=EXCLUDED.lineup,captain=EXCLUDED.captain,vice_captain=EXCLUDED.vice_captain,updated_at=now();
END $$;
REVOKE ALL ON FUNCTION public.submit_evaluation_lineup(uuid,uuid[],uuid,uuid,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.submit_evaluation_lineup(uuid,uuid[],uuid,uuid,boolean) TO authenticated;
CREATE OR REPLACE FUNCTION public.review_leadership(p_player uuid,p_captain numeric,p_vice numeric,p_sources jsonb,p_rationale text,p_cutoff date,p_confidence numeric,p_status text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE rid uuid;
BEGIN
 IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Owner only'; END IF;
 IF p_cutoff>current_date OR jsonb_typeof(p_sources)<>'array' OR length(trim(p_rationale))<10 THEN RAISE EXCEPTION 'Provide dated sources and documented rubric rationale'; END IF;
 IF p_status='reviewed' AND jsonb_array_length(p_sources)=0 THEN RAISE EXCEPTION 'Reviewed rating requires supporting source links'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_sources) s WHERE coalesce(s->>'url','') NOT LIKE 'https://%' OR coalesce(s->>'fact','')='') THEN RAISE EXCEPTION 'Each source requires HTTPS URL and supported fact'; END IF;
 IF p_status<>'reviewed' AND (p_captain<>50 OR p_vice<>50 OR p_confidence<>0) THEN RAISE EXCEPTION 'Unrated leadership uses neutral prior 50 with zero confidence'; END IF;
 INSERT INTO public.leadership_reviews(player_id,captain_rating,vice_captain_rating,sources,rationale,cutoff,confidence,status,reviewer) VALUES(p_player,p_captain,p_vice,p_sources,p_rationale,p_cutoff,p_confidence,p_status,auth.uid()::text) RETURNING id INTO rid; RETURN rid;
END $$;
REVOKE ALL ON FUNCTION public.review_leadership(uuid,numeric,numeric,jsonb,text,date,numeric,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.review_leadership(uuid,numeric,numeric,jsonb,text,date,numeric,text) TO authenticated;
CREATE OR REPLACE FUNCTION public._new_room_surprise() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$ BEGIN NEW.settings:=jsonb_build_object('surprise_reveal',true)||NEW.settings; NEW.evaluation_version:='v2.1'; RETURN NEW; END $$;
CREATE OR REPLACE FUNCTION public._freeze_evaluation_inputs() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE sid uuid; facts jsonb;
BEGIN
 IF OLD.status='lobby' AND NEW.status='review' AND NEW.evaluation_version IN ('v2.0','v2.1') THEN
 SELECT id INTO sid FROM public.evaluation_snapshots WHERE status='validated' ORDER BY imported_at DESC,id LIMIT 1;
 SELECT jsonb_agg(to_jsonb(p)||CASE WHEN NEW.evaluation_version='v2.1' THEN jsonb_build_object('leadership',coalesce((SELECT to_jsonb(l) FROM public.leadership_reviews l WHERE l.player_id=p.id ORDER BY l.created_at DESC,l.id LIMIT 1),jsonb_build_object('captain_rating',50,'vice_captain_rating',50,'status','unrated','rubric_version','leadership-1','confidence',0,'sources','[]'::jsonb,'rationale','Unrated / neutral prior; no reviewed captain or vice-captain evidence','cutoff',current_date))) ELSE '{}'::jsonb END ORDER BY p.id) INTO facts FROM public.room_players rp JOIN public.players p ON p.id=rp.player_id WHERE rp.room_id=NEW.id;
 INSERT INTO public.room_evaluation_inputs(room_id,snapshot_id,version,player_facts,rules) VALUES(NEW.id,sid,NEW.evaluation_version,coalesce(facts,'[]'),jsonb_build_object('weights',CASE WHEN NEW.evaluation_version='v2.1' THEN '{"combination":35,"established":30,"recent":20,"bench":10,"leadership":5}'::jsonb ELSE '{"combination":40,"established":30,"recent":20,"bench":10}'::jsonb END,'leadership_rubric','leadership-1','position_method','arrival-group-1','settings',NEW.settings)) ON CONFLICT(room_id) DO NOTHING;
 END IF; RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION public.evaluation_holdings_hash(p_room uuid) RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE h text; v text;
BEGIN PERFORM public._me(p_room); SELECT evaluation_version INTO v FROM public.rooms WHERE id=p_room;
 SELECT coalesce(string_agg(participant_id::text||':'||player_id::text,',' ORDER BY participant_id,player_id),'') INTO h FROM public.squads WHERE room_id=p_room;
 IF v='v2.1' THEN h:=h||'|lineups:'||coalesce((SELECT string_agg(participant_id::text||':'||lineup::text||':'||captain::text||':'||vice_captain::text,',' ORDER BY participant_id) FROM public.evaluation_lineups WHERE room_id=p_room),''); END IF; RETURN md5(h);
END $$;
CREATE OR REPLACE FUNCTION public.commit_room_evaluation(p_room uuid,p_snapshot uuid,p_hash text,p_result jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.rooms; actual text; h text; saved jsonb;
BEGIN
 SELECT * INTO r FROM public.rooms WHERE id=p_room FOR UPDATE;
 IF r.status<>'results' OR r.evaluation_version NOT IN ('v2.0','v2.1') OR p_result->>'version'<>r.evaluation_version THEN RAISE EXCEPTION 'Only matching final scoring version can be committed'; END IF;
 SELECT coalesce(string_agg(participant_id::text||':'||player_id::text,',' ORDER BY participant_id,player_id),'') INTO h FROM public.squads WHERE room_id=p_room;
 IF r.evaluation_version='v2.1' THEN h:=h||'|lineups:'||coalesce((SELECT string_agg(participant_id::text||':'||lineup::text||':'||captain::text||':'||vice_captain::text,',' ORDER BY participant_id) FROM public.evaluation_lineups WHERE room_id=p_room),''); END IF; actual:=md5(h);
 IF actual<>p_hash THEN RAISE EXCEPTION 'Holdings or lineup changed; recompute'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.room_evaluation_inputs WHERE room_id=p_room AND snapshot_id IS NOT DISTINCT FROM p_snapshot) THEN RAISE EXCEPTION 'Snapshot mismatch'; END IF;
 INSERT INTO public.room_evaluations(room_id,snapshot_id,version,holdings_hash,result) VALUES(p_room,p_snapshot,r.evaluation_version,p_hash,p_result) ON CONFLICT(room_id) DO NOTHING;
 SELECT result INTO saved FROM public.room_evaluations WHERE room_id=p_room; RETURN saved;
END $$;