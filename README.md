# Cricket Auction

Real-time IPL-style auction for friends: create a room, share the 6-character code, review a balanced player pool, bid live, trade, and compare teams.

## Stack
- TanStack Start (React 19 + TypeScript) + Tailwind v4, deployed by Lovable.
- Lovable Cloud backend: Postgres, Auth (guest + email magic link), Realtime, Row Level Security.
- No API keys in the frontend: the client reads `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY` from `.env` (managed by Lovable Cloud).

## How it works
- **Server authority.** Every state change (create/join room, set pool, bid, tick, host controls, trades) is a `SECURITY DEFINER` Postgres function that locks the room row (`FOR UPDATE`). Two simultaneous bids at the same amount serialise; the second gets "Someone bid first". Timer expiry is decided by `now()` in the database, never by the browser.
- **Tick driver.** Connected clients call `tick(room)` once the server deadline passes. If nobody was connected when a lot expired (deadline passed by >15 s), the lot timer restarts instead of resolving, so the auction effectively pauses when everyone leaves.
- **RLS.** Room tables are readable only by room members; direct writes are not granted (all writes go through functions). `private_notes` (targets, max prices, XI, notes) is readable and writable only by its owner. Players are readable by all signed-in users and editable only by admins.
- **Pool selection** (`src/lib/auction-rules.ts`): proportional quotas per sub-role, auto-raised to cover `teams × min squad` and per-role/spin/pace minimums, top-rated picks plus a tier spread, seeded random tie-breaks for "Regenerate". The database re-validates the pool in `set_pool`.
- **Team Rating**: Playing XI 50%, role balance 20%, combinations 15%, bench 10%, budget efficiency 5% (auto-picked XI for fairness).

## Owner admin setup
Only users with the `admin` role can edit the player database (no auto-grant). After you sign in with your email once, ask Lovable to run:

```sql
insert into public.user_roles (user_id, role)
select id, 'admin' from auth.users where email = 'you@example.com';
```

Then open **/admin** (shield icon in the header).

## Testing
- `bunx vitest run` — rules tests (increments, purse guard, pool requirements, rating).
- Two browser windows (one incognito) are the quickest way to try a full auction.

## Deploying
Click **Publish** in Lovable. To host elsewhere (e.g. Vercel), export the repo, set the two `VITE_SUPABASE_*` variables, and run `bun install && bun run build`.
