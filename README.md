# Travel Ledger — deploy to Cloudflare Workers

Static site + a tiny sync API, no login, works offline. Push to `main` on
GitHub and it redeploys itself.

## File map
```
public/index.html   the app (no external dependencies)
public/sw.js         offline cache for the page shell
worker.js            Cloudflare Worker: serves the site + /api/ledger
wrangler.toml        Worker config (edit the KV id before first deploy)
```

## One-time setup (about 10 minutes)

1. **Push this folder to a new GitHub repo.**
   ```
   git init
   git add .
   git commit -m "travel ledger"
   git branch -M main
   git remote add origin https://github.com/<you>/travel-ledger.git
   git push -u origin main
   ```

2. **Create the KV namespace** (stores the shared ledger data).
   - Cloudflare dashboard → Workers & Pages → KV → Create namespace →
     name it e.g. `travel-ledger-kv`.
   - Copy its ID, paste it into `wrangler.toml` in place of
     `REPLACE_WITH_YOUR_KV_NAMESPACE_ID`, commit and push.

3. **Connect the repo to Cloudflare Workers.**
   - Cloudflare dashboard → Workers & Pages → Create → Workers →
     Import a repository → pick your GitHub repo.
   - Cloudflare reads `wrangler.toml` automatically and sets the build/deploy
     command for you. Accept the defaults and deploy.
   - From now on, every `git push` to `main` redeploys automatically.

4. **Open the site.** Cloudflare gives you a free URL like
   `https://travel-ledger.<your-subdomain>.workers.dev` — that's the link
   to share. No login, no app install. A custom domain can be added later
   in the same dashboard page if you want one.

## How offline + sync works
- Every edit is saved to the browser's local storage immediately, so the
  page keeps working with zero connection.
- In the background it also `PUT`s to `/api/ledger`, which is backed by
  the KV namespace — that's what lets both of you see the same numbers.
- If a save happens while offline, it's kept locally and re-sent the next
  time the app detects a connection.
- The service worker (`sw.js`) caches the page itself, so it still opens
  even with no signal at all — just possibly showing the last-synced data
  until you're back online.

## Note on privacy
There's no login, so anyone who has the site's URL can view and edit the
ledger — that's the trade-off for skipping accounts. Don't share the link
beyond the two of you.
