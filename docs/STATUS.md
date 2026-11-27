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

## Phase 1 (in progress, branch `phase-1`)

Built: core port (49 tests), schema + migration 0001 (applied to the shared DB), feed URL encryption with a
DB-stored key fingerprint guard, sync, extraction, the API, and the reader UI with shortcuts and bookmark
auto-clear.

Verified 2026-11-27:

- `bun run check` + `next build` pass (65 unit tests).
- Server end to end against the shared DB, with public feeds (deleted afterwards): import/re-import, ciphertext at
  rest, sync (18 added, 1 failing feed reported as `HTTP 404` with no URL), auto-sync skip, sync lease under
  concurrency, tree/list/paging (5 per page, no gaps or duplicates), extraction on open with feed-version
  fallback, full-text RSS used as-is, bookmark/clear/Undo, retention keeps bookmarks, Today view. No feed URL in
  any response.
- HTTP: every `/api/*` route is 401 without a token; cron is 401 without `CRON_SECRET` and 200 with it; CSP and
  security headers are present.

Still to check in a browser (needs a real login): import the real OPML, the reading flow, video playback,
keyboard shortcuts, auto-clear + Undo, narrow layout.

## Then

Phase 2: feed management (add by URL, rename/move/delete), OPML export, carousel, lightbox, typography.
