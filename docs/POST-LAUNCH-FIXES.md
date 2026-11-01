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