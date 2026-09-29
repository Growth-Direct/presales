# Pre Sales copy — read this first

This repo (Growth-Direct/presales) is a standalone copy of the Growth Reporting dashboard. It differs from the live one:

- **No sign-in.** Auth0, the session checks and the Google Workspace check were removed.
- **No live Zoho feed.** The Buyer tab reads a frozen snapshot, `public/buyer-snapshot.json` (JAS 2026 only), built by `scripts/build-snapshot.test.ts` from raw Zoho rows. Phone numbers in it are salted-hashed. Refreshing data means rebuilding that file, committing and pushing.
- **Tabs:** Buyer and Pre Sales (a placeholder until the charts are defined). Seller is hidden.
- Pushing to `main` here deploys to Vercel. Only push to `Growth-Direct/presales`, never to `truvahomes/growth-reporting`.

The metric definitions the charts follow are in docs/metric-skill/.
