CREATE OR REPLACE FUNCTION public.import_evidence_bundle_with_positions(p_bundle jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE sid uuid; item jsonb; g jsonb; k text;
BEGIN
 IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Owner only'; END IF;
 sid:=public.import_evidence_bundle(p_bundle);
 FOR item IN SELECT * FROM jsonb_array_elements(coalesce(p_bundle->'positions','[]')) LOOP
 IF item->>'method'<>'arrival-group-1' OR item->>'format' NOT IN ('IPL','T20','ODI') OR item->>'cutoff'<>p_bundle->'snapshot'->>'cutoff' OR jsonb_typeof(item->'groups')<>'object' OR NOT EXISTS(SELECT 1 FROM public.evidence_players WHERE snapshot_id=sid AND identity_key=item->>'identity_key') THEN RAISE EXCEPTION 'Invalid position identity/method/format'; END IF;
 FOR k,g IN SELECT key,value FROM jsonb_each(item->'groups') LOOP
 IF k NOT IN ('opening','top','middle','lower','tail') OR (g->>'innings')::integer<0 OR (g->>'balls')::integer<0 OR (g->>'runs')::integer<0 OR (g->>'dismissals')::integer<0 OR (g->>'earliest')::date>(g->>'latest')::date OR (g->>'latest')::date>(item->>'cutoff')::date THEN RAISE EXCEPTION 'Invalid position aggregate'; END IF;
 END LOOP;
 INSERT INTO public.evidence_positions(snapshot_id,identity_key,format,groups,method,cutoff) VALUES(sid,item->>'identity_key',item->>'format',item->'groups','arrival-group-1',(item->>'cutoff')::date);
 END LOOP; RETURN sid;
END $$;
REVOKE ALL ON FUNCTION public.import_evidence_bundle_with_positions(jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.import_evidence_bundle_with_positions(jsonb) TO authenticated;