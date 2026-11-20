# IPL reservations, rating feedback and mobile layouts

New IPL rooms require a unique franchise selection at creation/join. Room-row locks serialize reservations, and a partial unique index enforces one participant per franchise. Failed claims preserve the previous selection; failed joins roll back membership. Rejoining preserves the existing claim. Legacy rooms keep their names unless the host enables IPL teams in the lobby. Team changes close when the lobby ends. All ten canonical names map to the existing team audio assets.

Opponent ratings accept an optional 500-character plain-text comment. Each target sees its received scores, authors and comments during voting; all breakdowns become visible when voting closes. Self-votes remain forbidden. Category averages and finalization rules are unchanged. Raw vote tables remain inaccessible to participants; the member-only projection controls visibility.

Phone layouts use a compact navigation menu, top-of-lobby team selection, card-based pool/results views, full-width auction statistics, compact team rails and a safe-area-aware bid bar. Desktop layout proportions remain unchanged.

Validation on 13 November 2026:
- 87 Vitest tests passed, including franchise availability, sound mappings, optional comment submission and escaped feedback rendering.
- Isolated PGlite migration/gameplay suite passed: duplicate claims, failed-join rollback, release/reclaim, canonical identity protection, unclaimed-team start rejection, post-lobby locking, comment bounds, target-only visibility, final disclosure, legacy compatibility, bid retries, trades and XI plans.
- TypeScript and production build passed.
- Production migration applied transactionally with before/after fingerprints preserving every pre-existing room, participant and vote field.
- Real-browser visual validation is not complete: local Chromium failed to launch because its process-singleton socket was not permitted. No hosted gameplay fixtures were created; real-phone layout/audio behavior still needs testing.

## Mobile room checks, 20 November 2026

The live bid controls now keep the player name, remaining time and bid amount together as the player scrolls. Career statistics can be expanded on small screens. Returning to the room refreshes the clock and current lot. A tab that reloads before receiving a bid confirmation restores the original request and offers to check it.

Chromium and WebKit rendered the auction components with the production CSS at 320 × 568, 390 × 844, 412 × 915 and 844 × 390 CSS pixels. At all four sizes the bid button remained reachable after scrolling, measured at least 48 pixels high, and passed the tap hit test. The budget popover opened on tap, and the page had no horizontal overflow.

The two-page browser fixture used a simulated room service. At 390 × 844 both engines handled going offline, returning online, and reloading after a lost bid acknowledgement. Checking the stored request showed one bid submission. A returning page also displayed the next player and the other participant’s bid. Chromium used a frozen page for the return test. WebKit used page lifecycle events. Physical devices and hosted multiplayer latency remain untested.
