-- Production installation verification found inherited default ACLs on 0018 objects.
-- Preserve member-only nomination reads and SECURITY DEFINER mutation authority.
REVOKE ALL ON TABLE public.auction_nominations, public.auction_commands FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.auction_nominations TO authenticated;
GRANT ALL ON TABLE public.auction_nominations, public.auction_commands TO service_role;
-- Callers must never advance/reset the authoritative accepted-bid sequence.
REVOKE ALL ON SEQUENCE public.bid_acceptance_order FROM PUBLIC, anon, authenticated;
GRANT ALL ON SEQUENCE public.bid_acceptance_order TO service_role;
DO $$
BEGIN
 IF has_table_privilege('anon','public.auction_nominations','SELECT,INSERT,UPDATE,DELETE')
 OR has_table_privilege('authenticated','public.auction_nominations','INSERT,UPDATE,DELETE')
 OR NOT has_table_privilege('authenticated','public.auction_nominations','SELECT')
 OR has_table_privilege('anon','public.auction_commands','SELECT,INSERT,UPDATE,DELETE')
 OR has_table_privilege('authenticated','public.auction_commands','SELECT,INSERT,UPDATE,DELETE')
 OR has_sequence_privilege('anon','public.bid_acceptance_order','USAGE,SELECT,UPDATE')
 OR has_sequence_privilege('authenticated','public.bid_acceptance_order','USAGE,SELECT,UPDATE')
 THEN RAISE EXCEPTION 'Post-launch object privilege verification failed'; END IF;
 IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid='public.auction_nominations'::regclass)
 OR NOT (SELECT relrowsecurity FROM pg_class WHERE oid='public.auction_commands'::regclass)
 THEN RAISE EXCEPTION 'Post-launch RLS verification failed'; END IF;
END $$;