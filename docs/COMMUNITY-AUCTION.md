# Host controls and opponent-rated teams

New rooms use `create_social_room`. Existing rooms retain their scoring/trade rules; a host can opt an existing lobby into the new flow before play. Historical evaluation code remains available for historical rooms.

## Pool selection

Every Marquee/A player in the room catalogue is included in generated pools. The imported IPL catalogue has 52 such identities. Remaining slots target 80% B and 20% C/Uncapped: 100 players normally means 52 top + 38 middle + 10 low. Integer allocations round the middle count, with the balance going to low. Within those groups, weighted seeded sampling favours higher setup ratings while retaining variety. This is a game selection rule, not a claim about current professional ability.

A too-small request is raised to fit mandatory stars and room squad requirements. Catalogue shortages and unusual role requirements are disclosed with actual counts. Hosts can override the generated selection by searching the full room catalogue and adding/removing players before confirmation. Manual edits still need to meet the room's pool requirements and can change the tier mix. Server membership and pool validation remain authoritative.

## Trade, XI, ratings

The host sets trade and XI-selection durations, each 1–120 minutes, and can reset remaining time during the corresponding stage. Closing or expiring trades opens private XI selection. Community trades retain ownership, mutual acceptance and nonnegative purses, but impose no squad-size, role or overseas restrictions.

Each team submits an ordered XI, expected batting-over ranges (overlap allowed), and whole bowling overs. IPL/T20 use 20 total and at most 4 per player; ODI uses 50 and at most 10. There are no role/overseas restrictions on the XI. A squad with fewer than 11 players submits all available players and is visibly incomplete; if it has fewer than 5 players its bowling capacity is also shown as incomplete. No nonexistent or unowned players are silently added.

Only the owning participant can read their saved plan until every team confirms, the timer ends, or the host reveals early. Saved unconfirmed drafts are then shown explicitly as drafts. Unsaved edits are not submitted. Teams rate every other team in three 1–10 categories: top order, middle/finishing, and bowling. The database rejects self-votes and nonmembers, allows one updatable vote per rater/target, and hides individual votes and aggregate results until voting ends. All votes submitted ends voting automatically; the host can explicitly finish with missing votes.

Each category is the mean of submitted opponent votes. Overall is the equal-weight mean of those three categories. Missing votes are excluded; a team with no votes is unrated. Results show voter counts, and equal scores are ties. Existing automatic evaluation is not invoked for community rooms.

## Bidding resilience

Room changes are batched over a fixed 240 ms window. Clients use the room revision for bid notifications, discard already-applied revisions, and skip unchanged room payloads. Log refreshes are bounded rather than requested per bid. Timer work is staggered across participants; PostgreSQL ticks skip a busy room row instead of queueing behind bids. Room reads index frozen player facts once instead of rescanning the whole array for every player. A successful read restores the connected state after a transient HTTP read failure when Realtime is healthy. Five-second polling reconciles missed changes.

Existing lot/version/request-ID checks, server deadlines and unknown-outcome retry handling remain in place. These changes address observable request amplification and latency spikes; they are not proof that all hosted outages have been eliminated. Production multiplayer load and real-device browser/audio behavior require observation in actual use.

## Verification

`npm test`, `npx tsc --noEmit`, and `npm run build` cover the app. `scripts/test-community-local.mjs` uses isolated embedded PostgreSQL to test the migration, legacy frozen projections, custom stage timers, unbalanced trades, private lineups, deadlines, self-vote rejection, duplicate/updatable ratings, averages, missing votes, and repeated stale-price/duplicate-ID bids. Embedded PostgreSQL serializes connections, so this is a correctness burst test, not a hosted concurrent-capacity benchmark.

Apply migration 0029 through the existing managed journal; no player-data import is needed for this release.

Release verification on 12 November 2026: 84 application tests, TypeScript, production build, catalogue regression tests and the isolated community-flow tests passed. Migration 0029 was applied transactionally and recorded in the managed journal. A before/after fingerprint check verified that existing room rows were unchanged apart from the new defaulted columns. Member API access and denial of anonymous/raw-draft access were checked live. No hosted gameplay fixtures were created.
