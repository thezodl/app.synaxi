# Status

Last updated: 2026-11-27. Update this file whenever work lands or an open item changes.

## Shipped

| Branch    | What                                                                                                                                                                        |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `plan`    | Plan, status, agent notes                                                                                                                                                   |
| `phase-0` | Next 16 + bun + Tailwind/shadcn scaffold; Auth0 proxy + Bearer-only `/api`; Neon/Drizzle (`settings` table); PWA manifest + offline-fallback SW; CI + prod deploy workflows |

`phase-0` passes typecheck, lint, prettier, unit tests and `next build` locally. A dev-server smoke test with
placeholder Auth0 values gave: `/` → 307 to `/auth/login`; `/api/me` → 401 with no token or a junk one; the
manifest, SW, offline page and icons → 200 without auth.

## Phase 0 verification

Done (2026-11-27, local):

- One-time setup complete (Auth0, Neon, Vercel env pulled with `vercel env pull`).
- Logging in locally works, and the home page shows your Auth0 `sub` and `Database ok`. This proves Auth0 issues
  an RS256 access token for `https://synaxi.app/api` that `requireUser` accepts (spike 2).
- Setup gotcha (now in the README): the Auth0 API's **Application Access → User Access** must be set to
  Authorized for the app.
- The first DB query after idle took about 0.7s: Neon Free scales to zero after ~5 min, and the wake-up is
  unavoidable on the free tier.

Still to do:

1. Check which Neon branch `.env.development.local` points at (`dev`, not `main`).
2. Push `plan` → `main` and `phase-0`, open a PR, merge → first deploy via `deploy.yml`.
3. Log in at https://synaxi.app, try passkey sign-in, install the PWA from Chrome desktop, relaunch, and check
   you're still signed in.

## Next: Phase 1

Port `src/core` + tests, then the schema, URL encryption, OPML import, sync, views/list, reader, bookmarks,
retention cron and keyboard shortcuts.
