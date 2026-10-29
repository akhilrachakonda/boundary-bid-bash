<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Project rules
- Freeze confirmed player IDs as a server-shuffled first-round array at the locked review-to-auction transition; accelerated unsold IDs get a separate one-time array. Base rooms/pool tables are not client-readable or published in Realtime; member-only projections and revision doorbells hide future order in surprise mode. Why: shared retry-safe queue without network leaks or pool substitution.
- V2 freezes immutable evidence snapshots and player facts before review; trusted server functions compute final scores from persisted holdings and atomically commit a fingerprint-checked result. Legacy rooms keep V1. Why: no client-score trust or retroactive refresh changes.
- Cricsheet importer preserves match revisions/hashes and per-innings legal-ball aggregates, reviewed stable identity mappings and source notices; data-only imports use CSV COPY, never migration seeds. Why: reproducible evidence and honest missing coverage.
- All game state mutations go through SECURITY DEFINER Postgres functions that lock the room row; clients never write room tables directly. Why: prevents double-winning bids and tampering.
- Timer deadlines live in the database (`lot_ends_at`, `review_ends_at`, `trade_ends_at`); clients only call `tick` after a deadline. Why: server decides outcomes; skew-corrected via `server_now`.
- Pure rule logic (increments, purse guard, pool builder, team rating) lives in `src/lib/auction-rules.ts` and is mirrored in SQL; keep both in sync and covered by `src/test/auction-rules.test.ts`.
- One room page (`/room/$roomId`) switches views by room status (lobby → review → auction → completed/trade → results). Why: a single realtime subscription per room.
- Admin rights come only from `public.user_roles`; never auto-grant.
- Canonical portraits match name and country and share one sourced asset across formats; database photo overrides take precedence. Why: preserve IDs and support owner replacement without duplicate media.
- Presentation deduplicates accepted bid IDs and sale event IDs and freezes resolved lot snapshots; sale reveals never block a new live lot. Why: avoid false bids, reconnect replay and next-player face mixups.
