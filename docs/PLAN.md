# Synaxi Web: a simple, desktop-first PWA RSS reader

## Context

[Synaxi mobile](../../app.synaxi.mobile) is a local-only, offline-first Expo RSS reader for one user's Galaxy Z
Fold 7. This repo is its web sibling: a **simple, online-first PWA**, used mostly in a **desktop browser**,
hosted on **Vercel (Hobby)**. Login is through **Auth0**, data lives in **Neon Postgres (Free)**, and there is
exactly one user.

Unlike the mobile app, the web app has a server. Feeds are fetched and articles extracted **server-side** and
stored in Neon. The browser only talks to our own JSON API. That API is designed so the **mobile app can sync
against it later**, though not in v1.

Feeds come from the same Feedly OPML export (Feedly's API is Enterprise-only, so it's off the table).

## Confirmed decisions

| Area             | Decision                                                                                            |
| ---------------- | --------------------------------------------------------------------------------------------------- |
| Relationship     | Independent data for now; **shared backend later** (API and schema designed for a second client)    |
| Fetching         | **Server-side** in Vercel functions (no CORS problem, feed URLs never reach the browser)            |
| Offline          | **Online-first**. The service worker caches the app shell only                                      |
| Codebase         | **New app**; `src/core` **copied** from mobile and allowed to diverge                               |
| Framework        | **Next.js App Router**, single app at the repo root                                                 |
| DB               | **Neon Postgres + Drizzle ORM + drizzle-kit** migrations                                            |
| Sync timing      | **On open (debounced 15 min) + manual refresh**. No background fetching                             |
| Vercel plan      | **Hobby**. Stay inside free-tier limits                                                             |
| Auth             | **Auth0**, **email + password and passkeys**; single user enforced **in Auth0** (sign-ups disabled) |
| API auth         | **Bearer only**: every `/api/*` call carries an Auth0 access token, verified with JWKS              |
| Data access      | **Client components → `/api/*`** via TanStack Query. Server components only render the shell        |
| Feed URL secrets | **App-level AES-256-GCM encryption**; DB holds ciphertext + HMAC for uniqueness                     |
| Devices          | **Desktop browser** first (it should still work at narrow widths, but isn't optimised for them)     |
| UI               | **Tailwind + shadcn/ui**; light/dark/**system** (default) theme, chosen per browser in the menu     |
| Reader           | Server-sanitised HTML rendered **inline in a div**, with a strict CSP                               |
| Images           | **Loaded directly from the origin** (https-upgraded); no proxy                                      |
| IDs              | **UUIDv7** primary keys                                                                             |
| Retention        | **14 days** (bookmarks never purged), run by the daily Vercel cron                                  |
| Bootstrap        | **Upload OPML** through an import screen                                                            |
| Tooling          | **bun** (package manager + test runner)                                                             |
| Deploys          | **GitHub Actions** deploys to prod with the Vercel CLI. **No PR previews for now**                  |
| Domain           | **`synaxi.app`** (apex) on Vercel                                                                   |
| Single-user      | Enforced by the Auth0 tenant alone (sign-ups off). **No `sub` allowlist** in the app                |
| View original    | Toggle **extracted ⇄ RSS** content; "Open original" opens the page in a new tab (no iframing)       |
| Typography       | Font family (serif/sans/system), font size, line height, max line width. Code blocks stay mono      |

### v1 feature scope

From the mobile app's shipped features:

- Views: All, Today, Bookmarks, per folder, per feed. The rich list shows title, source, relative time, a 2-line
  excerpt and a thumbnail.
- Sync: conditional GETs (ETag / Last-Modified), concurrency 4, per-feed error state.
- **Full-text extraction**: when the RSS content is a summary, the server fetches the page, runs Readability and
  sanitises the result. It is cached in Neon.
- **Video embeds**: YouTube (`youtube-nocookie.com`) and Vimeo iframes inline.
- **Bookmarks with auto-clear**: the bookmark clears once the end of the article has been visible for about 1.5s
  (about 5s for short articles), with an Undo toast. There's no other read state, so no unread counts and no
  Unread view.

From the mobile backlog:

- **Feed management**: add by URL with `<link rel=alternate>` autodiscovery; rename, move and delete feeds and
  folders; per-feed error display.
- **OPML export**.
- **Reader polish**: carousel (explicit galleries, or 3+ consecutive images), lightbox, typography settings,
  view-original toggle.
- **Keyboard shortcuts** (new; desktop only).

Out of v1: offline reading, search, AMOLED theme, mobile sync, background fetching.

## Verified platform limits (checked 2026-11-27)

- **Vercel Hobby:** cron runs at most **once a day**, with ±59 min precision. More frequent expressions fail at
  deploy. Function duration defaults to 300s. Cron is being folded into "Schedules" (beta). Sources:
  [cron usage & pricing](https://vercel.com/docs/schedules/cron-jobs/usage-and-pricing),
  [Hobby plan](https://vercel.com/docs/plans/hobby).
- **Neon Free:** **1 GB storage per project** (raised from 0.5 GB in Oct 2026), 100 CU-hours/month, 10 branches
  per project. Over the cap, writes that grow storage are blocked rather than billed. Source:
  [free plan limits](https://neon.com/faqs/free-plan-limits-and-quotas).
  - Estimate: up to 200 articles/day × ~10–40 KB ≈ 2–8 MB/day, so 14-day retention keeps us around ≤120 MB.
- **Auth0:** wildcards are allowed in callback/logout URLs **for a whole subdomain level only**
  (`https://*.example.com`), and Auth0 advises against them in production. Sources:
  [wildcards for subdomains](https://auth0.com/docs/get-started/applications/wildcards-for-subdomains).
  This is why PR previews were dropped for now. If they come back, use a separate Auth0 app for previews.
- **`@auth0/nextjs-auth0` v4:** `getAccessToken()` works from client components. Pass the API `audience` when
  calling it, or you may get an opaque or encrypted token instead of an RS256 JWT. Source:
  [SDK reference](https://auth0.github.io/nextjs-auth0/).

## Stack

- **Runtime:** Next.js (latest stable at scaffold time, pinned), React, TypeScript strict, **bun**.
  All route handlers use the **Node.js runtime** (Readability + linkedom need it; no Edge).
- **UI:** Tailwind CSS + shadcn/ui (Radix), `lucide-react` icons, `sonner` toasts, Tailwind Typography
  (`prose`) for the reader. TanStack Query for server state.
- **DB:** Neon Postgres; Drizzle ORM + `drizzle-kit generate` (SQL migrations committed, append-only).
  Uses `@neondatabase/serverless`; multi-statement atomic writes use Drizzle `batch` / transactions.
- **Auth:** `@auth0/nextjs-auth0` v4 handles the login/session cookie and hands the client an access token;
  `jose` verifies Bearer tokens against the tenant JWKS in every API route.
- **Feeds/extraction:** copied from mobile `src/core`: `fast-xml-parser`, `@mozilla/readability`, `linkedom`,
  the allowlist sanitiser and the media/carousel grouping.
- **PWA:** `app/manifest.ts`, icons reused from the mobile `assets/`, and a small hand-written service worker
  that caches only the app shell and an offline fallback page.
- **Quality:** ESLint + Prettier, `tsc --noEmit`, `bun test` for `src/core` and the server logic.

## Architecture

```
src/
  app/
    layout.tsx               html shell, fonts, providers (QueryClient, Toaster), SW registration
    page.tsx                 the reader UI (client): sidebar | list | reader; view + article in the URL
    manifest.ts              PWA manifest
    auth/[...]               handled by the nextjs-auth0 middleware (login, callback, logout, access-token)
    api/
      me/route.ts                 GET  who am I (smoke test for auth)
      views/route.ts              GET  folders + feeds tree (no counts)
      articles/route.ts           GET  ?view=…&cursor=…  keyset-paginated list
      articles/[id]/route.ts      GET  article body (extracts on demand)
      articles/[id]/bookmark/route.ts   PUT (bookmark) / DELETE (clear, auto or manual)
      sync/route.ts               POST ?auto=1  fetch all feeds
      feeds/route.ts              POST add by URL (autodiscovery)
      feeds/[id]/route.ts         PATCH rename/move, DELETE
      folders/route.ts, folders/[id]/route.ts
      opml/route.ts               POST import, GET export (attachment)
      settings/route.ts           GET/PUT typography etc.
      cron/retention/route.ts     GET daily purge (Vercel cron, CRON_SECRET)
  core/                      COPIED from mobile; pure TS, no Next/React imports, unit tested
    feeds/ extract/ opml.ts retention.ts views.ts text.ts pool.ts __fixtures__/
  server/                    server-only modules (`import 'server-only'`)
    auth.ts                  requireUser(req): verify Bearer (jose + JWKS, iss, aud)
    crypto.ts                encryptUrl / decryptUrl / urlHmac
    http.ts                  fetchWithTimeout, conditional GET, http→https upgrade, sanitised errors
    sync.ts                  syncAll orchestration
    extract.ts               fetch page → Readability → sanitise → store
    db/schema.ts, db/index.ts
  client/
    api.ts                   fetch wrapper: getAccessToken({audience}) → Authorization: Bearer
    hooks/                   useArticles, useArticle, useBookmark, useSync, useKeyboard
  ui/                        Sidebar, ArticleList, ArticleRow, Reader, Carousel, Lightbox, shortcuts dialog
drizzle/                     generated SQL migrations (append-only)
public/sw.js, public/icons/
```

### Data model (Postgres)

All tables use `id uuid` (UUIDv7, generated in the app) and `created_at` / `updated_at timestamptz`.
`updated_at` is maintained on every write, so later mobile sync can pull deltas ("changed since").

- **folders**: `name` (unique), `position`.
- **feeds**: `url_enc bytea` (AES-GCM), `url_hmac bytea UNIQUE`, `title`, `site_url`, `folder_id → folders ON DELETE SET NULL`,
  `position`, `etag`, `last_modified`, `last_fetched_at`, `last_error`.
- **articles**: `feed_id → feeds ON DELETE CASCADE`, `guid`, `url`, `title`, `author`, `published_at`, `fetched_at`,
  `sort_at`, `excerpt`, `rss_html` (sanitised), `is_full_text`, `extracted_html`, `extracted_at`,
  `extract_failed_at`, `thumbnail_url`, `bookmarked_at`, `bookmark_cleared_at`; `UNIQUE (feed_id, guid)`.
  Indexes: `(sort_at DESC, id)`, `(feed_id, sort_at DESC, id)`, partial on `bookmarked_at IS NOT NULL`.
- **settings**: `key text PK`, `value jsonb` (typography, sync state such as `lastSyncAt`).

The mobile `assets` table has no equivalent: images load directly, and nothing is cached offline.

### Feed URL secrets

- `FEED_URL_KEY` (32 random bytes, base64) and `FEED_URL_HMAC_KEY` live in Vercel env and GitHub secrets only.
- Stored format: `version(1) ‖ iv(12) ‖ ciphertext ‖ tag(16)`. The version byte allows key rotation later.
- `url_hmac = HMAC-SHA256(normalised URL)` enforces uniqueness and dedupes on import without decrypting anything.
- Decryption happens only inside `server/http.ts` / OPML export. The API never returns feed URLs, apart from the
  OPML export download (which is the point of export).
- The mobile rules carry over: never log URLs; errors are only "Network error" / "Timed out" / "HTTP n"; no
  real URLs in fixtures, commits or PRs.

### Auth flow

- **Auth0 tenant:** one Regular Web Application (Next.js) with exact callback/logout URLs
  `https://synaxi.app/auth/callback`, `https://synaxi.app` and the `http://localhost:3000` equivalents;
  `APP_BASE_URL=https://synaxi.app`. One **API** (identifier `https://synaxi.app/api`, RS256, token encryption
  off). A Database connection with **sign-ups disabled** and passkeys enabled; no social connections. Refresh
  tokens with rotation (`offline_access`) so an installed PWA stays signed in.
- **Browser:** `src/proxy.ts` (Next 16's `middleware`) runs the SDK for `/auth/*` and redirects pages to login if
  there's no session. The API audience is requested **at login** (`authorizationParameters.audience`), so the
  session's default access token is for our API. Client code calls plain `getAccessToken()` (the SDK refreshes
  it; no MRRT setup needed) and sends `Authorization: Bearer …` to `/api/*`. Sessions roll, with 7 days of
  inactivity and 30 days absolute.
- **API:** every handler starts with `requireUser(req)`, which verifies signature (remote JWKS, cached), `iss`,
  `aud` and `exp`. A 401 makes the client re-run login. The session cookie alone **does not** authorise `/api/*`.
  The mobile app will use exactly the same path later.
- **Cron:** `/api/cron/retention` checks `Authorization: Bearer $CRON_SECRET` (Vercel sends this) instead.

### Key flows

- **Sync** (`POST /api/sync`): if `auto=1` and `lastSyncAt` is under 15 min old, return immediately. Otherwise
  fetch every feed through `mapPool(4)` with a conditional GET, parse, and upsert entries with
  `ON CONFLICT (feed_id, guid) DO NOTHING`, skipping entries older than the retention window. Record per-feed
  state and return `{added, failed}`. The client shows a spinner and then invalidates its queries.
  Fewer than 50 feeds at concurrency 4 is well inside the 300s limit. A Postgres advisory lock stops two tabs
  from syncing at once.
- **Open article** (`GET /api/articles/:id`): if `is_full_text`, return `rss_html`. If `extracted_html` exists,
  return that. Otherwise extract inline (10s budget), store, and return it, falling back to `rss_html` and
  setting `extract_failed_at`. HTML is **sanitised server-side at write time**; media grouping (carousel, video
  embeds) happens at the same point.
- **Bookmark** (`PUT`): sets `bookmarked_at`, then pre-extracts in the background with `after()`, so
  bookmarked articles open instantly.
- **Auto-clear:** an IntersectionObserver watches a sentinel at the end of the reader's scroll container. Once it
  has been visible for 1.5s (5s if it was visible on open), the client sends `DELETE` (sets
  `bookmark_cleared_at`) and shows a "Bookmark cleared — Undo" toast. Undo sends `PUT`.
- **Retention:** daily cron deletes articles where `bookmarked_at IS NULL` and
  `coalesce(bookmark_cleared_at, published_at, fetched_at) < now() - 14 days` (mirrors `core/retention.ts`).

### UI

- **Layout (≥1024px):** collapsible sidebar (All / Today / Bookmarks, folders → feeds, sync button and status,
  settings) | article list | reader. Below that width the reader opens over the list.
- **URL state:** `/?view=folder:<uuid>&article=<uuid>`, so reload and back/forward work (same scheme as mobile).
- **Reader:** `prose` container with reading-width and typography CSS variables (from settings), a header
  (title, feed, author, time, Open original, Bookmark), the end sentinel, a carousel (CSS scroll-snap +
  arrow buttons), a lightbox (Radix Dialog, arrow keys and swipe), and a view-original toggle (extracted ⇄
  RSS; hidden when the RSS is already the full text). All links get
  `target=_blank rel="noopener noreferrer"`.
- **Keyboard shortcuts:** `j`/`k` next/prev article, `n`/`p` next/prev view, `o` open original, `b` toggle
  bookmark, `v` view-original toggle, `r` refresh, `[` toggle sidebar, `?` show the shortcuts dialog. Disabled
  while typing in inputs.
- **Security headers** (`next.config.ts`): a static CSP. Nonces would force dynamic rendering of the shell, and
  Next's inline scripts need `'unsafe-inline'` even with SRI, so scripts are `'self' 'unsafe-inline'`. The real
  guard for article HTML is the server-side allowlist sanitiser. The CSP restricts the rest: `frame-src` only
  `youtube-nocookie.com` / `player.vimeo.com`, `img-src https: data:`, `object-src 'none'`, `base-uri`/`form-action
'self'`, `frame-ancestors 'none'`, `upgrade-insecure-requests` (http images), and `Referrer-Policy: no-referrer`.

## Environments & CI/CD (GitHub Actions)

Vercel Git integration is turned off (`vercel.json` → `git.deploymentEnabled: false`). Actions does all deploys
with the Vercel CLI (`vercel pull` → `vercel build` → `vercel deploy --prebuilt`).

| Workflow     | Trigger                | Steps                                                                                      |
| ------------ | ---------------------- | ------------------------------------------------------------------------------------------ |
| `ci.yml`     | PR, push `main`        | `bun install --frozen-lockfile`, typecheck, lint, prettier check, `bun test`, `next build` |
| `deploy.yml` | push `main` (after CI) | `drizzle-kit migrate` against prod → `vercel deploy --prod --prebuilt`                     |

- **No PR previews for now.** PRs are checked by CI only. If previews come back, they need a Neon branch per PR
  and a separate Auth0 app with a wildcard callback (see Verified platform limits).
- Secrets: `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`, `DATABASE_URL` (prod, unpooled, for
  migrations). App secrets (`AUTH0_*`, `APP_BASE_URL`, `FEED_URL_*`, `CRON_SECRET`) live in Vercel env.
- **Domain:** `synaxi.app` as the apex domain on Vercel (DNS A record or Vercel nameservers). `.app` is
  HSTS-preloaded, so it's HTTPS only, which is fine on Vercel.
- Migrations are **expand-first and append-only**. A migration runs before the code that needs it ships, and a
  shipped migration is never edited.
- **Local dev:** `bun dev` against a long-lived Neon `dev` branch; Auth0 callbacks include `http://localhost:3000`.

## Phases

**Phase 0: skeleton, auth, pipeline**

- Scaffold Next.js + bun + Tailwind + shadcn; ESLint/Prettier; `AGENTS.md`.
- Auth0 tenant setup (documented in the README); nextjs-auth0 middleware; `requireUser`; `GET /api/me` called
  from the client with a Bearer token. This proves the whole auth path end to end.
- Drizzle + Neon wired up, with an empty first migration; PWA manifest + icons + shell service worker.
- `ci.yml` + `deploy.yml`; `synaxi.app` attached; first prod deploy.
- **Spikes:** (1) Readability + linkedom inside a Vercel Node function on a real page; (2)
  `getAccessToken({audience})` returns an RS256 JWT that `requireUser` accepts.

**Phase 1: read end to end**

- Copy `src/core` and its tests from mobile, and run them under `bun test`.
- Schema + migration; URL encryption; OPML import screen; sync; views + keyset-paginated list; reader with
  extraction, video embeds and the sanitiser; bookmarks + auto-clear + Undo; retention cron; keyboard shortcuts;
  system light/dark.

**Phase 2: feed management + reader polish**

- Add feed by URL with autodiscovery; rename/move/delete feeds and folders; per-feed errors in the sidebar.
- OPML export.
- Carousel, lightbox, typography settings, view-original toggle.

**Later (not v1)**

- Mobile app sync against this API (pull deltas by `updated_at`; push bookmark changes; tombstones for deletes).
- Postgres full-text search; background fetching (needs an external scheduler on Hobby); offline bookmarks.

## Verification

- **Unit (`bun test`):** everything ported from mobile (parse, full-text heuristic, Readability fixtures,
  sanitiser, carousel grouping, OPML round-trip, retention), plus URL crypto round-trip and tamper detection,
  `requireUser` (bad sig / aud / iss / expired), and view → SQL filter mapping.
- **Integration:** API route tests against a throwaway Neon branch (created in CI or locally), covering import,
  sync with a local fixture server, list pagination, and bookmark + clear + undo.
- **Manual:** import the real OPML (including the private feed); sync; check the error states never show a URL;
  read a summary-only article (extracted) and a YouTube post; bookmark an article, scroll to the end, check it
  auto-clears and Undo works; run through every keyboard shortcut; install the PWA from Chrome desktop and
  relaunch to confirm the session persists; confirm a second Auth0 user can't sign up.

## Defaults I picked (veto any)

- UUIDv7 generated in the app (the `uuidv7` package), not Postgres `uuidv7()`, so it doesn't depend on the PG version.
- `timestamptz` everywhere; keyset pagination on `(sort_at, id)`.
- Sync is a single synchronous request with no streamed progress; the client shows a spinner.
- Extraction runs inline in `GET /api/articles/:id` instead of a separate endpoint.
- Hand-written service worker instead of Serwist/next-pwa (it only caches the shell, and avoids bundler coupling).
- Lightbox and carousel are hand-built on Radix Dialog and CSS scroll-snap, with no new dependencies.
- ESLint + Prettier (not Biome), since bun was picked rather than "pnpm + Biome".

### Changed during Phase 1 (2026-11-27)

- **Sanitise on read, not write.** `rss_html` / `extracted_html` are stored raw and sanitised in
  `GET /api/articles/:id` (as mobile does), so improved sanitiser/boilerplate rules apply to old articles.
- **One feed-URL secret.** `FEED_URL_KEY` is split with HKDF into the AES and HMAC keys. Ciphertext and HMAC
  are stored as base64url `text`, not `bytea`.
- **Sync lease, not advisory lock.** The Neon HTTP driver makes each query its own session, so a single
  conditional upsert on a `settings` row is the lock (expires after 6 min).
- **Unfollowed feeds keep their bookmarks** (`feeds.removed_at`, as mobile). Re-importing revives them.
- **Today** is computed by the client (`todayStart` = local midnight) since the server doesn't know the time zone.
- The **view-original toggle** (`v`) shipped in Phase 1 because the API returns both versions anyway.

## Open questions

None. Resolved 2026-11-27: retention is 14 days; there are no PR previews for now; view-original toggles
extracted ⇄ RSS; the domain is `synaxi.app`; there's no `sub` allowlist; typography covers font family, size,
line height and max width.
