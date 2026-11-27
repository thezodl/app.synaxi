import { Auth0Client } from "@auth0/nextjs-auth0/server";
import type { SdkError } from "@auth0/nextjs-auth0/errors";
import { NextResponse } from "next/server";

const DAY = 24 * 60 * 60;

/**
 * Auth0 session handling for the browser (login, callback, logout, /auth/access-token).
 * Reads AUTH0_DOMAIN, AUTH0_CLIENT_ID, AUTH0_CLIENT_SECRET, AUTH0_SECRET and APP_BASE_URL from env.
 *
 * The session cookie is only used to mint access tokens: `/api/*` never trusts it directly
 * (see `requireUser`). Requesting our API's audience at login means the session's default access
 * token is already for this API, so `getAccessToken()` needs no audience (and no MRRT setup).
 */
export const auth0 = new Auth0Client({
  authorizationParameters: {
    audience: process.env.AUTH0_AUDIENCE,
    // offline_access → refresh token, so an installed PWA stays signed in.
    scope: "openid profile email offline_access",
  },
  session: {
    rolling: true,
    // Single personal user: stay signed in for a while, but not forever.
    inactivityDuration: 7 * DAY,
    absoluteDuration: 30 * DAY,
  },
  async onCallback(error, ctx) {
    const base = ctx.appBaseUrl ?? process.env.APP_BASE_URL ?? "http://localhost:3000";
    if (error) return callbackError(error, base);

    // Same as the SDK default, plus a same-origin guard on returnTo.
    const target = new URL(ctx.returnTo || "/", base);
    return NextResponse.redirect(
      target.origin === new URL(base).origin ? target : new URL("/", base),
    );
  },
});

/**
 * The SDK's default shows only "An error occurred during the authorization flow." Surface the
 * OAuth error Auth0 sent back (e.g. `access_denied: Service not found: …`). It contains no secrets.
 */
function callbackError(error: SdkError, base: string): NextResponse {
  const cause = (error as { cause?: { code?: string; message?: string } }).cause;
  const detail = [error.code, cause?.code, cause?.message].filter(Boolean).join(" · ");
  console.error("Auth0 callback failed:", detail);

  const html = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width">
<title>Sign-in failed · Synaxi</title>
<style>:root{color-scheme:light dark}body{font:16px/1.5 system-ui,sans-serif;max-width:40rem;margin:15vh auto;padding:0 16px}code{word-break:break-word}</style>
<h1>Sign-in failed</h1><p>${escapeHtml(error.message)}</p>
<p><code>${escapeHtml(detail)}</code></p>
<p>The Auth0 dashboard's Monitoring → Logs has the full event.</p>
<p><a href="${new URL("/auth/login", base).pathname}">Try again</a></p>`;
  return new NextResponse(html, {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function escapeHtml(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}
