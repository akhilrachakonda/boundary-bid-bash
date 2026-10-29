# Post-deploy read-only review — Cricket Auction (boundary-bid-bash.lovable.app)

Only read-only checks were run. Nothing was changed.

## Findings

1. **Sign-in return paths: allowed.**
   - Site URL is `https://boundary-bid-bash.lovable.app`.
   - The allowlist includes `https://boundary-bid-bash.lovable.app/**`, plus the preview addresses.
   - Email links send users back to `window.location.origin` + a sanitised path (for example `/room/<id>`), so production links match `/**`.
   - Guest sign-in doesn't use a return address.
   - Open item: no custom domain is connected. If you add one later, check that it appears in the allowlist.
2. **Public scripts don't expose private keys.**
   - I fetched 16 public files (about 0.9 MB).
   - There are no JWT-shaped tokens, `service_role`, AI gateway keys or `sk-` keys.
   - The `sb_secret_` text appears twice, but both times it's only the library's prefix check (`startsWith("sb_secret_")`), not a key.
   - Only the publishable key appears, which is expected.
3. **Pages respond as expected.**
   - `/` and `/auth` return 200. `/join` returns 307 (redirect to sign-in). `/room/x` and `/admin` return 200 with in-app denial or loading.
   - Unknown paths return 404.
   - I didn't check browser console errors on the live site. I made no signed-in or bidding calls, by your instruction.
4. **Portrait storage bucket.**
   - `player-portraits` is private with a 5 MB limit.
   - **No allowed file types are set** at the storage level. Only the admin page limits uploads to images.
5. **OAuth server is off.** This is expected because the app doesn't use MCP or OAuth-provider features. No action needed.

## Proposed config changes (not applied; need build mode and your approval)

- **A. Limit portrait file types (recommended, low risk):** allow only `image/jpeg`, `image/png` and `image/webp` on `player-portraits`, and keep the 5 MB limit.
- **B. Optional:** look at live browser console errors with a signed-out visit only. No accounts or room actions.
- **C. Future custom domain:** after connecting it, check that the allowlist has gained the matching `/**` entry.

## Verdict

No credential exposure was found, and production sign-in return paths are allowed. Remaining hardening: storage file-type limits (A).
