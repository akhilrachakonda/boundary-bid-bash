# Post-launch development migrations

These SQL files are deliberately outside the managed migration journal. They are
**unapplied to Lovable Cloud** and must not be applied to the shared production
database during repair testing. Apply through the supported migration tool only
after that tool is connected to a verified isolated backend, preserving the SQL
byte-for-byte. Local disposable PostgreSQL tests load them explicitly after the
existing schema migrations.

`0018_post_launch_auction_controls.sql` adds the capability marker, guarded host
commands, final-call nominations, unlimited explicit rounds, bid undo history,
next-lot timers and lean projections. Existing rooms keep their old progression;
new rooms use it automatically once this migration is installed. Scoring is not
changed. Existing-room opt-in is deliberately not implemented.