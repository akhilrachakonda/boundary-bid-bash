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
- All game state mutations go through SECURITY DEFINER Postgres functions that lock the room row; clients never write room tables directly. Why: prevents double-winning bids and tampering.
- Timer deadlines live in the database (`lot_ends_at`, `review_ends_at`, `trade_ends_at`); clients only call `tick` after a deadline. Why: server decides outcomes; skew-corrected via `server_now`.
- Pure rule logic (increments, purse guard, pool builder, team rating) lives in `src/lib/auction-rules.ts` and is mirrored in SQL; keep both in sync and covered by `src/test/auction-rules.test.ts`.
- One room page (`/room/$roomId`) switches views by room status (lobby → review → auction → completed/trade → results). Why: a single realtime subscription per room.
- Admin rights come only from `public.user_roles`; never auto-grant.
