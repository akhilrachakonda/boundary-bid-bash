CREATE OR REPLACE FUNCTION public.room_projection(p_room uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.rooms; surprise boolean; pool jsonb; inputs public.room_evaluation_inputs;
BEGIN
 PERFORM public._me(p_room);
 SELECT * INTO r FROM public.rooms WHERE id=p_room;
 SELECT * INTO inputs FROM public.room_evaluation_inputs WHERE room_id=p_room;
 surprise:=coalesce((r.settings->>'surprise_reveal')::boolean,false);
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',rp.id,'player_id',rp.player_id,'set_name',rp.set_name,'lot_order',CASE WHEN surprise THEN 0 ELSE rp.lot_order END,'round',rp.round,'status',rp.status,'sold_to',rp.sold_to,'sold_price',rp.sold_price,'player',coalesce((SELECT fact FROM jsonb_array_elements(coalesce(inputs.player_facts,'[]'::jsonb)) fact WHERE fact->>'id'=p.id::text LIMIT 1),to_jsonb(p))) ORDER BY CASE WHEN surprise THEN 0 ELSE rp.round END,CASE WHEN surprise THEN 0 ELSE rp.lot_order END,rp.player_id),'[]'::jsonb) INTO pool FROM public.room_players rp JOIN public.players p ON p.id=rp.player_id WHERE rp.room_id=p_room;
 RETURN jsonb_build_object('room',(to_jsonb(r)-'first_round_order'-'accelerated_order')||jsonb_build_object('evaluation_snapshot',inputs.snapshot_id),'pool',pool);
END $$;
CREATE OR REPLACE FUNCTION public._immutable_snapshot() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$ BEGIN RAISE EXCEPTION 'Evidence snapshots and final results are immutable; import a new snapshot instead'; END $$;
CREATE TRIGGER immutable_snapshot BEFORE UPDATE OR DELETE ON public.evaluation_snapshots FOR EACH ROW EXECUTE FUNCTION public._immutable_snapshot();
CREATE TRIGGER immutable_evidence_player BEFORE UPDATE OR DELETE ON public.evidence_players FOR EACH ROW EXECUTE FUNCTION public._immutable_snapshot();
CREATE TRIGGER immutable_evidence_match BEFORE UPDATE OR DELETE ON public.evidence_matches FOR EACH ROW EXECUTE FUNCTION public._immutable_snapshot();
CREATE TRIGGER immutable_evidence_innings BEFORE UPDATE OR DELETE ON public.evidence_innings FOR EACH ROW EXECUTE FUNCTION public._immutable_snapshot();
CREATE TRIGGER immutable_room_inputs BEFORE UPDATE OR DELETE ON public.room_evaluation_inputs FOR EACH ROW EXECUTE FUNCTION public._immutable_snapshot();
CREATE TRIGGER immutable_final_result BEFORE UPDATE OR DELETE ON public.room_evaluations FOR EACH ROW EXECUTE FUNCTION public._immutable_snapshot();
REVOKE ALL ON FUNCTION public._immutable_snapshot() FROM PUBLIC,anon,authenticated;