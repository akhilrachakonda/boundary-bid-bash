# Host controls and opponent-rated teams

New rooms use `create_social_room`. Existing rooms retain their scoring/trade rules; a host can opt an existing lobby into the new flow before play. Historical evaluation code remains available for historical rooms.

## Pool selection

Random pools target 70% Marquee/A, 20% B and 10% C/Uncapped. Sampling is seeded and considers the configured role minimums. For the original 273-entry catalogue, 52 available top players give a 52/38/10 split for 100 selections. The classic IPL extension adds 18 top-tier picks, making 70/20/10 possible.

A too-small request is raised to fit room squad requirements. Catalogue shortages and unusual role requirements are disclosed with actual counts. Hosts can override the generated selection by searching the full room catalogue and adding/removing players before confirmation. Manual edits still need to meet the room's pool requirements and can change the tier mix. Server membership and pool validation remain authoritative.

## Trade, XI, ratings

The host sets trade and XI-selection durations, each 1–120 minutes, and can reset remaining time during the corresponding stage. Closing or expiring trades opens private XI selection. Community trades retain ownership, mutual acceptance and nonnegative purses, but impose no squad-size, role or overseas restrictions.

Each team submits an ordered XI, expected batting-over ranges (overlap allowed), and whole bowling overs. IPL/T20 use 20 total and at most 4 per player; ODI uses 50 and at most 10. There are no role/overseas restrictions on the XI. A squad with fewer than 11 players submits all available players and is visibly incomplete; if it has fewer than 5 players its bowling capacity is also shown as incomplete. No nonexistent or unowned players are silently added.

Only the owning participant can read their saved plan until every team confirms, the timer ends, or the host reveals early. Saved unconfirmed drafts are then shown explicitly as drafts. Unsaved edits are not submitted. Teams rate every other team in three 1–10 categories: top order, middle/finishing, and bowling. The database rejects self-votes and nonmembers, allows one updatable vote per rater/target, and shows received votes and comments to their target. Voting must finish before everyone can see the full breakdown and overall results. All votes submitted ends voting automatically; the host can explicitly finish with missing votes.

Each category is the mean of submitted opponent votes. Overall is the equal-weight mean of those three categories. Missing votes are excluded; a team with no votes is unrated. Results show voter counts, and equal scores are ties. Existing automatic evaluation is not invoked for community rooms.

## Bidding resilience

Room changes are batched over a fixed 240 ms window. Clients use the room revision for bid notifications, discard already-applied revisions, and skip unchanged room payloads. Log refreshes are bounded rather than requested per bid. Timer work is staggered across participants; PostgreSQL ticks skip a busy room row instead of queueing behind bids. Room reads index frozen player facts once instead of rescanning the whole array for every player. A successful read restores the connected state after a transient HTTP read failure when Realtime is healthy. Five-second polling reconciles missed changes.

Existing lot/version/request-ID checks, server deadlines and unknown-outcome retry handling remain in place. These changes address observable request amplification and latency spikes; they are not proof that all hosted outages have been eliminated. Production multiplayer load and real-device browser/audio behavior require observation in actual use.

## Returning to a room

Guests can open **Save your guest seat** to link an email or generate a private, single-use recovery code. Save the code before leaving the original browser. On another device, enter the room code on the join page, choose **Recover my guest team**, and enter the private code. Recovery preserves the team, purse, squad and host role. Generating another code replaces the previous one. After linking an email, use that email to sign back in.

A visible tab refreshes immediately when it regains focus or connectivity. During a socket reconnect, online players can still submit a bid against the displayed lot. The server checks the lot, price and deadline. Members can confirm a host takeover two minutes after the host’s last heartbeat.

Migration `0033_room_recovery_and_bid_updates` enables seat codes, enforces the host grace period, and adds compact bid responses. Each response carries a pool revision. A client with that revision receives room data and current-lot bids. A client that missed a pool change receives updated pool states.

## Verification

`npm test`, `npx tsc --noEmit`, and `npm run build` cover the app. `scripts/test-community-local.mjs` uses isolated embedded PostgreSQL to test the migration, legacy frozen projections, custom stage timers, unbalanced trades, private lineups, deadlines, self-vote rejection, duplicate/updatable ratings, averages, missing votes, and repeated stale-price/duplicate-ID bids. Embedded PostgreSQL serializes connections, so this is a correctness burst test, not a hosted concurrent-capacity benchmark.

Apply migration 0029 through the existing managed journal; no player-data import is needed for this release.

Release verification on 12 November 2026: 84 application tests, TypeScript, production build, catalogue regression tests and the isolated community-flow tests passed. Migration 0029 was applied transactionally and recorded in the managed journal. A before/after fingerprint check verified that existing room rows were unchanged apart from the new defaulted columns. Member API access and denial of anonymous/raw-draft access were checked live. No hosted gameplay fixtures were created.

## Classic IPL catalogue and stage reopening

Apply journal migration 0032, then run `scripts/ipl-classics-import.sql` after the base Crick Auction import is present. The classic edition adds 18 retired players to the 273-entry IPL catalogue. Names were checked against [IPL 2013 squads](https://www.iplt20.com/news/article/teams-announce-squads-for-ipl-2013), [2012 captain appearances](https://www.iplt20.com/news/article/quick-stats-match-64-dd-v-kxip) and [2012 opening night captains](https://www.iplt20.com/news/article/white-to-represent-dc-on-opening-nite). The classic entries share a game rating of 85, tier A and an opening price of 2 crore. They carry no invented career totals. Existing rooms keep their pinned catalogue.

Hosts in community rooms can reopen unsold nominations during or after trading, return from results to trading, or reopen XI selection after voting starts. Accepted trades stand. Returning to trading or unsold nominations expires pending offers and clears team plans and ratings. Reopening XI selection retains plans as private, unconfirmed drafts and clears votes.
