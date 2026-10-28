ALTER TABLE public.rooms ADD COLUMN first_round_order uuid[], ADD COLUMN accelerated_order uuid[];
COMMENT ON COLUMN public.rooms.first_round_order IS 'Confirmed player IDs shuffled once at bidding start; NULL denotes legacy/unstarted room. Immutable through undo.';
COMMENT ON COLUMN public.rooms.accelerated_order IS 'Unsold player IDs shuffled once at accelerated-round entry; immutable through undo.';

CREATE OR REPLACE FUNCTION public._shuffle_player_ids(p_ids uuid[]) RETURNS uuid[]
LANGUAGE plpgsql VOLATILE STRICT SET search_path = public AS $$
DECLARE result uuid[] := p_ids; i integer; j integer; bytes bytea; draw bigint; cutoff bigint; tmp uuid;
BEGIN
  IF cardinality(result) < 2 THEN RETURN result; END IF;
  FOR i IN REVERSE cardinality(result)..2 LOOP
    -- Rejection sampling avoids modulo bias; Fisher-Yates has no role/rating keys.
    cutoff := (4294967296::bigint / i) * i;
    LOOP
      bytes := extensions.gen_random_bytes(4);
      draw := get_byte(bytes,0)::bigint * 16777216 + get_byte(bytes,1)::bigint * 65536 + get_byte(bytes,2)::bigint * 256 + get_byte(bytes,3)::bigint;
      EXIT WHEN draw < cutoff;
    END LOOP;
    j := (draw % i)::integer + 1;
    tmp := result[i]; result[i] := result[j]; result[j] := tmp;
  END LOOP;
  RETURN result;
END $$;
REVOKE ALL ON FUNCTION public._shuffle_player_ids(uuid[]) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public._freeze_auction_order() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE confirmed uuid[];
BEGIN
  -- The UPDATE already holds the room lock; tick serializes concurrent starts.
  IF OLD.status = 'review' AND NEW.status = 'auction' AND OLD.first_round_order IS NULL THEN
    SELECT array_agg(player_id ORDER BY id) INTO confirmed FROM public.room_players WHERE room_id = NEW.id;
    IF confirmed IS NULL THEN RAISE EXCEPTION 'Confirmed pool is empty'; END IF;
    NEW.first_round_order := public._shuffle_player_ids(confirmed);
    UPDATE public.room_players rp SET lot_order = seq.ordinality::integer
    FROM unnest(NEW.first_round_order) WITH ORDINALITY AS seq(player_id, ordinality)
    WHERE rp.room_id = NEW.id AND rp.player_id = seq.player_id;
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public._freeze_auction_order() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER freeze_confirmed_auction_order BEFORE UPDATE OF status ON public.rooms FOR EACH ROW EXECUTE FUNCTION public._freeze_auction_order();

CREATE OR REPLACE FUNCTION public._advance_lot(p_room uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.rooms; nxt uuid; unsold_ids uuid[];
BEGIN
  SELECT * INTO r FROM public.rooms WHERE id = p_room FOR UPDATE;
  SELECT id INTO nxt FROM public.room_players WHERE room_id = p_room AND status = 'pending' ORDER BY round, lot_order LIMIT 1;
  IF nxt IS NULL AND NOT r.accel_done AND EXISTS (SELECT 1 FROM public.room_players WHERE room_id = p_room AND status = 'unsold') THEN
    IF r.first_round_order IS NOT NULL THEN
      IF r.accelerated_order IS NULL THEN
        SELECT array_agg(player_id ORDER BY id) INTO unsold_ids FROM public.room_players WHERE room_id = p_room AND status = 'unsold';
        r.accelerated_order := public._shuffle_player_ids(unsold_ids);
        UPDATE public.rooms SET accelerated_order = r.accelerated_order WHERE id = p_room;
      END IF;
      UPDATE public.room_players rp SET status = 'pending', round = 2, lot_order = seq.ordinality::integer
      FROM unnest(r.accelerated_order) WITH ORDINALITY AS seq(player_id, ordinality)
      WHERE rp.room_id = p_room AND rp.player_id = seq.player_id AND rp.status = 'unsold';
    ELSE
      -- Already-running legacy rooms retain their original accelerated queue.
      UPDATE public.room_players SET status = 'pending', round = 2 WHERE room_id = p_room AND status = 'unsold';
    END IF;
    UPDATE public.rooms SET accel_done = true WHERE id = p_room;
    PERFORM public._log(p_room, 'info', 'Accelerated round: unsold players return');
    SELECT id INTO nxt FROM public.room_players WHERE room_id = p_room AND status = 'pending' ORDER BY round, lot_order LIMIT 1;
  END IF;
  IF nxt IS NULL THEN
    UPDATE public.rooms SET status = 'completed', current_rp = null, current_bid = null, current_bidder = null, lot_ends_at = null WHERE id = p_room;
    PERFORM public._log(p_room, 'info', 'Auction complete');
    RETURN;
  END IF;
  UPDATE public.room_players SET status = 'live' WHERE id = nxt;
  UPDATE public.rooms SET current_rp = nxt, current_bid = null, current_bidder = null,
    lot_ends_at = now() + make_interval(secs => coalesce((r.settings->>'bid_timer')::int, 20)) WHERE id = p_room;
END $$;