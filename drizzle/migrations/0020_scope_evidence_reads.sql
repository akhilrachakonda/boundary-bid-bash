CREATE OR REPLACE FUNCTION public.can_read_snapshot(p_snapshot uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT auth.uid() IS NOT NULL AND (
    EXISTS (SELECT 1 FROM public.evaluation_snapshots s WHERE s.id=p_snapshot AND s.status='validated')
    OR EXISTS (SELECT 1 FROM public.room_evaluation_inputs i JOIN public.participants p ON p.room_id=i.room_id
               WHERE i.snapshot_id=p_snapshot AND p.user_id=auth.uid())
    OR public.has_role(auth.uid(),'admin'))
$$;
REVOKE ALL ON FUNCTION public.can_read_snapshot(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_read_snapshot(uuid) TO authenticated;

DROP POLICY IF EXISTS "same position evidence for all" ON public.evidence_positions;
CREATE POLICY "position evidence for readable snapshots" ON public.evidence_positions FOR SELECT TO authenticated USING (public.can_read_snapshot(snapshot_id));

DROP POLICY IF EXISTS "read identical player evidence" ON public.evidence_players;
CREATE POLICY "player evidence for readable snapshots" ON public.evidence_players FOR SELECT TO authenticated USING (public.can_read_snapshot(snapshot_id));

DROP POLICY IF EXISTS "read available match provenance" ON public.evidence_matches;
CREATE POLICY "admins read match provenance" ON public.evidence_matches FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS "read verified innings" ON public.evidence_innings;
CREATE POLICY "admins read innings" ON public.evidence_innings FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS "read public leadership rubric evidence" ON public.leadership_reviews;
CREATE POLICY "read published leadership reviews" ON public.leadership_reviews FOR SELECT TO authenticated
  USING (status IN ('reviewed','evidence_only') OR public.has_role(auth.uid(),'admin'));