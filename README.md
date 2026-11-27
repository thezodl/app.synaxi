# Synaxi Web

A simple, online-first, desktop-first PWA RSS reader for one user, at **https://synaxi.app**. Built with
Next.js 16 (App Router) on Vercel Hobby, using Neon Postgres (Free), Drizzle and Auth0. It's the web sibling
of the Expo app in `../app.synaxi.mobile`.

- [docs/PLAN.md](docs/PLAN.md): decisions, architecture, phases
- [docs/STATUS.md](docs/STATUS.md): what's shipped, what's next
- [AGENTS.md](AGENTS.md): rules for coding agents

## How auth works

```
browser ──/auth/*──▶ proxy.ts (Auth0 SDK: login, callback, logout, /auth/access-token)
browser ──page────▶ proxy.ts: no session → redirect to /auth/login; else static app shell
browser ──/api/*──▶ route handler: requireUser() verifies the Bearer access token (JWKS, iss, aud)
```

The session cookie only mints access tokens. `/api/*` accepts **only** `Authorization: Bearer <token>`, which
is the same path the mobile app will use later. Single-user is enforced in Auth0 (sign-ups disabled).

## One-time setup

### 1. Auth0

1. **Applications → Create Application → Regular Web Application** ("Synaxi").
   - Allowed Callback URLs: `https://synaxi.app/auth/callback, http://localhost:3000/auth/callback`
   - Allowed Logout URLs: `https://synaxi.app, http://localhost:3000`
   - Allowed Web Origins: `https://synaxi.app, http://localhost:3000`
   - Advanced → Grant Types: Authorization Code, Refresh Token (and Passkey, if listed).
   - Refresh Token Rotation: **on**.
   - **Connections tab: enable only the database connection.** New tenants often enable Google by default. Turn
     it off, because the tenant is the only single-user guard.
2. **APIs → Create API** ("Synaxi API"): identifier **`https://synaxi.app/api`**, signing algorithm RS256.
   Turn **Allow Offline Access** on, so refresh tokens are issued for this audience. Leave token encryption (JWE)
   off, because the API verifies plain RS256 JWTs.
3. **Authentication → Database → Username-Password-Authentication**:
   - **Disable Sign Ups: on.**
   - Authentication Methods → Passkey → enable.
4. **User Management → Users → Create User**: your email and a password. Enrol a passkey at your first login.

_To verify:_ passkeys on Auth0's hosted Universal Login. The SDK guide says the _headless_ passkey API needs an
Auth0 custom domain, but we use Universal Login, where Auth0 runs the passkey ceremony itself.

### 2. Neon

1. Create a project (Postgres 17+, region close to Vercel's `iad1` unless you change that).
2. Create a `dev` branch for local work. Copy the **pooled** and **unpooled** connection strings for both
   `main` (prod) and `dev`.

### 3. Vercel

1. Create the project (import the GitHub repo or run `bunx vercel link`). Git deployments are disabled in
   `vercel.json`, so GitHub Actions does the deploys.
2. Domains: add `synaxi.app` (apex). Point DNS at Vercel as instructed.
3. Environment variables (Production):

   | Name                  | Value                                    |
   | --------------------- | ---------------------------------------- |
   | `AUTH0_DOMAIN`        | `<tenant>.us.auth0.com` (no `https://`)  |
   | `AUTH0_CLIENT_ID`     | from the Auth0 app                       |
   | `AUTH0_CLIENT_SECRET` | from the Auth0 app                       |
   | `AUTH0_SECRET`        | `openssl rand -hex 32`                   |
   | `APP_BASE_URL`        | `https://synaxi.app`                     |
   | `AUTH0_AUDIENCE`      | `https://synaxi.app/api`                 |
   | `DATABASE_URL`        | Neon `main` **pooled** connection string |

### 4. GitHub Actions secrets

Settings → Secrets and variables → Actions (or a `production` environment):

| Secret                  | Where from                                                       |
| ----------------------- | ---------------------------------------------------------------- |
| `VERCEL_TOKEN`          | vercel.com → Account Settings → Tokens                           |
| `VERCEL_ORG_ID`         | `.vercel/project.json` after `bunx vercel link` (`orgId`)        |
| `VERCEL_PROJECT_ID`     | `.vercel/project.json` (`projectId`)                             |
| `DATABASE_URL_UNPOOLED` | Neon `main` **unpooled** connection string (used for migrations) |

## CI/CD

| Workflow     | Trigger            | What it does                                                         |
| ------------ | ------------------ | -------------------------------------------------------------------- |
| `ci.yml`     | PRs, push `main`   | typecheck, lint, prettier, `bun test`, `next build`                  |
| `deploy.yml` | CI green on `main` | `drizzle-kit migrate` on prod, then `vercel build` + `deploy --prod` |

`deploy.yml` can also be run by hand (`workflow_dispatch`). There are no PR previews for now (see the plan).

## Development

```bash
bun install
cp .env.example .env.local   # Auth0 values + Neon *dev* branch URLs
bun run db:migrate           # apply migrations to the dev branch
bun dev                      # http://localhost:3000
```

```bash
bun run check                # typecheck + lint + prettier + tests
bun run db:generate          # after editing src/server/db/schema.ts → commit the new drizzle/*.sql
```

The home page is a Phase 0 placeholder. It calls `/api/me` with your access token and shows your Auth0 `sub`
and a database round trip, which tests the whole stack.

## Layout

- `src/proxy.ts`: Auth0 routes + redirect to login for pages (Next 16's replacement for `middleware.ts`).
- `src/app/`: routes. `api/*` are JSON route handlers; `manifest.ts` is the PWA manifest.
- `src/server/`: server-only code. `auth0.ts` (SDK client), `auth.ts` (`requireUser`/`withUser`), `jwt.ts`
  (pure verifier, unit tested), `db/` (Drizzle schema + client).
- `src/client/`: browser code. `api.ts` adds the Bearer token to every API call.
- `src/core/`: pure TS ported from mobile (Phase 1).
- `public/sw.js`: service worker that only serves an offline fallback page; no data caching.
- `drizzle/`: generated, append-only SQL migrations.
