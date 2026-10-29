CREATE TABLE public.evidence_positions (snapshot_id uuid NOT NULL REFERENCES public.evaluation_snapshots(id), identity_key text NOT NULL, format text NOT NULL CHECK(format IN ('IPL','T20','ODI')), groups jsonb NOT NULL, method text NOT NULL DEFAULT 'arrival-group-1', cutoff date NOT NULL, PRIMARY KEY(snapshot_id,identity_key,format));
GRANT SELECT ON public.evidence_positions TO authenticated;
GRANT ALL ON public.evidence_positions TO service_role;
ALTER TABLE public.evidence_positions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "same position evidence for all" ON public.evidence_positions FOR SELECT TO authenticated USING(true);
CREATE TRIGGER immutable_position_evidence BEFORE UPDATE OR DELETE ON public.evidence_positions FOR EACH ROW EXECUTE FUNCTION public._immutable_snapshot();
CREATE OR REPLACE FUNCTION public.submit_evaluation_lineup(p_room uuid,p_lineup uuid[],p_captain uuid,p_vice uuid,p_auto boolean DEFAULT false) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.rooms; me public.participants; overseas integer; bowlers integer; keeper integer;
BEGIN
 SELECT * INTO r FROM public.rooms WHERE id=p_room FOR UPDATE; me:=public._me(p_room);
 IF r.evaluation_version<>'v2.1' OR r.status NOT IN ('completed','trade') OR EXISTS(SELECT 1 FROM public.room_evaluations WHERE room_id=p_room) OR (r.status='trade' AND r.trade_ends_at<=now()) THEN RAISE EXCEPTION 'Lineups can only change after the auction and before finalization'; END IF;
 IF p_auto THEN DELETE FROM public.evaluation_lineups WHERE room_id=p_room AND participant_id=me.id; RETURN; END IF;
 IF cardinality(p_lineup)<>11 OR (SELECT count(DISTINCT v) FROM unnest(p_lineup) v)<>11 OR array_position(p_lineup,NULL) IS NOT NULL THEN RAISE EXCEPTION 'Choose 11 distinct players in positions 1-11'; END IF;
 IF p_captain=p_vice OR NOT(p_captain=ANY(p_lineup)) OR NOT(p_vice=ANY(p_lineup)) OR p_captain IS NULL OR p_vice IS NULL THEN RAISE EXCEPTION 'Captain and vice-captain must be distinct XI players'; END IF;
 IF (SELECT count(*) FROM public.squads WHERE room_id=p_room AND participant_id=me.id AND player_id=ANY(p_lineup))<>11 THEN RAISE EXCEPTION 'XI players must belong to your current squad'; END IF;
 SELECT count(*) FILTER(WHERE f->>'nationality_type'='Overseas'), count(*) FILTER(WHERE f->>'role' IN ('BOWL','AR')),count(*) FILTER(WHERE f->>'role'='WK') INTO overseas,bowlers,keeper FROM public.room_evaluation_inputs i CROSS JOIN LATERAL jsonb_array_elements(i.player_facts) f WHERE i.room_id=p_room AND (f->>'id')::uuid=ANY(p_lineup);
 IF keeper<1 OR bowlers<5 OR overseas>least(coalesce((r.settings->>'max_overseas')::integer,11),CASE WHEN r.format='IPL' THEN 4 ELSE 11 END) THEN RAISE EXCEPTION 'XI requires keeper, five bowling options and legal overseas count'; END IF;
 INSERT INTO public.evaluation_lineups VALUES(p_room,me.id,p_lineup,p_captain,p_vice,now()) ON CONFLICT(room_id,participant_id) DO UPDATE SET lineup=EXCLUDED.lineup,captain=EXCLUDED.captain,vice_captain=EXCLUDED.vice_captain,updated_at=now();
END $$;