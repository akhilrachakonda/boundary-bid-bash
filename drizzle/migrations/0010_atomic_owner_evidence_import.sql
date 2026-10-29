CREATE OR REPLACE FUNCTION public.import_evidence_bundle(p_bundle jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE sid uuid; snap jsonb; item jsonb;
BEGIN
 IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Only the owner can import'; END IF;
 snap:=p_bundle->'snapshot';sid:=(snap->>'id')::uuid;
 IF snap->>'version'<>'v2.0' OR NOT (snap->'provenance' ? 'attribution') THEN RAISE EXCEPTION 'Version and source attribution required'; END IF;
 IF EXISTS(SELECT 1 FROM public.evaluation_snapshots WHERE id=sid) THEN RAISE EXCEPTION 'Snapshot already imported'; END IF;
 IF jsonb_array_length(p_bundle->'matches')<>(SELECT count(DISTINCT m->>'source_id') FROM jsonb_array_elements(p_bundle->'matches') m) THEN RAISE EXCEPTION 'Duplicate matches'; END IF;
 INSERT INTO public.evaluation_snapshots(id,version,cutoff,status,provenance,coverage,cohorts) VALUES(sid,'v2.0',(snap->>'cutoff')::date,'validated',snap->'provenance',snap->'coverage',snap->'cohorts');
 FOR item IN SELECT * FROM jsonb_array_elements(p_bundle->'matches') LOOP
 IF (item->>'played_on')::date>(snap->>'cutoff')::date OR item->>'content_hash' !~ '^[0-9a-f]{64}$' THEN RAISE EXCEPTION 'Invalid match provenance'; END IF;
 INSERT INTO public.evidence_matches(snapshot_id,source_id,competition,played_on,revision,content_hash,info) VALUES(sid,item->>'source_id',item->>'competition',(item->>'played_on')::date,(item->>'revision')::int,item->>'content_hash',item->'info');
 END LOOP;
 FOR item IN SELECT * FROM jsonb_array_elements(p_bundle->'players') LOOP
 IF NOT EXISTS(SELECT 1 FROM public.players WHERE name=item->>'name' AND country=item->>'country') THEN RAISE EXCEPTION 'Unknown catalogue identity'; END IF;
 INSERT INTO public.evidence_players(snapshot_id,identity_key,source_player_id,name,country,mapping,stats) VALUES(sid,item->>'identity_key',item->>'source_player_id',item->>'name',item->>'country',item->'mapping',item->'stats');
 END LOOP;
 RETURN sid;
END $$;
REVOKE ALL ON FUNCTION public.import_evidence_bundle(jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.import_evidence_bundle(jsonb) TO authenticated;