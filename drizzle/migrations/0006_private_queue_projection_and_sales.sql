CREATE TABLE public.room_updates (room_id uuid PRIMARY KEY REFERENCES public.rooms(id) ON DELETE CASCADE, revision bigint NOT NULL DEFAULT 1);
GRANT SELECT ON public.room_updates TO authenticated;
GRANT ALL ON public.room_updates TO service_role;
ALTER TABLE public.room_updates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read safe room updates" ON public.room_updates FOR SELECT TO authenticated USING(public.is_room_member(room_id));
ALTER PUBLICATION supabase_realtime ADD TABLE public.room_updates, public.sales;
ALTER PUBLICATION supabase_realtime DROP TABLE public.rooms, public.room_players;
REVOKE SELECT ON public.rooms, public.room_players FROM authenticated, anon;

CREATE OR REPLACE FUNCTION public._notify_room_update() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE rid uuid;
BEGIN
 rid := CASE WHEN TG_TABLE_NAME='rooms' THEN coalesce(NEW.id,OLD.id) ELSE coalesce(NEW.room_id,OLD.room_id) END;
 IF EXISTS(SELECT 1 FROM public.rooms WHERE id=rid) THEN
 INSERT INTO public.room_updates(room_id,revision) VALUES(rid,1) ON CONFLICT(room_id) DO UPDATE SET revision=room_updates.revision+1;
 END IF;
 RETURN coalesce(NEW,OLD);
END $$;
REVOKE ALL ON FUNCTION public._notify_room_update() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER safe_room_update AFTER INSERT OR UPDATE ON public.rooms FOR EACH ROW EXECUTE FUNCTION public._notify_room_update();
CREATE TRIGGER safe_pool_update AFTER INSERT OR UPDATE OR DELETE ON public.room_players FOR EACH ROW EXECUTE FUNCTION public._notify_room_update();

CREATE OR REPLACE FUNCTION public.room_projection(p_room uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.rooms; surprise boolean; pool jsonb;
BEGIN
 PERFORM public._me(p_room);
 SELECT * INTO r FROM public.rooms WHERE id=p_room;
 surprise:=coalesce((r.settings->>'surprise_reveal')::boolean,false);
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',rp.id,'player_id',rp.player_id,'set_name',rp.set_name,'lot_order',CASE WHEN surprise THEN 0 ELSE rp.lot_order END,'round',rp.round,'status',rp.status,'sold_to',rp.sold_to,'sold_price',rp.sold_price,'player',to_jsonb(p)) ORDER BY CASE WHEN surprise THEN 0 ELSE rp.round END,CASE WHEN surprise THEN 0 ELSE rp.lot_order END,rp.player_id),'[]'::jsonb) INTO pool FROM public.room_players rp JOIN public.players p ON p.id=rp.player_id WHERE rp.room_id=p_room;
 RETURN jsonb_build_object('room',to_jsonb(r)-'first_round_order'-'accelerated_order','pool',pool);
END $$;
REVOKE ALL ON FUNCTION public.room_projection(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.room_projection(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.my_rooms() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',r.id,'code',r.code,'name',r.name,'format',r.format,'status',r.status,'created_at',r.created_at) ORDER BY r.created_at DESC),'[]'::jsonb) FROM public.rooms r JOIN public.participants p ON p.room_id=r.id WHERE p.user_id=auth.uid();
$$;
REVOKE ALL ON FUNCTION public.my_rooms() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.my_rooms() TO authenticated;

CREATE OR REPLACE FUNCTION public._new_room_surprise() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN NEW.settings:=jsonb_build_object('surprise_reveal',true)||NEW.settings; RETURN NEW; END $$;
CREATE TRIGGER new_room_surprise BEFORE INSERT ON public.rooms FOR EACH ROW EXECUTE FUNCTION public._new_room_surprise();
REVOKE ALL ON FUNCTION public._new_room_surprise() FROM PUBLIC,anon,authenticated;