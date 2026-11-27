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

## Waiting on the user (one-time setup, see README)

1. Auth0 tenant: Regular Web App, API `https://synaxi.app/api`, sign-ups off, **only** the database connection
   enabled for the app, passkeys on, your user created.
2. Neon project with `main` + `dev` branches.
3. Vercel project, `synaxi.app` domain, production env vars.
4. GitHub Actions secrets: `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`, `DATABASE_URL_UNPOOLED`.
5. Push `plan` and `phase-0`, open PRs, merge to `main` → first deploy.

## Phase 0 checks still to do (need real credentials)

- Log in locally and at https://synaxi.app; the home page shows your `sub` and `Database ok`.
- `/auth/access-token` returns an RS256 JWT, not JWE or opaque (spike 2).
- Passkey sign-in on Universal Login works without an Auth0 custom domain.
- Install the PWA from Chrome desktop, relaunch, and check you're still signed in.
- Spike 1 (Readability + linkedom in a Vercel function) moves to the start of Phase 1, together with the
  `src/core` port.

## Next: Phase 1

Port `src/core` + tests, then the schema, URL encryption, OPML import, sync, views/list, reader, bookmarks,
retention cron and keyboard shortcuts.
