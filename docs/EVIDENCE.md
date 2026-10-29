# Cricket Auction evidence V2

Data is Cricsheet JSON + Register under ODC-By 1.0 (see CRICSHEET-LICENSE.txt). Source match data coverage is incomplete and Afghanistan-involving matches are withheld. Photos are separately licensed.

## Reproducible refresh
1. Download `ipl_male_json.zip`, `t20s_male_json.zip`, `odis_male_json.zip` from https://cricsheet.org/downloads/ into a temporary directory. Keep raw archives and source notices offline for audit/reimport. Do not commit downloaded archives.
2. Keep stable identity mappings in `src/data/cricsheet-crosswalk.json`; review new aliases against the register and country/team history. Six identities have country-evidence limitations recorded. Uncertain matches must stay unmatched.
3. Export current catalogue name/country/role metadata to `catalogue.json`, keyed `name|country`, in the data directory. This is needed for same-role cohort rates.
4. Run `python3 scripts/import-cricsheet.py --data /tmp/cricket-data --out /tmp/cricket-import --cutoff YYYY-MM-DD`. It validates gender/format/version, totals, duplicates and revisions; produces immutable manifest, provenance matches, identity aggregates, per-innings aggregates and JSON bundle.
5. Owner may use Admin → Evidence refresh/import to import `bundle.json` (30 MB limit). Larger CSVs are imported via managed database COPY with explicit columns, manifest first, then matches, players, innings. The browser import currently persists manifest/matches/aggregates, not per-innings rows; use CSV route to preserve the complete audit ledger. No external paid keys are needed.
6. Repeated snapshot IDs fail rather than overwrite. New imports only affect rooms whose review has not started.
7. V2.1 imports also run `scripts/import-positions.py`, producing `positions.csv` and `positions` in the owner JSON bundle. Import position rows in the same transaction before publishing a snapshot. Manual CSV refresh needs a new snapshot ID; never supplement an already frozen snapshot. Current supplement: IPL 140, T20 149, ODI 121 with recorded batting arrivals; 14,847 accepted innings, 127 excluded super-over/forfeit/uncertain innings. Two opening players are grouped 1–2; subsequent arrivals must be unique, overs continuous, opening deliveries present. DNB has no invented batting position. Retired batters retain their original arrival group, not a new slot on return. Incomplete innings retain observed arrivals only, not projected missing batters.
8. Leadership reviews are append-only format-specific owner judgments; six entries contain selected official captaincy facts but no numeric owner rating. All 450 C/VC ratings remain neutral 50 until reviewed. Published rubric `leadership-1` and source facts are in profiles and scoring rules; official source publication dates are not claims of current full captaincy history. No universal VC statistics asserted.

## Current verified import
Cutoff 2026-10-29. 7,496 unique source matches, 150 stable mapped identities, 55,644 format-specific player-innings aggregate records. Latest data revision imported with obstructing-the-field dismissal correction; earlier immutable snapshot retained for reproducibility.
- IPL: 1,243 matches, 142/150 players with any available history; latest 2026-05-31.
- T20: 4,889 matches (IPL + men's T20I only), 150/150 with history; latest roster-player match 2026-10-24, source archive latest 2026-10-25.
- ODI: 2,607 matches, 122/150 with history; latest 2026-10-25. No T20 substitution.

Definitions: legal balls exclude wides/no-balls; balls faced exclude wides but include no-balls; bowler conceded excludes byes/leg-byes/penalty; credited wickets exclude runouts/retirements/obstructing field. Batting dismissals exclude retired hurt/not out. Super overs excluded. Recorded powerplays determine PP; missing powerplays remain unknown. Phase boundaries use scheduled overs, not decimal-over arithmetic. Fielding counts only, no efficiency claims.

## Limitations
- Release patch `legal-reserve-1` applies only to rooms created after the release audit. It reserves one feasible overseas-constrained keeper/five-bowler XI in the 14-player shortlist; position/score optimization remains approximate. Earlier V2/V2.1 rooms retain their original solver and persisted results.
- V2.1 future rooms use 35/30/20/10/5; combination subpoints fit12/legal10/keeper4/variety3/phases6. Position usage does not reuse batting raw performance. Auto subset search through 14, deterministic shortlist above14, greedy ordering + improving swaps; approximate, not global optimum. Existing V2.0 keeps original16 algorithm and scores. Public lineup edits after auction until finalization/trade deadline; private notes never converted. Incomplete/illegal submitted lineups rejected; invalid traded-away saved plans revert to automatic and are labelled.
- Leadership positive owner-review UI verification needs an assigned owner admin identity; none is auto-granted. Evidence-only reviews never change neutral numeric priors.
- Current V2 subset solver is exhaustive through 16-player squads, approximate deterministic top-16 candidate shortlist above 16. Shortlist may omit a better combination or valid XI; not a guaranteed optimum.
- Combination currently scores observed position/workload coverage, not globally optimized phase effectiveness. Phase plan is feasible but allocation is not phase-performance optimized. No specialist tags.
- Same role/format/window cohort is used for overall rates; phase-specific cohort normalization is used for observed coverage checks.
- Import validation verifies schema/provenance/aggregate bounds but owner bundle upload is not a cryptographic proof of source truth. Full source-ledger reaggregation remains the reproducible audit path.
- Source match JSON preserved in downloaded archives, not database delivery rows; database contains match metadata/hashes and aggregated player innings.
- Canonical calculation verified on empty/incomplete results and a real eleven-player auction: legal XI, capped 20 overs, measured contributions and shared persisted results.
- Six identity nationality confirmations rely partly on existing identity-verified photo metadata; mapping evidence and alternatives are recorded.
