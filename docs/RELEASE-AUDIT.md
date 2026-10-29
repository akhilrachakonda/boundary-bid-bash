# Cricket Auction release audit — 2026-10-29

## Verdict
**Release preparation completed; not published. Conditional release, not an unconditional security certification.**

No demonstrated critical/high exploitable application vulnerability remains in the audited paths after fixes. Main two-guest auction/trade flow and an eleven-player public-lineup/canonical-results flow pass. Remaining production verification and owner-positive checks below prevent claiming every requested check passed. Photo redistribution clearance remains unresolved.

Audited source revision before this report: `d8f8456c57e7ea2527daffbb0cceab71556c655b`. This is an actual harness-managed commit, not a newly fabricated release commit. The final documentation commit is assigned by Lovable after edits; capture it with `git rev-parse HEAD` at deployment. No commits, credentials, or privileged roles were manually assigned.

## Significant findings and fixes
| Severity | Finding | Fix / verification |
|---|---|---|
| High | Unauthenticated direct host RPCs bypassed `host_id <> auth.uid()` because NULL does not satisfy the rejection | Null-safe host predicates; revoke PUBLIC/anon execution for every public RPC. Five anonymous host denial checks and member/nonhost checks passed. |
| High / core flow | Delayed room+amount bid could purchase the next equal-price player | New overload requires lot ID, monotonic lot-opening version and request UUID. Unbound legacy overload revoked from clients. Equal-price stale bid and stale host skip rejected in browser regression. |
| Core flow | Duplicate bid retry/undo could target changed state | Unique participant/request ID returns the accepted bid on retry; host actions require observed room status/version and undo sale ID. Concurrent bid race yielded one winner; duplicate acceptance one winner; sale refund/reconnect checked. |
| Core scoring | Overseas-heavy shortlist could omit a legal domestic bowling XI | New-room-only `legal-reserve-1` scoring patch reserves a feasible legal XI before bounded search. Regression passes for 25 players. Earlier V1/V2/V2.1 rooms retain original solver; this historic limitation is disclosed. |
| Integrity | Fingerprint read followed holdings/lineup reads | Fingerprint now read before mutable holdings/lineups; final locked commit rejects changes after that fingerprint. Read errors fail closed rather than freezing an empty fallback. |
| Abuse | Missing direct-RPC bounds and quotas | Settings capped at 8 KiB, 2–10 teams, 1–25 squad, positive bounded increments, timers, purse and fixed .2 reserve. Pool 150; create 5/hour; join 30/minute with indistinguishable unavailable/full/started responses; bid 120/minute; evaluation 20/minute. Join denial quota persists because it returns NULL. Rejected transactional bid calls roll back quota increments: accepted-bid quota is not a complete invalid-request flood defense. |
| Abuse/integrity | Trade proposal not room-locked; unbounded arrays/cash/counter parent | Room lock, 25 players per side, bounded finite cash, same-room counter identity and 20 proposals/minute. Existing acceptance locks, ownership/purse/role checks retained. |
| Hardening | Excess table CRUD grants, mutable function search paths | All 22 public tables RLS-enabled; anon no table reads; direct game/evidence/result/role writes revoked. Only admin-RLS players and owner-RLS private notes retain client writes. Queue tables cannot be read by members. No SECURITY DEFINER has anon execute or an unset search_path. |
| Hardening | Unsafe photo source schemes and oversized notes/imports | HTTPS/source constraints and render guard; names/colors/notes/targets/XI byte bounds; database import 30 MiB/500 identities/30,000 matches/1,500 positions; leadership source/rationale bounds. Server request body capped before deserialization at 32 MiB. No arbitrary user URL is fetched server-side. |
| Dependencies | Production serialization/schema/YAML/source-map advisories | Patched zod 4.6.6, seroval 1.6.11, js-yaml 4.3.2, source-map-js 1.2.2; patched Vite, editor/shell tooling. Final production scan: zero known advisories in 53 packages. |
| Smoothness | Duplicate room projection and 10 Hz whole-room work; stale sale batches/timer cleanup | Removed duplicate initial/focus projection, reduced whole-room clock to 4 Hz, consumed batched sale IDs latest-resolvable-only and cleaned accepted-bid timer. Full timer isolation remains an optimization, not measured as a release blocker. |

Applied changes are migrations `0015`, `0016`, `0017`; schema presence, actual grants, import guard and null-safe host definitions read back from the live database. Existing auctions were not rewritten. Clearly labelled test fixtures remain; no destructive cleanup was performed. Early test runs used default test names before explicit RELEASE TEST labels were added.

## Exact checks and outcomes
Commands were run from `/dev-server`; browser scripts use local preview and separate Chromium contexts.

| Command / tool | Final result |
|---|---|
| `bun install` | Passed; patched lockfile installed |
| `bunx vitest run` | **51 passed, 8 files** |
| `python3 src/test/cricsheet-import.test.py` | **4 passed** |
| `python3 src/test/positions-import.test.py` | **3 passed** |
| `python3 src/test/release.integration.py` | Passed fresh guest signups, UI create/join, member isolation, concurrent starts, surprise network projection, 360/390/430/1280 widths, concurrent bids, retry, equal-price stale rejection, last sold/reload/undo, trade double acceptance and shared canonical results; zero page errors |
| `python3 src/test/release-lineup.integration.py` | Passed 11 real auctions, public save/reorder, distinct C/VC, ownership denial, 20-over valid XI, neutral 1.5+1 leadership, immutable final lineup and identical results across clients |
| `python3 /tmp/browser/release/check_security.py` | Passed five direct anonymous host RPC denials, no role self-escalation, private notes/targets/XI isolation, ten isolated guest teams, generated/confirmed 150-player pool, auction, reduced-motion keyboard dialog escape, route/admin-denial checks; retained as `src/test/release-security.integration.py` |
| `python3 src/test/evaluation-history.integration.py` | Three persisted V2.0 room results unchanged |
| `bun /tmp/cricket-audit.ts` | Original historic shortlist omission reproduced; single-run local V2.1 14/18/25-player timing 175/138/160 ms (neutral evidence); new patch regression separately passes |
| `security.dependency_scan` | **0 production vulnerabilities, 53 packages**, repeated after final updates |
| `bun audit` | **10 remaining development-only advisories**: 7 high, 3 moderate in lint brace-expansion and an old Drizzle esbuild development server; no demonstrated published-game path. Not suppressed. |
| Platform security scan | Complete; seven broad-read/guest findings remain. Leadership read is rated error by scanner; triaged as intentional shared rubric/source disclosure, not private gameplay exposure. Evidence/catalogue shared read and device guest policies are required. Wiz skipped: connector not configured. Findings not dismissed. |
| Database linter | 66 initial → 46 after hardening; mutable search paths and anonymous-definer warnings removed. Remaining authenticated-definer/guest-policy warnings are expected guarded game RPCs; action_limits no-policy is intentional locked storage. |
| `/tmp/observability/build-errors.log` | Latest harness build **OK** after edits. Manual build/typecheck not run because this environment delegates them to the harness. No independent production Worker/bundle result claimed. |

Failures encountered and corrected: browser filled nickname before hydration (test sequencing corrected); attempted one-player gift correctly failed minimum-squad guard (fixture gained another player); request-body reconstruction caused server POST failure (corrected Request URL construction and reran lineup); quota correctly stopped repeated fixture creation (fresh isolated test guests used); lineup effect now reacts to post-auction status.

## RLS / exposed endpoint inventory
Reviewed actual policies/grants for every public table and definitions/grants for every public function, not only UI calls.

- `rooms`, `room_players`: no authenticated direct read/write; member-only projection strips random arrays and zeros surprise ordinals. Not Realtime-published.
- `participants`, `bids`, `sales`, `squads`, `trades`, `room_events`, `room_updates`, `evaluation_lineups`, `room_evaluation_inputs`, `room_evaluations`: member-only read; client direct writes denied.
- `private_notes`: own-user reads/deletes; own-member inserts; update membership and bounded payload guard. Private strategy never converted to public evaluation XI.
- `players`: signed guests can scout; writes require actual `user_roles` admin via RLS.
- `user_roles`: own-role read only; no client write or auto-promotion.
- `evaluation_snapshots`: validated shared reads (or admin); immutable. `evidence_matches`, `evidence_innings`, `evidence_players`, `evidence_positions`, `leadership_reviews`: intentionally shared evidence reads, no guest/client writes; immutable frozen-input and position insertion guards retained.
- `action_limits`: no client grants/policy, internal security-definer use only.
- RPCs: host settings/pool/review/trade-open and host control null-safe; bids/lineups/trades/tick/transfer/projection/hash verify membership; team/heartbeat scope `auth.uid`; role check is read-only; importer/leadership verify admin. Internal shuffle/advance/resolve/log/counts/commit and unbound actions not client executable. Pure numeric helper RPCs contain no private data.
- Realtime publication contains participants, bids, sales, squads, trades, events, revision doorbells only. No queue, seeds, notes, or frozen private state publication.
- Private portrait bucket: 5 MiB server size cap; admin-only object select/insert/update/delete. Browser accepts JPEG/PNG/WebP but bucket MIME allow-list is unset; server MIME/signature enforcement remains an admin-upload hardening gap, not accessible to a guest. Existing ten-year signed portrait links are bearer-accessible by design for public portraits, not private documents.

## Remaining gates / limitations
**Do not call this a fully verified public release until these are consciously resolved/accepted:**

1. **Photo redistribution clearance**: 150 identity-matched portraits reused over 450 rows; many editorial providers have no verified reuse permission. Some portraits are visibly low resolution. Coverage is not licensing clearance; no invented replacements were introduced.
2. **Owner-positive paths**: zero admin identities. Photo upload/edit, successful evidence import and reviewed leadership save were not positively exercised; denial paths pass. No arbitrary role, credential or owner fixture was assigned. Rollback admin tooling was unavailable without persistent privileged changes.
3. **Deployment checks**: no publication requested now. Production Worker runtime, minified-client secret scan, bundle size/cold-load metrics, production build/typecheck output, and final deployed auth return URL remain unverified. Source boundaries showed no private keys/service client imported into browser modules; this is not a production-bundle secret audit.
4. **Auth URL review**: hosted Site URL and redirect list read successfully; current Site URL is preview, managed addresses allowed. Code builds email returns from `window.location.origin`. Final public/custom-domain return must be reviewed after deploy. No test email was sent.
5. **Abuse**: user quotas do not prevent Sybil guest creation or all invalid-request floods; hosted per-IP/gateway limits and request timeout behavior were not independently verified. Import raw nested objects are byte bounded, not cryptographic source validation. Public schema RPC JSON parsing occurs before database byte guards.
6. **Not individually re-exercised**: every role/purse/overseas/max-squad branch against the database; full expired/overlapping-trade scenarios; all-disconnected recovery/host takeover; double tick at actual sale boundary; fresh UNSOLD animation/accelerated sequence; touch-target minimums/focus trapping/animation frame counts/CDN health for all150; worst-case sourced 10-team×25-player CPU, production render/network churn. Unit/source checks and earlier integrations cover parts, not a fresh pass claim.
7. **Scoring history**: V1 source unchanged; three V2.0 persisted histories checked. All historical V2.1 results were not exhaustively compared. Earlier unpatched rooms keep the disclosed shortlist omission to preserve historical scoring. New solver is feasible-reserve approximate, not globally optimal.
8. **Data honesty**: all450 implicit C/VC entries remain neutral50; six evidence-only reviews, zero numeric owner reviews. Position coverage IPL140/T20149/ODI121; performance history IPL142/T20150/ODI122; missing evidence, Afghanistan gaps, provisional labels and source cutoffs remain visible.

Screenshots and selected exact command output: `docs/release-evidence/` (mobile widths, desktop, reconnect/last sold, ten-team auction, canonical results). Runtime traces of corrected failed attempts remain in `/tmp/browser/release/`; no session files or secrets are committed.