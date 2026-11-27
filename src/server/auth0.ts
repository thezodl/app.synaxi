import { Auth0Client } from "@auth0/nextjs-auth0/server";

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
});
