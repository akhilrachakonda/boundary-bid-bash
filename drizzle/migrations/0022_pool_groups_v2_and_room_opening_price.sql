ALTER TABLE public.pool_groups DROP CONSTRAINT pool_groups_grp_check;
ALTER TABLE public.pool_groups ADD CONSTRAINT pool_groups_grp_check CHECK (grp IN ('established','emerging','other','unknown','performance'));

-- Room-configured common opening price, frozen at review start for random-80-20 rooms only.
ALTER TABLE public.rooms ADD COLUMN opening_price numeric;
CREATE OR REPLACE FUNCTION public._freeze_opening_price() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF OLD.status='lobby' AND NEW.status='review' AND NEW.pool_rules IS NOT NULL THEN
  NEW.opening_price:=coalesce((NEW.settings->>'min_base')::numeric,0.2);
 END IF; RETURN NEW;
END $$;
CREATE TRIGGER aa_freeze_opening_price BEFORE UPDATE OF status ON public.rooms FOR EACH ROW EXECUTE FUNCTION public._freeze_opening_price();
REVOKE EXECUTE ON FUNCTION public._freeze_opening_price() FROM PUBLIC,anon,authenticated;

DO $$ DECLARE d text; o text; BEGIN
 d:=pg_get_functiondef('public.place_bid(uuid,numeric)'::regprocedure); o:=d;
 d:=replace(d,'nxt := public.next_bid_amount(s, r.current_bid, pl.base_price);','nxt := public.next_bid_amount(s, r.current_bid, coalesce(r.opening_price, pl.base_price));');
 IF d=o THEN RAISE EXCEPTION 'place_bid prerequisite not found'; END IF; EXECUTE d;
 d:=pg_get_functiondef('public._repair_eligible(uuid,uuid,uuid)'::regprocedure); o:=d;
 d:=replace(d,'p.base_price<=public._max_bid(','coalesce(r.opening_price,p.base_price)<=public._max_bid(');
 IF d=o THEN RAISE EXCEPTION '_repair_eligible prerequisite not found'; END IF; EXECUTE d;
 -- Frozen player facts expose the room opening price so every client shows the same price.
 d:=pg_get_functiondef('public._freeze_evaluation_inputs()'::regprocedure); o:=d;
 d:=replace(d,'SELECT jsonb_agg(to_jsonb(p)||CASE','SELECT jsonb_agg(to_jsonb(p)||CASE WHEN NEW.opening_price IS NOT NULL THEN jsonb_build_object(''base_price'',NEW.opening_price,''catalogue_base_price'',p.base_price) ELSE ''{}''::jsonb END||CASE');
 IF d=o THEN RAISE EXCEPTION '_freeze_evaluation_inputs prerequisite not found'; END IF; EXECUTE d;
END $$;

CREATE OR REPLACE FUNCTION public.generate_pool(p_room uuid, p_size integer) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.rooms; s jsonb; sid uuid; teams int; em_need int; est_need int; est_left int; em_left int;
 est_cap int; em_cap int; seed double precision; attempt int; ok boolean; pick record; ids uuid[]; n int; c record; result jsonb;
BEGIN
 SELECT * INTO r FROM public.rooms WHERE id=p_room FOR UPDATE;
 IF auth.uid() IS NULL OR r.host_id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Only the host can generate the pool'; END IF;
 IF r.status<>'lobby' THEN RAISE EXCEPTION 'Pool is locked'; END IF;
 IF r.pool_rules IS DISTINCT FROM 'random-80-20-v1' THEN RAISE EXCEPTION 'This room uses the original pool builder'; END IF;
 IF p_size IS NULL OR p_size<2 OR p_size>200 THEN RAISE EXCEPTION 'Pool size must be between 2 and 200'; END IF;
 IF NOT public._release_limit('generate_pool',30,600) THEN RAISE EXCEPTION 'Too many pool generations; wait a few minutes'; END IF;
 s:=r.settings; teams:=(s->>'max_teams')::int;
 IF p_size<teams*(s->>'min_squad')::int THEN RAISE EXCEPTION 'Pool needs at least % players (% teams x % minimum squad)',teams*(s->>'min_squad')::int,teams,s->>'min_squad'; END IF;
 SELECT g.snapshot_id INTO sid FROM public.pool_groups g JOIN public.evaluation_snapshots e ON e.id=g.snapshot_id WHERE e.status='validated' AND g.rules_version='pool-groups-2' ORDER BY e.imported_at DESC,e.id LIMIT 1;
 IF sid IS NULL THEN RAISE EXCEPTION 'No player groups are available yet'; END IF;
 em_need:=round(p_size*0.2)::int; est_need:=p_size-em_need;
 CREATE TEMP TABLE IF NOT EXISTS _pool_cand(id uuid PRIMARY KEY, grp text, role text, spin boolean, pace boolean, indian boolean, picked boolean) ON COMMIT DROP;
 TRUNCATE _pool_cand;
 INSERT INTO _pool_cand SELECT p.id,g.grp,p.role,public._is_spinner(p.sub_role),public._is_pacer(p.role,p.sub_role),p.nationality_type='Indian',false
  FROM public.players p JOIN public.pool_groups g ON g.snapshot_id=sid AND g.rules_version='pool-groups-2' AND g.format=p.format AND g.identity_key=p.name||'|'||p.country
  WHERE p.format=r.format AND g.grp IN ('performance','emerging');
 SELECT count(*) FILTER (WHERE grp='performance'),count(*) FILTER (WHERE grp='emerging') INTO est_cap,em_cap FROM _pool_cand;
 IF est_cap<est_need OR em_cap<em_need THEN
  RAISE EXCEPTION 'Not enough players for % (% performance pool + % emerging needed; % and % available). Largest exact 80/20 pool: %.',
   p_size,est_need,em_need,est_cap,em_cap,(SELECT coalesce(max(k),0) FROM generate_series(1,200) k WHERE k-round(k*0.2)::int<=est_cap AND round(k*0.2)::int<=em_cap);
 END IF;
 seed:=((('x'||substr(md5(gen_random_uuid()::text),1,8))::bit(32)::bigint)::double precision/4294967295.0)*2-1;
 PERFORM setseed(seed);
 FOR attempt IN 1..40 LOOP
  UPDATE _pool_cand SET picked=false; est_left:=est_need; em_left:=em_need; ok:=true;
  FOR c IN SELECT * FROM (VALUES ('WK',teams*coalesce((s->>'min_wk')::int,0)),('BAT',teams*coalesce((s->>'min_bat')::int,0)),('AR',teams*coalesce((s->>'min_ar')::int,0)),('BOWL',teams*coalesce((s->>'min_bowl')::int,0)),('spin',teams*coalesce((s->>'min_spinners')::int,0)),('pace',teams*coalesce((s->>'min_pacers')::int,0)),('indian',teams*greatest(0,(s->>'min_squad')::int-(s->>'max_overseas')::int))) v(k,need) ORDER BY random() LOOP
   LOOP
    EXIT WHEN (SELECT count(*) FROM _pool_cand WHERE picked AND CASE c.k WHEN 'spin' THEN spin WHEN 'pace' THEN pace WHEN 'indian' THEN indian ELSE role=c.k END)>=c.need;
    SELECT id,grp INTO pick FROM _pool_cand WHERE NOT picked AND CASE c.k WHEN 'spin' THEN spin WHEN 'pace' THEN pace WHEN 'indian' THEN indian ELSE role=c.k END
      AND ((grp='performance' AND est_left>0) OR (grp='emerging' AND em_left>0)) ORDER BY random() LIMIT 1;
    IF NOT FOUND THEN ok:=false; EXIT; END IF;
    UPDATE _pool_cand SET picked=true WHERE id=pick.id;
    IF pick.grp='performance' THEN est_left:=est_left-1; ELSE em_left:=em_left-1; END IF;
   END LOOP;
   EXIT WHEN NOT ok;
  END LOOP;
  IF ok THEN
   UPDATE _pool_cand SET picked=true WHERE id IN (SELECT id FROM _pool_cand WHERE NOT picked AND grp='performance' ORDER BY random() LIMIT est_left);
   UPDATE _pool_cand SET picked=true WHERE id IN (SELECT id FROM _pool_cand WHERE NOT picked AND grp='emerging' ORDER BY random() LIMIT em_left);
   EXIT;
  END IF;
 END LOOP;
 PERFORM setseed(((('x'||substr(md5(gen_random_uuid()::text),1,8))::bit(32)::bigint)::double precision/4294967295.0)*2-1);
 IF NOT ok THEN RAISE EXCEPTION 'No % player pool meets the squad minimums for % teams with an exact 80/20 mix.',p_size,teams; END IF;
 SELECT array_agg(id ORDER BY id) INTO ids FROM _pool_cand WHERE picked;
 PERFORM set_config('cricket.pool_generator','on',true);
 n:=public.set_pool(p_room,ids);
 PERFORM set_config('cricket.pool_generator','off',true);
 result:=jsonb_build_object('rules','random-80-20-v1','group_rules','pool-groups-2','snapshot_id',sid,'seed',seed,'size',n,
  'established',(SELECT count(*) FROM _pool_cand WHERE picked AND grp='performance'),'emerging',(SELECT count(*) FROM _pool_cand WHERE picked AND grp='emerging'),
  'capacity',jsonb_build_object('established',est_cap,'emerging',em_cap),'groups',(SELECT jsonb_object_agg(id,grp) FROM _pool_cand WHERE picked),'generated_at',now());
 UPDATE public.rooms SET pool_generation=result WHERE id=p_room;
 RETURN result-'groups';
END $$;
REVOKE EXECUTE ON FUNCTION public.generate_pool(uuid,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.generate_pool(uuid,integer) TO authenticated;