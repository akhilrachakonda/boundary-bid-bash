-- Catalogue additions may carry no legacy estimate (0) and an explicit Unrated tier.
ALTER TABLE public.players DROP CONSTRAINT players_rating_check;
ALTER TABLE public.players ADD CONSTRAINT players_rating_check CHECK (rating >= 0 AND rating <= 100);
ALTER TABLE public.players DROP CONSTRAINT players_tier_check;
ALTER TABLE public.players ADD CONSTRAINT players_tier_check CHECK (tier = ANY (ARRAY['Marquee','A','B','C','Uncapped','Unrated']));
COMMENT ON COLUMN public.players.rating IS 'DEPRECATED for new rooms: legacy setup estimate; 0 = none. Not used by random-80-20-v1 pool generation.';

CREATE TABLE public.pool_groups(
 snapshot_id uuid NOT NULL REFERENCES public.evaluation_snapshots(id),
 identity_key text NOT NULL,
 format text NOT NULL CHECK (format IN ('IPL','T20','ODI')),
 grp text NOT NULL CHECK (grp IN ('established','emerging','other','unknown')),
 rules_version text NOT NULL,
 basis jsonb NOT NULL DEFAULT '{}'::jsonb,
 PRIMARY KEY(snapshot_id,identity_key,format,rules_version)
);
GRANT SELECT ON public.pool_groups TO authenticated;
GRANT ALL ON public.pool_groups TO service_role;
ALTER TABLE public.pool_groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed-in players read pool groups" ON public.pool_groups FOR SELECT TO authenticated USING (true);

ALTER TABLE public.rooms ADD COLUMN pool_rules text;
ALTER TABLE public.rooms ADD COLUMN pool_generation jsonb;
CREATE OR REPLACE FUNCTION public._new_room_pool_rules() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$ BEGIN NEW.pool_rules:='random-80-20-v1'; NEW.pool_generation:=NULL; RETURN NEW; END $$;
CREATE TRIGGER new_room_pool_rules BEFORE INSERT ON public.rooms FOR EACH ROW EXECUTE FUNCTION public._new_room_pool_rules();
REVOKE EXECUTE ON FUNCTION public._new_room_pool_rules() FROM PUBLIC,anon,authenticated;

-- set_pool: rooms on random-80-20-v1 accept pools only from generate_pool; bound raised to 200.
DO $$ DECLARE d text; o text; BEGIN
 d:=pg_get_functiondef('public.set_pool(uuid,uuid[])'::regprocedure); o:=d;
 d:=replace(d,'IF cardinality(p_player_ids)>150 THEN RAISE EXCEPTION ''Pool out of bounds''; END IF;','IF r.pool_rules IS NOT NULL AND coalesce(current_setting(''cricket.pool_generator'',true),'''')<>''on'' THEN RAISE EXCEPTION ''This room uses the random 80/20 pool generator''; END IF; IF cardinality(p_player_ids)>200 THEN RAISE EXCEPTION ''Pool out of bounds''; END IF;');
 IF d=o THEN RAISE EXCEPTION 'set_pool prerequisite not found'; END IF;
 EXECUTE d;
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
 SELECT id INTO sid FROM public.evaluation_snapshots WHERE status='validated' ORDER BY imported_at DESC,id LIMIT 1;
 em_need:=round(p_size*0.2)::int; est_need:=p_size-em_need;
 CREATE TEMP TABLE IF NOT EXISTS _pool_cand(id uuid PRIMARY KEY, grp text, role text, spin boolean, pace boolean, indian boolean, picked boolean) ON COMMIT DROP;
 TRUNCATE _pool_cand;
 INSERT INTO _pool_cand SELECT p.id,g.grp,p.role,public._is_spinner(p.sub_role),public._is_pacer(p.role,p.sub_role),p.nationality_type='Indian',false
  FROM public.players p JOIN public.pool_groups g ON g.snapshot_id=sid AND g.rules_version='pool-groups-1' AND g.format=p.format AND g.identity_key=p.name||'|'||p.country
  WHERE p.format=r.format AND g.grp IN ('established','emerging');
 SELECT count(*) FILTER (WHERE grp='established'),count(*) FILTER (WHERE grp='emerging') INTO est_cap,em_cap FROM _pool_cand;
 IF est_cap<est_need OR em_cap<em_need THEN
  RAISE EXCEPTION 'Not enough classified players for % (% established + % emerging needed; % established and % emerging available). Largest exact 80/20 pool: %.',
   p_size,est_need,em_need,est_cap,em_cap,(SELECT coalesce(max(k),0) FROM generate_series(1,200) k WHERE k-round(k*0.2)::int<=est_cap AND round(k*0.2)::int<=em_cap);
 END IF;
 seed:=((('x'||substr(md5(gen_random_uuid()::text),1,8))::bit(32)::bigint)::double precision/4294967295.0)*2-1;
 PERFORM setseed(seed);
 FOR attempt IN 1..40 LOOP
  UPDATE _pool_cand SET picked=false; est_left:=est_need; em_left:=em_need; ok:=true;
  -- Constraint-first sampling: each pick chosen uniformly among eligible candidates with remaining group quota.
  FOR c IN SELECT * FROM (VALUES ('WK',teams*coalesce((s->>'min_wk')::int,0)),('BAT',teams*coalesce((s->>'min_bat')::int,0)),('AR',teams*coalesce((s->>'min_ar')::int,0)),('BOWL',teams*coalesce((s->>'min_bowl')::int,0)),('spin',teams*coalesce((s->>'min_spinners')::int,0)),('pace',teams*coalesce((s->>'min_pacers')::int,0)),('indian',teams*greatest(0,(s->>'min_squad')::int-(s->>'max_overseas')::int))) v(k,need) ORDER BY random() LOOP
   LOOP
    EXIT WHEN (SELECT count(*) FROM _pool_cand WHERE picked AND CASE c.k WHEN 'spin' THEN spin WHEN 'pace' THEN pace WHEN 'indian' THEN indian ELSE role=c.k END)>=c.need;
    SELECT id,grp INTO pick FROM _pool_cand WHERE NOT picked AND CASE c.k WHEN 'spin' THEN spin WHEN 'pace' THEN pace WHEN 'indian' THEN indian ELSE role=c.k END
      AND ((grp='established' AND est_left>0) OR (grp='emerging' AND em_left>0)) ORDER BY random() LIMIT 1;
    IF NOT FOUND THEN ok:=false; EXIT; END IF;
    UPDATE _pool_cand SET picked=true WHERE id=pick.id;
    IF pick.grp='established' THEN est_left:=est_left-1; ELSE em_left:=em_left-1; END IF;
   END LOOP;
   EXIT WHEN NOT ok;
  END LOOP;
  IF ok THEN
   UPDATE _pool_cand SET picked=true WHERE id IN (SELECT id FROM _pool_cand WHERE NOT picked AND grp='established' ORDER BY random() LIMIT est_left);
   UPDATE _pool_cand SET picked=true WHERE id IN (SELECT id FROM _pool_cand WHERE NOT picked AND grp='emerging' ORDER BY random() LIMIT em_left);
   EXIT;
  END IF;
 END LOOP;
 PERFORM setseed(((('x'||substr(md5(gen_random_uuid()::text),1,8))::bit(32)::bigint)::double precision/4294967295.0)*2-1);
 IF NOT ok THEN RAISE EXCEPTION 'No % player pool meets the squad minimums for % teams with an exact 80/20 mix. Lower role minimums, teams or pool size.',p_size,teams; END IF;
 SELECT array_agg(id ORDER BY id) INTO ids FROM _pool_cand WHERE picked;
 PERFORM set_config('cricket.pool_generator','on',true);
 n:=public.set_pool(p_room,ids);
 PERFORM set_config('cricket.pool_generator','off',true);
 result:=jsonb_build_object('rules','random-80-20-v1','group_rules','pool-groups-1','snapshot_id',sid,'seed',seed,'size',n,
  'established',(SELECT count(*) FROM _pool_cand WHERE picked AND grp='established'),'emerging',(SELECT count(*) FROM _pool_cand WHERE picked AND grp='emerging'),
  'capacity',jsonb_build_object('established',est_cap,'emerging',em_cap),'groups',(SELECT jsonb_object_agg(id,grp) FROM _pool_cand WHERE picked),'generated_at',now());
 UPDATE public.rooms SET pool_generation=result WHERE id=p_room;
 RETURN result-'groups';
END $$;
REVOKE EXECUTE ON FUNCTION public.generate_pool(uuid,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.generate_pool(uuid,integer) TO authenticated;