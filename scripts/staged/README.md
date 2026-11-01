# Post-launch development migrations

Production installation was explicitly authorized and completed on2026-11-01.
`0018_post_launch_auction_controls.sql` is now registered in
`drizzle/migrations/0018_post_launch_auction_controls.sql`; **DO NOT APPLY THIS
STAGED COPY AGAIN**. It remains historical isolated-test evidence only. The
registered copy differs only by a final newline. Production-specific inherited
ACL hardening is registered as0019. See `docs/POST-LAUNCH-FIXES.md` for hashes,
installation evidence and preserved historical records. Local disposable tests
may still load the staged copy into fresh isolated databases only.

`0018_post_launch_auction_controls.sql` adds the capability marker, guarded host
commands, final-call nominations, unlimited explicit rounds, bid undo history,
next-lot timers and lean projections. Existing rooms keep their old progression;
new rooms use it automatically once this migration is installed. Scoring is not
changed. Existing-room opt-in is deliberately not implemented.