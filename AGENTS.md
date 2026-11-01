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
- Release actions bind bids to observed lot ID/version plus unique retry ID, and host actions to observed lot version/status/sale; legacy unbound RPCs are internal-only. Why: delayed requests and retries cannot mutate the next lot or refund twice.
- New rooms freeze the legal-reserve scoring patch separately from the V2.1 version; historical rooms retain their original optimizer. Why: guarantee legal shortlist reservations without changing existing scores.
- Direct RPC and table guards enforce bounded room settings, identity/notes/import fields and authenticated-only grants; persisted action quotas complement hosted auth limits. Why: UI validation is not a security boundary.
- Freeze confirmed player IDs as a server-shuffled first-round array at the locked review-to-auction transition; accelerated unsold IDs get a separate one-time array. Base rooms/pool tables are not client-readable or published in Realtime; member-only projections and revision doorbells hide future order in surprise mode. Why: shared retry-safe queue without network leaks or pool substitution.
- V2 freezes immutable evidence snapshots and player facts before review; trusted server functions compute final scores from persisted holdings and atomically commit a fingerprint-checked result. Legacy rooms keep V1. Why: no client-score trust or retroactive refresh changes.
- V2.1 uses its own pure scorer with frozen leadership reviews and immutable grouped-arrival position supplements; V2.0/V1 scorers remain unchanged. Public lineup writes lock the room, validate current ownership and distinct XI C/VC, and include ordered lineup in final fingerprints; invalid traded assignments use disclosed deterministic auto recomputation. Why: preserve historical scores and keep public evaluation separate from private strategy.
- Cricsheet importer preserves match revisions/hashes and per-innings legal-ball aggregates, reviewed stable identity mappings and source notices; data-only imports use CSV COPY, never migration seeds. Why: reproducible evidence and honest missing coverage.
- All game state mutations go through SECURITY DEFINER Postgres functions that lock the room row; clients never write room tables directly. Why: prevents double-winning bids and tampering.
- Timer deadlines live in the database (`lot_ends_at`, `review_ends_at`, `trade_ends_at`); clients only call `tick` after a deadline. Why: server decides outcomes; skew-corrected via `server_now`.
- Pure rule logic (increments, purse guard, pool builder, team rating) lives in `src/lib/auction-rules.ts` and is mirrored in SQL; keep both in sync and covered by `src/test/auction-rules.test.ts`.
- One room page (`/room/$roomId`) switches views by room status (lobby → review → auction → completed/trade → results). Why: a single realtime subscription per room.
- Admin rights come only from `public.user_roles`; never auto-grant.
- Canonical portraits match name and country and share one sourced asset across formats; database photo overrides take precedence. Why: preserve IDs and support owner replacement without duplicate media.
- Presentation deduplicates accepted bid IDs and sale event IDs and freezes resolved lot snapshots; sale reveals never block a new live lot. Why: avoid false bids, reconnect replay and next-player face mixups.
- Post-launch SQL stays in scripts/staged until verified isolated-backend installation; repair controls use a projection capability marker, observed control revision and lot/version, and command retry IDs. Why: absent RPCs never run on the shared live database and competing actions serialize safely.
- Repair rooms use explicit final-call/round/closed stages alongside existing room statuses; historical rooms retain the old advancement routine. Why: add unlimited host rounds without changing saved scoring or active historical auctions.
- Local repair tests connect explicitly to loopback port 55439 with synthetic catalogue and SQL identity claims, never managed PG environment variables. Why: isolate rule tests without pretending SQL identities verify hosted browser authentication.
- Live countdown state belongs to timer/bid controls; room presence updates only once per second. Why: clock ticks must not rebuild portraits, player tables or bid histories.
- Route all room reads through one fixed-window, per-table single-flight coordinator and discard old-room/old-lot responses. Why: sustained revisions must neither starve reconciliation nor launch overlapping read storms.
- Client bids capture one lot/version/amount/request ID; unknown transport outcomes lock new bids until reconciliation and explicit same-ID retry. Host commands have an independent single-flight gate and no automatic retry. Why: prevent delayed autobids and duplicate commands while retaining server authority.
- Sale rows supply immutable celebration IDs, buyer and price; queued snapshots resolve exact players, expire after 2600ms, skip reconnect history and remove undone sales. Render through a body portal. Why: keep repeated unsold events correct and prevent drawer/transform/sticky clipping.
