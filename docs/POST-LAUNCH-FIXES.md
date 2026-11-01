# Reconciled draft status — 2026-11-01

The existing draft has now recovered its client repairs alongside main's newer
capability-gated controls, lean projection and licensed Kohli portrait improvement.
Neither report below is silently replaced: they are historical records of separate
verification runs, not current combined-source verification or production proof.
The 2600ms draft queue duration is retained over main's 2700ms duration because both
meet the required 2–3 seconds and the draft's queued reveal behavior stays exact.
Generated Python bytecode retains main's copies; source importer changes are unaffected.

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
