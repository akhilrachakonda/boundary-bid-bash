CREATE FUNCTION public.save_lobby_settings(p_room uuid, p_expected jsonb, p_settings jsonb,
  p_previous_pool uuid[], p_pool uuid[]) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.rooms; existing uuid[];
BEGIN
  SELECT * INTO r FROM public.rooms WHERE id=p_room FOR UPDATE;
  IF auth.uid() IS NULL OR r.host_id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Only the host can edit settings'; END IF;
  IF r.status <> 'lobby' THEN RAISE EXCEPTION 'Room size and the player pool lock when review starts'; END IF;
  SELECT coalesce(array_agg(player_id ORDER BY player_id),'{}') INTO existing FROM public.room_players WHERE room_id=p_room;
  IF r.settings IS DISTINCT FROM p_expected OR existing IS DISTINCT FROM ARRAY(SELECT unnest(p_previous_pool) ORDER BY 1) THEN
    RAISE EXCEPTION 'The lobby changed. Reopen settings to use the latest room and pool.';
  END IF;
  PERFORM public.update_room_settings(p_room,p_settings);
  IF p_pool IS NOT NULL THEN PERFORM public.set_pool(p_room,p_pool); END IF;
  RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.save_lobby_settings(uuid,jsonb,jsonb,uuid[],uuid[]) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.save_lobby_settings(uuid,jsonb,jsonb,uuid[],uuid[]) TO authenticated;

-- Older clients send a separate counter acknowledgement. Keep it harmless until the reply commits.
ALTER FUNCTION public.respond_trade(uuid,text) RENAME TO _respond_trade_before_counter;
ALTER FUNCTION public.propose_trade(uuid,uuid,uuid[],uuid[],numeric,uuid) RENAME TO _insert_trade_proposal;
REVOKE ALL ON FUNCTION public._respond_trade_before_counter(uuid,text), public._insert_trade_proposal(uuid,uuid,uuid[],uuid[],numeric,uuid) FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.respond_trade(p_trade uuid,p_action text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF p_action='counter' THEN
    IF NOT EXISTS(SELECT FROM public.trades t JOIN public.participants p ON p.id=t.to_participant
      WHERE t.id=p_trade AND p.user_id=auth.uid() AND t.status IN ('pending','countered')) THEN RAISE EXCEPTION 'Counter unavailable'; END IF;
    RETURN;
  END IF;
  PERFORM public._respond_trade_before_counter(p_trade,p_action);
END $$;
CREATE FUNCTION public.propose_trade(p_room uuid,p_to uuid,p_offer uuid[],p_request uuid[],p_cash numeric,p_parent uuid DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE parent public.trades; reply public.trades; me public.participants; result uuid;
BEGIN
  IF p_parent IS NULL THEN RETURN public._insert_trade_proposal(p_room,p_to,p_offer,p_request,p_cash,NULL); END IF;
  PERFORM 1 FROM public.rooms WHERE id=p_room FOR UPDATE;
  me:=public._me(p_room);
  SELECT * INTO parent FROM public.trades WHERE id=p_parent AND room_id=p_room AND to_participant=me.id AND from_participant=p_to FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invalid counteroffer'; END IF;
  SELECT * INTO reply FROM public.trades WHERE parent_trade_id=p_parent ORDER BY created_at,id LIMIT 1;
  IF FOUND THEN
    IF reply.offer_players=coalesce(p_offer,'{}') AND reply.request_players=coalesce(p_request,'{}') AND reply.cash=coalesce(p_cash,0)
    THEN RETURN reply.id; END IF;
    RAISE EXCEPTION 'A different counteroffer already exists';
  END IF;
  IF parent.status NOT IN ('pending','countered') THEN RAISE EXCEPTION 'Offer is no longer pending'; END IF;
  result:=public._insert_trade_proposal(p_room,p_to,p_offer,p_request,p_cash,p_parent);
  IF parent.status='pending' THEN PERFORM public._respond_trade_before_counter(p_parent,'counter'); END IF;
  RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.respond_trade(uuid,text),public.propose_trade(uuid,uuid,uuid[],uuid[],numeric,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.respond_trade(uuid,text),public.propose_trade(uuid,uuid,uuid[],uuid[],numeric,uuid) TO authenticated;

-- Only new, opted-in rules change confirmation and ranking. Casual rooms retain short squad play.
CREATE FUNCTION public._competitive_lineup_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
  IF NEW.confirmed AND cardinality(NEW.batting_order)<>11 AND EXISTS (
    SELECT FROM public.rooms WHERE id=NEW.room_id AND settings->'competitive_xi'='true'::jsonb
  ) THEN RAISE EXCEPTION 'A competitive XI requires eleven players. Save a draft or reopen trading.'; END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public._competitive_lineup_guard() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER competitive_xi_confirmation BEFORE INSERT OR UPDATE ON public.community_lineups
FOR EACH ROW EXECUTE FUNCTION public._competitive_lineup_guard();

ALTER FUNCTION public.community_state(uuid) RENAME TO _community_state_before_eligibility;
REVOKE ALL ON FUNCTION public._community_state_before_eligibility(uuid) FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.community_state(p_room uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE snapshot jsonb; ranked jsonb;
BEGIN
  snapshot:=public._community_state_before_eligibility(p_room);
  IF snapshot->>'phase'='done' AND EXISTS(SELECT FROM public.rooms WHERE id=p_room AND settings->'competitive_xi'='true'::jsonb) THEN
    SELECT coalesce(jsonb_agg(
      CASE WHEN eligible THEN result || '{"eligible":true}'::jsonb ELSE result || '{"eligible":false,"overall":null}'::jsonb END
      ORDER BY eligible DESC, position),'[]') INTO ranked
    FROM (
      SELECT result,position,EXISTS(SELECT FROM public.community_lineups l
        WHERE l.room_id=p_room AND l.participant_id=(result->>'participant_id')::uuid
          AND l.confirmed AND cardinality(l.batting_order)=11) AS eligible
      FROM jsonb_array_elements(snapshot->'results') WITH ORDINALITY scores(result,position)
    ) eligibility;
    snapshot:=jsonb_set(snapshot,'{results}',ranked);
  END IF;
  RETURN snapshot;
END $$;
REVOKE ALL ON FUNCTION public.community_state(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.community_state(uuid) TO authenticated;

-- The same room-pinned player facts drive the host's pool checks and squad accounting.
DO $migration$
DECLARE src text; updated text;
BEGIN
  src:=pg_get_functiondef('public.set_pool(uuid,uuid[])'::regprocedure);
  updated:=replace(src,'public._is_spinner(p.sub_role)','public._is_spinner(public._catalogue_player_json(p_room,p.id)->>''sub_role'')');
  updated:=replace(updated,'public._is_pacer(p.role,p.sub_role)','public._is_pacer(p.role,public._catalogue_player_json(p_room,p.id)->>''sub_role'')');
  IF updated=src THEN RAISE EXCEPTION 'Unexpected pool definition'; END IF;
  EXECUTE updated;
  src:=pg_get_functiondef('public._squad_counts(uuid)'::regprocedure);
  updated:=replace(src,'p.sub_role','(public._catalogue_player_json(s.room_id,p.id)->>''sub_role'')');
  IF updated=src THEN RAISE EXCEPTION 'Unexpected squad definition'; END IF;
  EXECUTE updated;
  src:=pg_get_functiondef('public.create_catalogue_room(text,text,jsonb,text,text,text)'::regprocedure);
  updated:=replace(src,'''ipl-classics-2026-11-19'') ORDER BY','''ipl-classics-2026-11-19'',''ipl-reviewed-2026-11-21'') ORDER BY');
  IF updated=src THEN RAISE EXCEPTION 'Unexpected catalogue selector'; END IF;
  EXECUTE updated;
END $migration$;
