# Real-data roster update (2026-11-06)

Base revision: `21ed9bc`. Not published.

## Done

### Roster: 150 -> 200 unique identities
- All 50 candidates added; none substituted. Each one was matched to a single Cricsheet register identifier (`people.csv`, downloaded 2026-11-06), with its ESPNcricinfo key where the register lists one. The three ambiguous register names were settled using the cricinfo key: Finn Allen = `bf74b130` (FH Allen, 959759), Spencer Johnson = `83c3e8e3` (SH Johnson, 1123718), Matt Henry = `e84ac20c` (MJ Henry, 506612).
- Aliases are recorded: Vaibhav Sooryavanshi, M Shahrukh Khan, AM Ghazanfar, Digvesh Singh Rathi, Rasikh Dar.
- The importer asserts that no name or register ID is duplicated against the original 150.
- Source file: `src/data/roster-additions-2026-11.json`. Role, sub-role and bowling style are game classifications from editorial knowledge, not from a source.
- **Current IPL squad membership was not verified** against iplt20.com, Cricbuzz or ESPN pages. Only identity is verified.
- Database now holds 200 players per format (600 rows). The new 150 rows use legacy `rating=0` (meaning none), `tier='Unrated'` and `base_price=0.2`. Existing rows are unchanged.

### Refreshed evidence snapshot `3a49cdc3-cd5c-52a5-a191-94c641202e2e`
- Cutoff 2026-11-06, status validated.
- Archive contents: IPL 1243 matches (latest 2026-05-31), T20I+IPL 4892 matches (latest 2026-11-01), ODI 2617 matches (archive latest 2026-11-02).
- Loaded rows: 7509 matches, 62054 innings rows, 200 players, 533 position supplements. Loaded with CSV COPY.
- Players with data: IPL 192/200, T20 200/200, ODI 147/200. Full missing lists are in `src/data/evidence-coverage-roster200.json`.
- "T20" means IPL + T20I combined, not all T20 cricket. This is labelled in the snapshot provenance (`format_scope`).
- Cricsheet's withholding of Afghanistan-involving matches is still stated in the credit.
- Rooms already past the lobby keep their frozen snapshot. Lobby rooms pick up this snapshot when review starts, as before.

### Pool groups (`pool-groups-1`, `scripts/classify-pool-groups.py`)
Groups are per format and are used only for pool composition. Inputs are Cricsheet aggregates. Legacy rating, tier, price and name are not used.
- **Experienced** threshold, over the last 36 months: IPL/T20 = 300 balls faced or 360 legal balls bowled; ODI = 600 / 600.
- **Cricket Auction performance score**: the percentile among experienced players in the same format.
  - Batting value = average × strike rate / 100.
  - Bowling value = bowling average × economy (lower is better).
- **established**: an experienced sample and a score of at least 50 in a discipline that matches the player's role.
- **emerging**: below the experienced threshold in every format, across all covered history. This is why experienced players like Matt Henry or Sandeep Sharma are never "emerging" just because they were added recently.
- **other / unknown**: excluded from 80/20 pools.

| Format | established | emerging | other | unknown | largest exact 80/20 pool |
|---|---|---|---|---|---|
| IPL | 55 | 18 | 116 | 11 | 69 |
| T20 | 84 | 20 | 95 | 1 | 102 |
| ODI | 30 | 4 | 111 | 55 | 22 |

### Random 80/20 generator (`generate_pool`, migration 0021)
- New rooms get `pool_rules='random-80-20-v1'` from an insert trigger. All 47 existing rooms stay `NULL` and keep the original builder.
- **Counts**: emerging = round(N×0.2), established = N − emerging. This is mirrored in `src/lib/pool-ratio.ts`.
- **Who can generate**: host only, lobby only, with a quota of 30 generations per 10 minutes.
- **How players are drawn**:
  - Random sampling without replacement, using a fresh server seed through `setseed`. The seed is stored in `rooms.pool_generation` together with the snapshot, group rules, counts and a per-player group map.
  - Role, spin, pace and Indian-player minimums for the configured team count are filled first. Each of those picks is uniformly random among eligible players in a group that still has quota left. The rest of each group's quota is then filled at random. Up to 40 attempts are made.
- **When it fails**: an exact error with capacity and the largest supported size. The ratio is never relaxed and players are never repeated.
- **No client-supplied lists**: `set_pool` rejects them for these rooms, so the generator is the only path. The pool bound is now 200.
- **Order**: auction order is still shuffled separately at review start, and surprise-mode privacy is unchanged.
- **Lobby**: shows "N = X established + Y emerging", the actual saved counts and a short explanation of the groups. The default pool size is now 60.

## Tests run this turn
- Vitest: 12 files, 73 tests passed, including 4 new 80/20 count/capacity tests. Build OK.
- Server generator check on the shared database, inside a transaction that was rolled back at the end, so nothing was kept. It used temporary rooms for every format with 4 and 10 teams, at sizes 21–110.
  - Exact ratios: 44→35+9, 45→36+9, 69→55+14, 70→56+14, 101→81+20, 102→82+20.
  - Zero duplicate players.
  - Regenerating changed the selection (for example T20 44: 17/44 overlap).
  - Direct `set_pool` was rejected.
  - Oversize pools failed with capacity messages: IPL 70, T20 103, ODI 23.
  - **10 teams was impossible in every format.** It needs 110 players, which is more than the largest exact pool in any format.
- Not run: browser/mobile checks of the new lobby controls, and isolated multi-client auction tests.

## Not done / remaining blockers
1. **10-team 80/20 pools and ODI rooms.** With the current groups, IPL allows at most 69 players and ODI at most 22, so new ODI rooms cannot meet 4×11 at all. Options:
   - add more identities, or
   - widen the "established" rule (for example to the top 60%, or count all covered ODI history), or
   - lower the team count or squad minimums.
   This needs a product decision.
2. **Opening prices.** These still come from catalogue `base_price`, which is legacy tier-derived for the original 150 and 0.2 for the new 50. Switching to a room-configured opening price means replacing core bidding SQL, which is not done.
3. **Section C UI.** BAT / BOWL / all-round / recent form / sample / cutoff are not yet on the main cards and results. Tier badges are hidden only for the new players. The legacy builder, sorting and tier filters remain for legacy rooms.
4. **Section D team evaluation rework**, including removing the leadership 5% from neutral priors: not started. V2.1 is unchanged.
5. **Section E photos.** The 50 new players have no portraits yet (initials fallback). The Rohit and Bumrah Commons/GODL candidates are not installed. Existing portrait coverage is unchanged: 79/150 below 200px wide, Kohli improved.
