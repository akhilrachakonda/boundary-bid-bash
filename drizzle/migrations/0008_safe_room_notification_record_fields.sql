CREATE OR REPLACE FUNCTION public._notify_room_update() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE rid uuid;
BEGIN
 IF TG_TABLE_NAME='rooms' THEN rid:=NEW.id;
 ELSIF TG_OP='DELETE' THEN rid:=OLD.room_id;
 ELSE rid:=NEW.room_id; END IF;
 IF EXISTS(SELECT 1 FROM public.rooms WHERE id=rid) THEN
 INSERT INTO public.room_updates(room_id,revision) VALUES(rid,1) ON CONFLICT(room_id) DO UPDATE SET revision=room_updates.revision+1;
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END $$;