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

## Player portraits
- `src/data/player-photos.json` is the canonical name + country catalogue for all 150 identities, reused across all 450 format entries. It includes cached asset URLs, original provider URL, source profile and credits.
- `src/data/player-photos-backfill.sql` is a reproducible data update, not a schema migration. Apply through Lovable's database data-write tool after schema migrations; never run it at page load.
- Every selected image was downloaded, decoded and visually checked; 30 provider shirt/silhouette placeholders were replaced with actual portraits.
- Most photos are editorial provider assets with **no verified open reuse licence**. Attribution is not permission; obtain permission or replace with licensed portraits before public distribution. Josh Inglis is CC BY 3.0, Prime Video AU & NZ.
- Owner photo URL/source/credit editing and replacement upload are in `/admin`; photo replacements update all format rows for the same identity. The workspace blocks public storage buckets, so uploads use a private bucket and long-lived signed sharing links. Only existing owner admins may upload/edit; links expire and may need replacement.

## Upgrade verification
- Desktop and 390px mobile auction: accepted bids, first SOLD with correct frozen portrait, next live lot, UNSOLD, pause, no sale replay on reload, strategy/squad drawers, reduced motion, broken-image fallback.
- 24 local tests plus 26 live backend invariant checks passed (concurrent bids, membership/private-note isolation and atomic trades).
- Positive owner upload/edit flow remains unverified because no owner admin identity is assigned; non-admin editing was confirmed ineffective.
- Project workspace display name could not be changed with available tools; in-app branding, page metadata, favicon and exports use Cricket Auction.

## Deploying
Click **Publish** in Lovable. To host elsewhere (e.g. Vercel), export the repo, set the two `VITE_SUPABASE_*` variables, and run `bun install && bun run build`.
