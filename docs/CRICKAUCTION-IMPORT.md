# IPL catalogue and auction response update

Source is [Shaurya01836/ipl-auction](https://github.com/Shaurya01836/ipl-auction) at commit `ddb56cc8282cbb997cc8c93ae24c7d8328b9bf1c`, imported on 12 November 2026.

The Apache-2.0 source roster contains 273 identities. 165 match existing IPL player identities, including 10 explicitly mapped name aliases. 108 require new records. Existing rows retain their IDs and fields. Each new IPL room pins the imported catalogue, prices, portraits and source stats. Review freezes those facts in the existing evaluation snapshot. T20 and ODI use the original catalogue.

The upstream file supplies matches, runs, wickets, average, strike rate, economy and best scores as available. It supplies no per-player statistical cutoff. Display names the source and import date. Eleven new records have only an unspecified overseas country. Existing game role/subrole metadata is retained for matched players. New records use source roles, explicit fast/spin set classifications where present, and generic roles otherwise. Batting and bowling styles absent from the source stay unknown. The game keeps its existing V2.1 evaluation and custom squad rules.

Audio files under `public/audio/crickauction/` are copied unmodified from the same repository. Team-name matching selects the ten franchise clips, custom team names use the existing hammer, and unsold events use the upstream clip. The existing sound preference controls all playback. One bounded playback slot avoids overlapping celebrations and stops on mute or navigation.

The source license is distributed at `/licenses/crickauction-Apache-2.0.txt`. Player portraits remain links to the original image providers. Original data is retained in `src/data/crickauction/players.json`; the mapping and content hash are in the adjacent manifest and import files. Integration code is new.

## Installation and verification

Migration history 0021–0025 is restored from the already-deployed pre-revert commit so fresh setups reproduce the live schema. Migration 0026 records the previously applied legacy restoration. Migration 0027 adds immutable catalogues and action sync endpoints. Apply only unapplied migrations through the managed journal. The roster import is separate data and can safely be retried using `scripts/crickauction-import.sql` after 0027. Its hash rejects conflicting contents for the same version.

`prepare-crickauction-import.mjs` accepts an exported existing player list as its first argument and produces the import. The existing public player records must be checked before regenerating mappings. New rooms use `create_catalogue_room`; existing clients calling `create_room` continue the legacy path.

`place_bid_and_sync` and `auction_command_and_sync` call the established validation functions and return authoritative state in the same response. The client applies that response immediately, with revision and room checks. Realtime notifications reconcile other clients. No migration to Firebase is needed for this change. Network speed still depends on the database region and users' connections.

The build, TypeScript check and test suite are run before release. The isolated `test-catalogue-local.mjs` harness uses PGlite PostgreSQL with pgcrypto, applies the full migration chain, confirms generated pools, tests full 273-player selection, validates prices and stats snapshots, retries a bid, rejects nonmembers/nonhosts and checks previous rooms. Run it with Node 24 and the path to a separately installed PGlite `dist/index.js`.

On 12 November 2026, migrations 0026 and 0027 and the data import were applied in one transaction and recorded in the production migration journal. Verification found 273 catalogue entries with stats, 108 added player identities, and all 600 previous player rows unchanged. No existing room was assigned the new catalogue. The source hash is recorded in the manifest and the database. The unit suite passed 77 tests, and the isolated PostgreSQL checks passed. Browser-level layout and audio playback could not be verified because Chromium could not start in the execution environment.
