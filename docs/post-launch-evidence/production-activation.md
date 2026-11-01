# Production activation evidence — 2026-11-01

Scope: read-only catalog/data verification plus authorized DDL installation. No production gameplay calls or fixtures. Source initially4603d80b9bda008213b79cead525d5a211ebbc99, clean. Database installed by supported migration tool on the project's Lovable Database.

## Registration and integrity

Commands:
```
git log -1 --format='%H %s'
git status --short
sha256sum scripts/staged/0018_post_launch_auction_controls.sql drizzle/migrations/0018_post_launch_auction_controls.sql
diff -u scripts/staged/0018_post_launch_auction_controls.sql drizzle/migrations/0018_post_launch_auction_controls.sql
```
Result: final newline only; SQL content identical. Registered0018 hash24192f69f14b032d320138eca3dab8975949a05beb531b5c1e99b1a8474cbc99; staged hash42424464ee04ce83ef5cb4324c68716cac3af25cdb963bb56e06af2d48fa3cdb.

```sql
SELECT id,hash,created_at FROM drizzle.__drizzle_migrations ORDER BY created_at DESC LIMIT 2;
```
Result: ID19,0018,timestamp1793559637679; ID20,0019,timestamp1793559709388,hash861c215b60eca26e6553b4ab120543b6782c1fdface83ccf892e376dc83446a5. Before installation all18 existing entries matched the managed journal; after installation20 entries. No earlier migration replay.

## Dynamic replacement prerequisites

```sql
SELECT signature,needle,(length(definition)-length(replace(definition,needle,'')))/length(needle) AS occurrence_count
FROM (VALUES
 ('public.place_bid(uuid,numeric)','values (p_room, rp.id, me.id, nxt);'),
 ('public.place_bid(uuid,numeric,uuid,bigint,uuid)','WHERE id=(SELECT id FROM public.bids WHERE participant_id=me.id AND room_player_id=p_lot ORDER BY created_at DESC,id DESC LIMIT 1)'),
 ('public.host_control(uuid,text,bigint,text,uuid)','PERFORM public.host_control(p_room,p_action);'),
 ('public.open_trades(uuid,integer)','if r.status <> ''completed'''),
 ('public._resolve_lot(uuid,boolean)','where id = p_room;'),
 ('public._resolve_lot(uuid,boolean)','if r.current_rp is null then return; end if;'),
 ('public._advance_lot(uuid)','public._advance_lot('),
 ('public.room_projection(uuid)','public.room_projection(')
) v(signature,needle)
CROSS JOIN LATERAL (SELECT pg_get_functiondef(signature::regprocedure) AS definition) d;
```
PASS: eight replacements each exactly1. Preexisting0018 columns/tables/sequence/helper functions absent. Trigger `release_lot_version` existed/enabled, before alphabetically ordered `zz_repair_session`. Actual installed definitions inspected with `pg_get_functiondef`: retry attachment uses exact accepted_order, bid time uses clock_timestamp, bound host blocks repair legacy control, open_trades requires guarded summary, resolver locks and requires live lot. Copies normalize back to original MD5s: advancementde8d5e568f41698864ff099bd57526b0; projection21f6d72212005baa1a40a0aff49106db. Legacy internal host MD5f7baa4efb23669142b8727ee4a858d0a unchanged.

## Record preservation

Read-only aggregate fingerprints used `md5(coalesce(string_agg(to_jsonb(t)::text,'|' ORDER BY id),''))`. After installation rooms subtract only new keys `repair_flow,auction_stage,auction_round,control_revision,next_lot_settings,bid_session,bid_revision`; bids subtract only `undone,lot_session,accepted_order`. Other tables use unchanged complete row JSON. No names, credentials, notes or account data are emitted.

| Data | Before/after count | Matching fingerprint |
|---|---:|---|
| Rooms |40|9f88b45a74eaea1a4899c9b9f6958490|
| Participants/purses |87|74b298a62123a4e5ab02a5ff2f8e92b9|
| Bids |3425|5682b8ae59793235de9f455069f3aad8|
| Holdings |240|dcda3210d524bedcae50dc8b7f30b798|
| Sales |403|6d1014c4202d767de147cd2212d7108c|
| Private notes |6|5ea2c866bb667ed93badadeaf9da74ee|

```sql
SELECT count(*) AS rooms,count(*) FILTER(WHERE repair_flow) AS repaired,
 count(*) FILTER(WHERE NOT repair_flow AND auction_stage='round' AND auction_round=1
 AND control_revision=0 AND next_lot_settings='{}'::jsonb AND bid_session=0 AND bid_revision=0) AS historical_defaults FROM public.rooms;
SELECT count(*) AS historical_bids,count(*) FILTER(WHERE NOT undone AND lot_session=0 AND accepted_order IS NULL) AS unchanged_defaults FROM public.bids;
```
PASS:40/0/40 rooms;3425/3425 bids. Enabled insert trigger only sets NEW.repair_flow=true; default remains false. No data backfill/gameplay mutations/seeds.

## Access verification and necessary fix

```sql
SELECT c.relname,c.relrowsecurity,
 has_table_privilege('anon',c.oid,'SELECT,INSERT,UPDATE,DELETE') AS anon_access,
 has_table_privilege('authenticated',c.oid,'SELECT') AS member_select,
 has_table_privilege('authenticated',c.oid,'INSERT,UPDATE,DELETE') AS member_write,
 has_table_privilege('service_role',c.oid,'SELECT,INSERT,UPDATE,DELETE') AS service_access
FROM pg_class c WHERE c.oid IN ('public.auction_nominations'::regclass,'public.auction_commands'::regclass);
SELECT has_sequence_privilege('anon','public.bid_acceptance_order','USAGE,SELECT,UPDATE') AS anon_access,
 has_sequence_privilege('authenticated','public.bid_acceptance_order','USAGE,SELECT,UPDATE') AS member_access,
 has_sequence_privilege('service_role','public.bid_acceptance_order','USAGE,SELECT,UPDATE') AS service_access;
SELECT tablename,policyname,roles,cmd,qual,with_check FROM pg_policies
 WHERE schemaname='public' AND tablename IN ('auction_nominations','auction_commands');
```
Initial verification FAILED narrow privilege intent: actual default ACLs granted anon/member all table rights and sequence UPDATE. RLS still denied direct table mutation, but sequence manipulation needed revocation.0019 fixes only those new objects; in-transaction assertions fail closed on ACL/RLS mismatch. Final PASS: both RLS=true; anon=false; member nominations SELECT=true, commands SELECT=false, all member write=false; service=true. Sequence anon/member=false, service=true. Only nomination policy is authenticated SELECT/is_room_member; commands has no caller policy.

Function inspection: public auction_command8 args, nominate_unsold4 args, room_live_projection1 arg signatures present. Authenticated EXECUTE=true, anon=false; internal helpers both=false. All SECURITY DEFINER search_path=public. Ownership/membership checks, idempotent command retry before stale checks, observed lot/status/control/bid revision, next-lot-only1–120s timers, current-session latest-bid undo, nomination affordability and exact closure summary are present. Projections require membership, redact future arrays/ordinals, capability auction_controls=1. Historical fallback retained.

## Verification boundaries

Build/typecheck automatic log: build OK19:01:53Z. No gameplay client edits;69 unit/7 importer/75 isolated ten-browser prior checks not repeated. No production load or central gameplay test performed by design. Publication pending user deployment connector. Existing exhaustive race matrix, real-device timing, neutral leadership/incomplete evidence and portrait clearance limitations remain from the unified report. No complete production clearance claim.