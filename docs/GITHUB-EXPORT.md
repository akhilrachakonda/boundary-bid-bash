# GitHub export notes

## Current status (2026-11-02)

- No GitHub remote is connected. The checkout only has Lovable's internal sync remotes. Nothing has been pushed to GitHub.
- To export, use Lovable **Project settings → Git → Connect**. This creates a **new private** repository and syncs it both ways. Keep it private until the items below are done.
- Lovable keeps the repository history. Do not force-push or rewrite history.

## Tracked files and environment

- `.env` is **tracked** and managed by Lovable Cloud. It contains only public values: the backend URL, the project ID and the **publishable** key (`sb_publishable_…`). That key is meant to appear in the frontend bundle, and RLS plus function checks enforce access. No service-role key, database password or other private credential was found in `.env` or source. No credential rotation is needed.
- `.env` was deliberately left tracked and unchanged. Untracking or editing it could disrupt the managed configuration. The new `.gitignore` entries do **not** untrack files that are already committed.
- The private `SUPABASE_SERVICE_ROLE_KEY` exists only in the hosted runtime. It is not in the repository.
- Three Python bytecode files under `scripts/__pycache__/` and `src/test/__pycache__/` are still tracked. They are harmless, but they are noise. Removing them needs a normal file deletion commit. No history rewrite is needed.

## What code sync does not export

- The database data: rooms, users, bids, evidence. This also covers auth users, storage objects (owner photo uploads), secrets and auth settings.
- The repository contains the migrations (`drizzle/migrations/`) and the data scripts, so the backend can be rebuilt. Expect to rebuild it yourself.

## Asset licensing

- Most player portraits are editorial provider images with **no verified redistribution licence**. Attribution in `src/data/player-photos.json` does not grant permission.
- Some images do have open licences, for example Virat Kohli (CC BY-SA 4.0) and Josh Inglis (CC BY 3.0). Their attribution must be kept.
- Cricsheet data is covered by `docs/CRICSHEET-LICENSE.txt`.
- No blanket licence was added. A code licence, if you want one, must exclude third-party assets.

## Before making the repository public

1. Remove or replace the unlicensed portraits: the cached assets, `src/data/player-photos.json` URLs and the screenshots that show them. The alternative is to get permission for them. Also check whether those assets remain in git history.
2. Optionally delete the tracked `__pycache__` files.
3. Review `docs/` evidence files. Confirm they contain no personal data you don't want published.
4. Choose a licence for your own code, if you want one, and state the asset exclusions.
