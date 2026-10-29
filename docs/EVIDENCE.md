# Cricket Auction evidence V2

Data is Cricsheet JSON + Register under ODC-By 1.0 (see CRICSHEET-LICENSE.txt). Source match data coverage is incomplete and Afghanistan-involving matches are withheld. Photos are separately licensed.

## Reproducible refresh
1. Download `ipl_male_json.zip`, `t20s_male_json.zip`, `odis_male_json.zip` from https://cricsheet.org/downloads/ into a temporary directory. Keep raw archives and source notices offline for audit/reimport. Do not commit downloaded archives.
2. Keep stable identity mappings in `src/data/cricsheet-crosswalk.json`; review new aliases against the register and country/team history. Six identities have country-evidence limitations recorded. Uncertain matches must stay unmatched.
3. Export current catalogue name/country/role metadata to `catalogue.json`, keyed `name|country`, in the data directory. This is needed for same-role cohort rates.
4. Run `python3 scripts/import-cricsheet.py --data /tmp/cricket-data --out /tmp/cricket-import --cutoff YYYY-MM-DD`. It validates gender/format/version, totals, duplicates and revisions; produces immutable manifest, provenance matches, identity aggregates, per-innings aggregates and JSON bundle.
5. Owner may use Admin → Evidence refresh/import to import `bundle.json` (30 MB limit). Larger CSVs are imported via managed database COPY with explicit columns, manifest first, then matches, players, innings. The browser import currently persists manifest/matches/aggregates, not per-innings rows; use CSV route to preserve the complete audit ledger. No external paid keys are needed.
6. Repeated snapshot IDs fail rather than overwrite. New imports only affect rooms whose review has not started.

## Current verified import
Cutoff 2026-10-29. 7,496 unique source matches, 150 stable mapped identities, 55,644 format-specific player-innings aggregate records. Latest data revision imported with obstructing-the-field dismissal correction; earlier immutable snapshot retained for reproducibility.
- IPL: 1,243 matches, 142/150 players with any available history; latest 2026-05-31.
- T20: 4,889 matches (IPL + men's T20I only), 150/150 with history; latest roster-player match 2026-10-24, source archive latest 2026-10-25.
- ODI: 2,607 matches, 122/150 with history; latest 2026-10-25. No T20 substitution.

Definitions: legal balls exclude wides/no-balls; balls faced exclude wides but include no-balls; bowler conceded excludes byes/leg-byes/penalty; credited wickets exclude runouts/retirements/obstructing field. Batting dismissals exclude retired hurt/not out. Super overs excluded. Recorded powerplays determine PP; missing powerplays remain unknown. Phase boundaries use scheduled overs, not decimal-over arithmetic. Fielding counts only, no efficiency claims.

## Limitations
- Current V2 subset solver is exhaustive through 16-player squads, approximate deterministic top-16 candidate shortlist above 16. Shortlist may omit a better combination or valid XI; not a guaranteed optimum.
- Combination currently scores observed position/workload coverage, not normalized phase effectiveness. Phase plan is feasible but allocation is not phase-performance optimized. No specialist tags.
- Same role/format/window cohort is used for overall rates; phase-specific cohort normalization is not yet used.
- Import validation verifies schema/provenance/aggregate bounds but owner bundle upload is not a cryptographic proof of source truth. Full source-ledger reaggregation remains the reproducible audit path.
- Source match JSON preserved in downloaded archives, not database delivery rows; database contains match metadata/hashes and aggregated player innings.
- Canonical calculation verified on empty/incomplete room results; legal populated XI server flow still needs dedicated end-to-end verification.
- Six identity nationality confirmations rely partly on existing identity-verified photo metadata; mapping evidence and alternatives are recorded.
