# Production activation — 2026-11-01, 19:02 UTC

## Database installed and verified; matching accepted app ready for publishing — NOT published

Accepted main source confirmed at `4603d80b9bda008213b79cead525d5a211ebbc99`, initially clean. No draft creation, feature rewrites, production fixtures/load, catalogue replay, customer-game writes, admin assignment, Auth/storage changes or deployment.

- Installed through the supported transactional migration tool: `drizzle/migrations/0018_post_launch_auction_controls.sql`, once, registered database migration ID19 / timestamp1793559637679. All18 earlier migration hashes/timestamps already matched the source journal; none replayed.
- Every dynamic replacement prerequisite was found exactly once in actual production definitions before installation. Historical advancement/full projection copies match the original definition fingerprints after normalizing only their names. All expected replacements were inspected after installation.
- Approved staged file SHA256 `42424464ee04ce83ef5cb4324c68716cac3af25cdb963bb56e06af2d48fa3cdb`. Submitted/registered file SHA256 `24192f69f14b032d320138eca3dab8975949a05beb531b5c1e99b1a8474cbc99`: SQL is identical; the submitted payload has one final newline absent in the staged source. This discrepancy is explicitly disclosed, not a second application. Keep the staged file as historical evidence only; never install it again.
- Necessary installation fix: production inherited default grants gave anon/member access to new tables and UPDATE on the acceptance sequence, despite explicit grants in0018. RLS blocked table writes, but direct sequence changes were reachable. Applied `drizzle/migrations/0019_post_launch_inherited_access_hardening.sql`, ID20 / timestamp1793559709388, hash `861c215b60eca26e6553b4ab120543b6782c1fdface83ccf892e376dc83446a5`. It revokes inherited caller access, restores only member nomination SELECT and service access, and raises/rolls back on ACL/RLS verification failure. No gameplay runtime code changed.
- Final ACLs: nominations member SELECT only, commands service-only, neither table anon-readable/writable; both RLS enabled, member nomination policy uses `is_room_member(room_id)`. Acceptance sequence inaccessible to anon/authenticated; owner/service authority retained. New RPCs authenticated-only, internal helper RPCs inaccessible to anon/authenticated, all SECURITY DEFINER search paths fixed to public.
- All40 existing rooms remain `repair_flow=false` with historical defaults. All3425 existing bids retain `undone=false`, session0 and NULL acceptance order. Before/after fingerprints match for40 rooms,87 participants/purses,3425 bids,240 holdings,403 sales and6 private notes. No existing record changed, excluding newly added default columns.
- Verified enabled insert-only new-room trigger sets repair_flow=true, while column default remains false. Session/acceptance triggers installed and ordered after lot-version trigger. Full/lean membership checks and capability marker installed; hidden queue arrays remain excluded. Host ownership, observed lot/status/control/bid revision, retry identity, next-lot-only timers, nomination eligibility/summary and trade closure guards inspected in installed definitions.
- Latest automatic build/typecheck inspected: **build OK 19:01:53Z**. Previously recorded69 unit,7 importer,75 real isolated browser checks retained, not rerun or relabeled production testing. No production gameplay mutation was used to test installation.

Exact inspection queries and preservation fingerprints: `docs/post-launch-evidence/production-activation.md`. Activation source save before final documentation: `9f942b801e8575860dc14c14b1f0b67d1dc24520`; final platform-managed commit is returned in chat after these documentation saves.

**Next action:** publish this matching accepted main app through the user's deployment connector. Database activation is complete, not a claim of exhaustive production gameplay/performance clearance. Previously documented race-matrix, real-device and portrait/data limits remain. Do not deploy an older client into newly created repair rooms or reapply0018.

---

# Unified repair verification — 2026-11-01, 18:51 UTC (historical)

## Current result: implemented and tested locally; NOT activated on production

Draft Update is complete (`status: ready`, base `83e0edbc2a0c8f9ea2d87e73b454ed0841960305`). Combined saved source before this report: `eaadea3ef2bcfb2c85a87d5e319d42b0b466c0a2` from `git rev-parse HEAD`; report/final harness saves can follow. Initial combined tip was `4d5089131dbe8eae71461de7852a98bc30126ac9`. No conflict markers or discarded regression suites. Original63 draft and56 main suites overlap; their combined union was68 tests, now69 with an observed-bid-state regression. Both single-flight ambiguous bids,80ms coordinator/timer decoupling/2600ms portal queue AND staged0018 controls, lean projection and licensed Kohli remain.

The managed draft still shares the live database. **It was never repointed or migrated.** Instead a genuine official experimental native stack now runs under `/tmp/cricket-native/home`, with Auth, PostgREST, Realtime, PostgreSQL and Storage. Local gateway127.0.0.1:54321, database proxy127.0.0.1:54322, separate app127.0.0.1:8081. TCP proxy reports null server address/port; verified actual PostgreSQL data_directory is beneath the native stack's private temporary root before writes. No customer dump/data/accounts, production load, admin assignment, emails, purchase, publication or hosted configuration changes.

### Integration defects fixed

- New accepted bids receive a monotonically allocated order under the room lock. Retry-ID attachment uses that exact allocation instead of transaction-start timestamps; bid undo/display use acceptance order. Historical timestamps remain untouched.
- Destructive/pause/bid-undo commands capture `observed_bid_revision`: stale skip cannot discard a newly accepted bid. Lot version remains a separate lot/session guard. Accepted command retries still resolve before stale guards.
- Repair pause/resume compute time after acquiring the room lock using clock_timestamp; no transaction-start deadline drift. Settings remain1–120 seconds, apply next lot only.
- Current bid reads filter live bid_session and non-undone rows BEFORE limit30; reopening never offers a previous session's bid undo.
- Sale undo during a later round explicitly requeues next in the current round; final-call undo returns unsold without starting a round.
- Lean reads only enable for repair rooms and validate complete ID set/frozen snapshot before cache merge. Historical rooms keep full reads and historical advancement.
- Repair desk now bounds commands8s and nominations5s, coalesces polling, catches transport exceptions and refreshes room/bids/sales/squads/purses independently of bid pending.
- Final call keeps the Auction mounted: final-lot SOLD no longer vanishes when status becomes completed. Phone/laptop portal remains nonblocking.
- Stable useRoom return and memoized Auction prevent the parent presence clock alone from rebuilding the auction. This does not eliminate necessary bid/revision rendering or promise zero buffering.

### Actual commands and results

Official CLI2.121.0 standard `supabase start` failed (Docker/Podman absent). Installed Podman5.8.8 then failed `cannot set user namespace` under gVisor. Official native runtime succeeded; it is experimental, not a stable production deployment runtime.

```
supabase init --workdir /tmp/cricket-stack --yes
# Scratch config ONLY: enable_anonymous_sign_ins=true; anonymous_users=200
# Use sanitized environment: retain PATH/HOME only plus these native controls.
SUPABASE_HOME=/tmp/cricket-native/home SUPABASE_EXPERIMENTAL_STACK=1 \
SUPABASE_NATIVE_POSTGRES_USER=lovable supabase stack start \
 --runtime native --stack cricket-isolated \
 --exclude functions,studio,mail,analytics,pooler --eager
# Run from /tmp/cricket-stack. Export credentials privately, never echo them.
supabase stack status --stack cricket-isolated --env > /tmp/cricket-native/local.env
chmod 600 /tmp/cricket-native/local.env
bun scripts/prepare-isolated-stack.ts /tmp/cricket-native/local.env
python3 scripts/start-isolated-app.py /tmp/cricket-native/local.env
python3 scripts/test-isolated-browsers.py
bunx vitest run
python3 src/test/cricsheet-import.test.py
python3 src/test/positions-import.test.py
```

Native services loaded source0000–0017, skipping catalogue0001, and exact updated scripts/staged0018.16 synthetic names, real separate Auth anonymous sessions, no SQL identity substitutes. Scratch Storage is real and needed for baseline policies; no managed storage settings changed. Durable setup refuses non-loopback endpoints; test browser blocks managed-backend/production URLs. Secrets/session files remain temporary and are not copied to evidence.

**Final checks:**69 Vitest across11 files,4 Cricsheet and3 position tests passed. Harness build/typecheck OK18:51:24Z. Ten-browser run75 assertions,14 rapid bursts across first/second/third rounds plus nominated final-call lot. Each participating team presses20 times per burst, at most one in-flight bid per team.132 actual bid requests:15 HTTP acceptances,116 expected competitive rejections,1 deliberately lost response. Lost response was fetched through the real server, verified200, then aborted to browser; one accepted row reconciled, no automatic resend. Current UI prices and all ten projections converged. Verified nonhost denial, surprise redaction, stale skip, separate bid undo/idempotent retry/predecessor, settings sheet paused deadline, repeated rounds2/3, ten-way nominations/one lot, changed-summary close denial, nominated competitive purchase/expiry, sale refund, trade lock/stale bid denial, reconnect no replay and zero overspend/duplicate ownership. Zero page errors.

| Measurement, final full run | n | p50 | p95 | max |
|---|---:|---:|---:|---:|
| Browser network bid response/ACK, ms |131|30.16|63.54|88.58|
| Guarded host RPC round trip, ms |17|20.46|31.19|31.19|
| Visible pending after rapid click, ms |129|34.40|45.50|131.30|

Environment: warm local Vite8 development, headless Chromium10 contexts on one sandbox CPU, native loopback services, synthetic16-player pool. Not public-production latency, actual phones or CPU/network geography. Earlier complete pre-memo run ACK p95275.67ms/max439.45; pending p95138.70/max295.40. Final pending maximum still exceeds100ms; no universal <100ms or zero-buffering claim. The deliberately aborted response is excluded from ACK stats, included request total. No click backlog observed in bounded bursts, not proof under arbitrary load.

Failure distinctions: initial guest form fill before hydration caused no signin (test waited); one Python async-generator account lookup failed (test fixed);4-second lot expired during added network scenario and correctly rejected skip (test uses10s). Earlier successful complete run preserved in temporary logs; final durable sanitized metrics/screenshots are in docs/post-launch-evidence/native-*. Production is not exercised.

### Known limits / remaining verification

- This is meaningful central-flow verification, **not the entire requested race matrix**. Lock-wait timestamp inversion, exhaustive expiry-vs-all-controls races, all-disconnected/host takeover, full offline unknown/explicit same-ID retry UI, broad slow-network throttling, affordability/role combinations and historical-room SQL fixture matrix were not all newly exercised. Existing unit/security/history tests preserved; old results not relabeled fresh proof.
- Isolated screenshot shows stale host-away banner when many headless background pages are throttled; no host takeover attempted. Do not call that production disconnected recovery verified.
- Canonical stored scoring was not recomputed in this synthetic run. Frozen V1/V2/V2.1 code and69 regressions preserved; no new historical data touched.
- Public draft controls stay capability-gated OFF until installation. Do not fake missing RPCs or label the shared preview as activated. Future isolated native restart needs rebuilding temporary services/synthetic accounts, with commands above.
- Portraits: one licensed Kohli1899×2012 improvement retained;149 identities not newly improved or cleared. Original survey79/150 widths<200 remains79 (Kohli original width480).149 cannot meet both dimensions600; not all have license clearance.2x adequacy depends on crop/frame, not just width; no artificial upscale/srcset variants or exhaustive new image search.

### Non-destructive rollout / rollback proposal — NOT executed

1. Review/accept combined source separately; accepting is not publication. Keep0018 outside automatic migration acceptance until its explicit installation is approved. Do not copy into both migration journals or apply twice.
2. On a fresh official isolated stack, replay durable setup,69+7 tests and ten-browser suite; close remaining race/history gates above before declaring fully release-ready.
3. With explicit production approval, apply additive0018 once in a transaction, preserving all existing room rows `repair_flow=false`. Only subsequently created rooms use repaired transitions. Inspect function definitions/grants and member projection capability, then publish matching client (separate approval).
4. Rollback without destructive DDL/data rewind: stop creating repaired rooms, keep guarded server functions deployed for any repair rooms already created, and keep compatible client for those rooms. Historical rooms use preserved `_advance_lot_pre_repair`. Do not undo purchases, drop columns/tables, or publish an old client lacking repair controls into active repair rooms. No automatic safe complete rollback is claimed once new-flow rooms are active.

Draft preview: https://id-preview-1--12e67a6e-aa29-4c54-9e2a-6b7bd68976db.lovable.app

---

Historical reports below are retained, not the current activation/testing verdict.

# Reconciled draft status — 2026-11-01

The existing draft has now recovered its client repairs alongside main's newer
capability-gated controls, lean projection and licensed Kohli portrait improvement.
Neither report below is silently replaced: they are historical records of separate
verification runs, not current combined-source verification or production proof.
The 2600ms draft queue duration is retained over main's 2700ms duration because both
meet the required 2–3 seconds and the draft's queued reveal behavior stays exact.
Conflicting generated Python bytecode is intentionally deleted at
`scripts/__pycache__/import-cricsheet.cpython-313.pyc` and
`scripts/__pycache__/import-positions.cpython-313.pyc`; importer source is unchanged.

### Combined-source verification after reconciliation

- `bunx vitest run`: **68 passed, 11 files** after adding the missing capability
  field to the restored local UI fixture; no test assertions removed.
- `python3 src/test/cricsheet-import.test.py`: **4 passed**.
- `python3 src/test/positions-import.test.py`: **3 passed**.
- Automatic harness log: **build OK**, 18:31:04 UTC.
- `python3 /tmp/browser/reconcile/check_demo.py`: localhost-only demo
  bid → expiry → sold → restart at360/390/430/1280px; no horizontal overflow or
  page errors.390px and1280px screenshots visually confirm the SOLD reveal and
  unobstructed restart control. The text-count probe returned0 because the
  heading includes an icon; screenshot evidence confirms the reveal instead.
- `lovable drafts verify --json --base 45568c1cdb0f --ref
  origin/_pre-refresh/drft_01m6c4f3fze3g98vf03xa4akft --refreshed-base 83e0edbc2a0c`:
  Initial result: **needs_review**, zero dropped changes. Final result flags
  `src/test/post-launch-ui.test.tsx` as **dropped** solely because the necessary
  `capabilities:{}` fixture addition differs from its byte-exact draft version;
  every original test and assertion is retained, and all68 tests pass. This is
  an intentionally reviewed compatibility edit, not missing draft work.
  Deliberate merges preserve both sides
  in AGENTS.md, this report, roadmap.md, Auction.tsx, use-room.ts,
  player-photos.ts and room.$roomId.tsx; the two generated caches are removed.
  No manual Git commit was made; source saves are managed by the platform.

Shared database restrictions still apply: staged SQL remains unapplied, and genuine
hosted authenticated multiplayer/latency verification remains blocked. No publish,
customer-room mutation, privileged account assignment or configuration changes occurred.

## Historical main implementation report

# Cricket Auction post-launch implementation — 2026-11-01

## Status: staged implementation, not full completion

No publication, production configuration changes, production migrations,
production accounts or production-room load were performed.

### Existing draft/source boundary

The requested existing draft is `drft_01m6c4f3fze3g98vf03xa4akft`, thread
`thr_bm48fvupnucd`, saved tip `b678cabd25cef4d3962097fa3ad8b84277feb19f`.
`drafts.list` and `lovable drafts list --json` both show
`isolated_backend: false`: it shares the live database. This chat is on **main**,
initial saved tip `ba72b4f0b0b9ba9c33f4a5c6327b007395205d09`, not that draft.
The draft tip is not a Git object in this checkout; its prior report is absent.
There is no available tool to check out or send instructions to that existing
draft. Consequently the draft was **not overwritten, refreshed, accepted or
replaced**, and its earlier client fixes were not falsely claimed as recovered.
The work below is saved on the current surface and requires reconciliation in
the existing draft before acceptance. Last implementation save inspected before
this report: `fd843069010cc6aadd3327ee817db7a5bd38a78d`; later report edits receive
their own platform-managed saved commit.

Existing draft preview (unchanged by this turn):
https://id-preview-1--12e67a6e-aa29-4c54-9e2a-6b7bd68976db.lovable.app

Current surface preview:
https://id-preview--12e67a6e-aa29-4c54-9e2a-6b7bd68976db.lovable.app

## Implemented source and unapplied migration

Exact staged SQL: `scripts/staged/0018_post_launch_auction_controls.sql`.
It is outside the managed journal on purpose; **not applied to Lovable Cloud**.
No migration tool was called against the shared live backend.

- New repair rooms enter FINAL CALL after the regular round; no automatic replay
  or trade transition. Explicit unlimited host-started eligible-unsold shuffled
  rounds, per-round persisted order and empty eligible-pool rejection.
- Member nominations use current membership, affordability and roster checks,
  deduplicate one competitive player lot, and remain separate from private notes.
- Host opens one nominated lot at a time; regular bidding rules still apply.
  Explicit close verifies the exact pending nomination summary under the room
  lock, then irreversibly closes purchases to trading. Active-round exit resolves
  the current lot normally before marking pending players unsold.
- Distinct bid undo checks the exact latest bid and unresolved current session;
  stores withdrawn history, restores the previous leader, increments observed
  lot version and retains at least a full bid-extension window (including paused
  remaining time). Unique command IDs make retries idempotent. Sale undo instead
  refunds the buyer, reverses holdings and exposes the player for auction again.
- Next-lot timer/extension sheet accepts 1–120 integer seconds only. Current and
  paused deadlines remain unchanged. Saved next-lot values are public room state;
  economics, scoring, pool and roster edits are rejected by this command.
- Capability-gated frontend means new controls/lean RPCs are not called when
  installation is absent. Historical room advancement remains preserved.
- Lean member-only projection sends player state rather than repeated frozen
  facts, preserves surprise ordering redaction; frontend caches initial facts.
- Existing pending-click guard remains single-flight; thrown bid failures trigger
  authoritative resync, without automatic retries or future bids. No claim that
  this reproduces the unavailable draft's stronger ambiguous-outcome handling.
- Sale reveal duration is 2.7 seconds; snapshot/Last sold presentation preserved.

## Actual isolation evidence

A **new** disposable PostgreSQL 17.11 cluster was initialized under `/tmp` as
the sandbox `lovable` user, bound explicitly to `127.0.0.1:55439` with its own
data directory. Tests use explicit connection options, never managed PG
environment variables. Query result: host `127.0.0.1/32`, port `55439`, database
`postgres`. No production dump, customer data, customer account or room was used.

Schema loaded from existing source migrations (catalogue seed skipped), then
the exact staged migration. Ten synthetic catalogue entries and ten synthetic
SQL identity claims exercise authenticated-role permissions. This is **not** a
Supabase/PostgREST/Auth/Realtime stack. It does not mint authenticated browser
sessions. Baseline managed function grants were replicated before hardening;
no security grants were changed on the real backend. PostgreSQL emitted a local
logical-WAL publication warning: Realtime is not exercised here.

## Commands and results

| Command/check | Observed result |
|---|---|
| `bun scripts/test-post-launch-local.ts` | **32 passed**, ten SQL-role identities; three concurrent ten-attempt opening bursts; one winner/burst |
| `bunx vitest run` | **56 passed**, nine files, including 51 prior main tests plus five new checks |
| `python3 src/test/cricsheet-import.test.py` | **4 passed** |
| `python3 src/test/positions-import.test.py` | **3 passed** |
| harness build/typecheck log | **build OK**, newest inspected entry 18:22:03 UTC |
| public Playwright at 360/390/430/1280px | No horizontal overflow, zero page errors; scoring title correct |

Local test checks: surprise redaction, timer persistence/next activation,
economics denial, nonhost denial, simultaneous opening bids, duplicate bid retry,
preceding-leader restoration, idempotent undo, stale version/next-lot rejection,
pause/settings/resume, rounds 2/3/4, ten-way nominations, stale close-summary
rejection, normal nominated sale, sold-lot bid-undo denial, sale refund, trading
lock and no negative purses/duplicate holdings.

Final clean-cluster SQL round-trip measurements, **not network ACK proof**:
30 attempts, 3 accepted, 27 expected competitive rejections; p50 **22.00ms**,
p95 **78.91ms**, max **83.49ms**. Earlier warm/setup-sensitive run reached
p95 154.37ms/max 161.37ms. Environment: loopback SQL connections, ten synthetic
players, no hosted latency, browser clicks, auth service or Realtime convergence.
Projection JSON sizes: full **9,771 bytes**, lean **2,405 bytes**, ten players
(75.4% smaller). This demonstrates payload savings, not production CPU savings.

Logs/screenshots are under `/tmp/cricket-isolated/` and
`/tmp/browser/post-launch/`; temporary evidence is not durable across restart.
No authenticated sale-overlay screenshots were taken in this turn.

## Portraits

**One verified source improvement implemented**: Virat Kohli / India, original
**1899×2012** photographic portrait by Anand Anil, Commons CC BY-SA 4.0.
Source https://commons.wikimedia.org/wiki/File:Virat_Kohli_portrait.jpg;
license https://creativecommons.org/licenses/by-sa/4.0/.
Original downloaded, visually checked, saved through the CDN asset tool;
attribution and displayed-crop notice retained. Shared across formats; custom
owner photo overrides retain precedence. No generated faces or upscaling.
Personality rights caveat remains. This does not clear all portrait rights.

Reported draft evidence of **79/150 widths below 200px** could not be recovered
from this checkout, so no revised low-resolution total is asserted. **149
identities were not newly improved or cleared**. Existing editorial reuse
limitations remain unresolved, not solved by requesting larger provider URLs.

## Remaining blockers / exact next action

1. **Existing draft continuation:** open the Drafts panel, select
   **Post-launch repairs — isolated testing**, and send the continuation in
   that draft's own chat. Its saved client source/report is accessible there;
   main cannot inspect it. Reconcile this staged implementation with the saved
   client fixes, without refresh/reset that discards newer work.
2. **Hosted auth isolation:** that selected draft must report **its own isolated
   test database**, not the live database, before applying migrations or browser
   testing. No available tool/documented UI procedure converts this shared draft
   to isolation; do not assume a draft label does so, buy upgrades, or invent a
   setup toggle. A provisioned local Auth + PostgREST + Realtime stack is an
   alternative, but was not available/configured in this turn. The SQL-only
   isolated cluster is sufficient for implemented rule tests, not that requirement.
3. **Unverified requested acceptance tests:** ten truly authenticated browser
   teams, bounded repeated click bursts/host timing, end-to-end ACK p50/p95/max,
   convergence/backlog, slow-network/timeout ambiguity, reconnect, race matrices
   against expiry/skip/undo/settings, and authenticated SOLD/UNSOLD/undo screens
   at phone360/390/430 and laptop. Public rendering is not a substitute.
4. **Saved draft client regressions:** its reported 63 tests were inaccessible;
   this turn preserves those draft files but cannot rerun them or assert they
   pass with this separate source. Timer/heartbeat rerender decoupling and more
   robust outcome reconciliation require merging and measurement there.
5. **Data/media:** source coverage, all neutral50 leadership entries, approximate
   optimizer, low-resolution portraits and editorial redistribution rights remain
   honestly disclosed. No scoring migration or owner-role changes made.

Do not call this release-ready or fully implemented: source and isolated SQL
checks are saved; hosted integration and existing-draft merge remain blocked.

---

## Historical draft client report (preserved verbatim)

# Cricket Auction post-launch repairs — 2026-11-01

## Status: partial client repairs; multiplayer/backend work BLOCKED

No publish, production load test, database write, fixture/account creation, role assignment, schema change, storage/auth change, customer-room mutation or test email was performed.

`drafts.list` returned current **Post-launch repairs — isolated testing** with **Database: the project's live database; data changes made in this draft affect the live app**. The label does not establish isolation. User explicitly prohibited migration/fixtures when shared: none were staged or applied. No new-schema-dependent UI or simulated backend was installed to pretend those features work. Existing Python gameplay integrations were deliberately NOT executed.

Actual `git rev-parse HEAD` read after code checks: `b5a137c0c2a4b421f8c05c62cbaf222387b61100`. This is a real harness-managed saved revision, not a manual commit; documentation/final harness revision can follow.

Draft preview: https://id-preview-1--12e67a6e-aa29-4c54-9e2a-6b7bd68976db.lovable.app

## Causes identified and client changes

| Finding | Change / evidence | Limit |
|---|---|---|
| Room route updated at 4Hz, recreating derived maps, pool rows, portrait stage/history and team rail | Live clock moved to timer and BID controls at250ms; route presence/review now1Hz. Mock test confirms profile render count unchanged after clock ticks. | Route still updates at1Hz; no sustained authenticated mobile frame profile available. |
| Per-table trailing80ms debounce could postpone reads under continuous events; no in-flight deduplication | One fixed80ms batching window, one active read plus one dirty flag per table. Duplicate room_players projection path removed. Late old-room/current-lot responses ignored. | Full server projection still contains frozen player pool; payload reduction requires backend work. |
| Every room revision fetched sales even for bids/deadline updates | Revision now invalidates projection only; sale events invalidate sales independently. Pool remapping skipped if unchanged; canonical portrait matching now indexed rather than linear150-entry scan. | No live database/RPC latency benchmark; cannot claim this fixes production freezes. |
| Bid errors could escape, unknown outcomes unlocked fresh requests | Synchronous single-flight gate and immediate pending; no click queue.8s transport bound; SQL rejection unlocks; ambiguous outcomes reconcile own request ID and lock new bids. Explicit retry first rereads acceptance, then sends exact original lot/version/amount/request ID only if absent. No automatic resend. | Reload/acceptance reads may fail; uncertain remains visible. Cross-session/navigation pending recovery not implemented. |
| Host clicks lacked pending/coalescing and fresh state reconciliation | Independent gate,44px controls,8s request bound, no automatic retry, bounded fresh room/sales/bids/squads/participants reads; exception feedback. Pause remains callable while bid pending in mocked test. | Backend host race guards unchanged; broad version guard does not yet support bid undo. |
| Tick transport error could leave driver locked or rapidly retrigger stale deadlines | finally releases driver,5s request bound,2s minimum retry spacing and projection invalidation. | Every member still independently drives deadlines/heartbeat; no elected driver introduced. |
| UNSOLD ignored by sales query; mutable lot/log parsing could select incorrect sale details | Query includes sold/unsold/undone sale rows. Exact sale IDs and row buyer/price supply frozen player snapshots; unresolved IDs consumed only after exact resolution; bounded eight-snapshot queue.2600ms celebration, undone removed, reconnect-time history suppressed. Last sold still latest non-undone sale with buyer. | More than eight unusually rapid sales drop oldest pending celebrations; authoritative log remains. Long room histories may exceed default query page; pagination not changed. |
| Fixed-bottom single-row reveal crowded price/name and competed with phone bid bar | Body portal above drawers, pointer-events:none, two-column wrap/second-line price, safe-area top placement. Local360/390/430/1280 demos visually checked. | Real authenticated SOLD/UNSOLD/reconnect/race checks blocked; demo is not multiplayer evidence. |
| Upcoming portraits unnecessarily high-priority | Only live stage keeps priority; upcoming/sale portraits lazy/normal. Existing override precedence and canonical shared URLs retained. | No fake srcset variants or claim of high-resolution replacement. |

## Requested backend features NOT implemented

Blocked by lack of isolated database:

1. Unlimited explicitly host-started shuffled eligible unsold rounds and round counters; end regular auction → FINAL CALL.
2. Member unsold browsing/nominations, deduplication/contention guards, host-open competitive final-call lots, explicit confirmed close-to-trades and nomination summary.
3. Separate latest ACCEPTED BID undo with observed bid/lot/version/state guard, retained audit history, preceding leader/price restoration and explicit deadline policy; existing last-sale undo retained.
4. In-play host settings sheet with bounded next-lot timer/extension and safe stage-specific settings. Existing settings RPC is lobby-only and resets purses; it was NOT reused during play or weakened.
5. Additive safe active-room state migration and old-client server-transition compatibility.

These require transactional database authority and real race verification, not frontend-only imitation. Existing one-time accelerated round and completed/trade behavior remain unchanged. New memory requirement supersedes old single replay for the eventual isolated implementation; architecture documents describe current code, not unimplemented functionality.

## Portrait inspection

Read-only browser image decoding of all150 canonical URLs through localhost asset serving, serial image loads (not production gameplay load): **150 decoded,0 failed**; widths112–480px, heights112–580px; **79 widths under200px**; none both dimensions≥600px. Examples: Aamer Jamal120×180; Bumrah480×349; Kohli480×349; Dhoni480×480; Inglis389×580.

At390px demo viewport Bumrah frame135×254 CSSpx needs approximately270×508 at2x:480×349 is insufficient vertically for the current crop. At1280 frame391×310 needs782×620: not met. Display/CSS cannot restore missing detail. No verified rights-cleared higher-resolution alternatives were established, no external URL fetch endpoint added, no downloaded replacement/media upload, no artificial upscaling, no fabricated2x `srcset`. Existing photos/provenance/admin overrides remain. Editorial-provider reuse permissions remain unresolved; Josh Inglis carries existing CC BY3.0 metadata. Full dimensions retained in `docs/post-launch-evidence/portrait-dimensions.json`.

## Exact checks / measurements

Environment: sandbox localhost:8080 Vite development preview; headless Playwright Chromium; no guest session restored, no signup, no room opened. Browser UI flow is landing's explicitly labelled local simulation only. Desktop1280×1800; phone widths360/390/430×1800. No artificial network throttling/CPU profile was run against the live backend.

| Command/check | Result |
|---|---|
| `bunx vitest run` | **63 passed,10 files**, final run7.58s. Includes100 blocked presses→one captured bid, no queued autobids, same-ID uncertain retry ordering, unknown reconciliation lock, exception containment,80ms fixed-window reads, one active+one trailing read, cleanup, sale snapshot identity/undo, UI pending/acceptance and independent/coalesced pause, countdown/profile isolation. |
| `python3 src/test/cricsheet-import.test.py` |4 passed; data logic only. |
| `python3 src/test/positions-import.test.py` |3 passed; data logic only. |
| `python3 /tmp/browser/post-launch/check_display.py` | Local demo bid→expiry→SOLD→restart at360/390/430/1280; zero page errors, no horizontal overflow, sale bounds fit each viewport; screenshots inspected. |
| `python3 /tmp/browser/post-launch/check_portraits.py` |150/150 canonical images decoded; dimensions above. |
| `/tmp/observability/build-errors.log` | Latest18:11:06Z **build OK** (automatic harness typecheck/build); intermediate exact-optional-type errors corrected. No manual build/typecheck. |
| Leaf route metadata inspection | All content routes including index retain unique Cricket Auction title/description/OG fields and twitter card. No route added or auth architecture changed. |
| `git rev-parse HEAD` | Actual saved revision above; no stateful git command. |

**Latency targets NOT established:** no ten independent authenticated teams, no sustained multi-lot/round bursts, no actual ACK p50/p95/max or host RPC timings, no cross-client convergence, request/error counts under real network, no slow-network uncertain transport/race integration, no authenticated mobile frame timings. `<100ms` visual target is supported only by synchronous pending-state source and mocked same-turn UI assertions, not measured real-device timing. `<1s p95 ACK` not measured and not claimed. Vitest durations are test runner times, not request latency.

**Remaining central-flow verification:** bid vs pause/skip/bid-undo/expiry/settings; repeated unsold/final call/contention/close-to-trades; zero overspend/double-sale under sustained load; real disconnect/reconnect across clients; old clients; member host denial. Existing old release fixture results are not reused as performance proof. Neutral50 leadership, missing coverage, approximate solver and frozen scoring histories were preserved; scorers/server authority untouched.

No claim of resolved production crashes or complete requested delivery: acquire a genuinely isolated test database before backend implementation and multiplayer profiling. No publication occurred.
