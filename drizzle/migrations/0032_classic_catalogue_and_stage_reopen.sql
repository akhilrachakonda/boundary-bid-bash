-- Prefer the extended catalogue only once its transactional import is complete.
DO $patch$
DECLARE d text;
BEGIN
 d:=pg_get_functiondef('public.create_catalogue_room(text,text,jsonb,text,text,text)'::regprocedure);
 IF strpos(d,'WHERE c.version=''crickauction-ddb56cc-2026-11-12'';')=0 THEN RAISE EXCEPTION 'Unexpected catalogue selector'; END IF;
 EXECUTE replace(d,'WHERE c.version=''crickauction-ddb56cc-2026-11-12'';',
  'WHERE c.version IN (''crickauction-ddb56cc-2026-11-12'',''ipl-classics-2026-11-19'') ORDER BY c.imported_on DESC LIMIT 1;');
 d:=pg_get_functiondef('public.set_pool(uuid,uuid[])'::regprocedure);
 IF strpos(d,'ELSE 273 END')=0 THEN RAISE EXCEPTION 'Unexpected pool limit'; END IF;
 EXECUTE replace(d,'ELSE 273 END','ELSE (SELECT player_count FROM public.player_catalogues WHERE version=r.catalogue_version) END');
 d:=pg_get_functiondef('public._release_settings_guard()'::regprocedure);
 IF strpos(d,'ELSE 273 END')=0 THEN RAISE EXCEPTION 'Unexpected settings limit'; END IF;
 EXECUTE replace(d,'ELSE 273 END','ELSE (SELECT player_count FROM public.player_catalogues WHERE version=NEW.catalogue_version) END');
END $patch$;

-- Use the guarded command ledger so replaying the same request never reopens a later round.
DO $patch$
DECLARE d text; marker constant text := 'IF p_action=''settings'' THEN';
BEGIN
 d:=pg_get_functiondef('public.auction_command(uuid,text,uuid,bigint,text,bigint,uuid,jsonb)'::regprocedure);
 IF strpos(d,marker)=0 THEN RAISE EXCEPTION 'Unexpected command dispatcher'; END IF;
 EXECUTE replace(d,marker,$actions$
 IF p_action IN ('reopen_unsold','reopen_trades','reopen_lineup') THEN
  IF NOT r.community_mode OR r.auction_stage<>'closed' OR
    (p_payload->>'phase') IS DISTINCT FROM r.post_phase THEN RAISE EXCEPTION 'Stage changed; refresh'; END IF;
  IF p_action='reopen_unsold' AND (r.status NOT IN ('trade','results') OR NOT EXISTS(
   SELECT FROM public.room_players WHERE room_id=p_room AND status='unsold'
  )) THEN RAISE EXCEPTION 'No unsold stage to reopen'; END IF;
  IF p_action='reopen_trades' AND r.status<>'results' THEN RAISE EXCEPTION 'Trading has not finished'; END IF;
  IF p_action='reopen_lineup' AND (r.status<>'results' OR coalesce(r.post_phase,'') NOT IN ('rating','done')) THEN RAISE EXCEPTION 'Playing XI selection has not finished'; END IF;
  DELETE FROM public.community_votes WHERE room_id=p_room;
  IF p_action='reopen_lineup' THEN
   UPDATE public.community_lineups SET confirmed=false WHERE room_id=p_room;
   UPDATE public.rooms SET post_phase='lineup',phase_ends_at=v_now+make_interval(mins=>coalesce((settings->>'lineup_minutes')::int,5)) WHERE id=p_room;
  ELSE
   DELETE FROM public.community_lineups WHERE room_id=p_room;
   UPDATE public.trades SET status='expired',resolved_at=v_now WHERE room_id=p_room AND status='pending';
   UPDATE public.rooms SET status=CASE WHEN p_action='reopen_unsold' THEN 'completed' ELSE 'trade' END,
    auction_stage=CASE WHEN p_action='reopen_unsold' THEN 'final_call' ELSE 'closed' END,
    post_phase=NULL,phase_ends_at=NULL,lot_version=lot_version+1,
    trade_ends_at=CASE WHEN p_action='reopen_trades' THEN v_now+make_interval(mins=>coalesce((settings->>'trade_minutes')::int,10)) END WHERE id=p_room;
  END IF;
  PERFORM public._log(p_room,'info',CASE p_action WHEN 'reopen_unsold' THEN 'Host reopened unsold nominations' WHEN 'reopen_trades' THEN 'Host reopened trading' ELSE 'Host reopened private Playing XI selection' END);
 ELSIF p_action='settings' THEN
$actions$);
 d:=pg_get_functiondef('public.room_projection(uuid)'::regprocedure);
 IF strpos(d,'''bounded_poll'',1')=0 THEN RAISE EXCEPTION 'Unexpected capability projection'; END IF;
 EXECUTE replace(d,'''bounded_poll'',1','''bounded_poll'',1,''stage_reopen'',1');
END $patch$;
