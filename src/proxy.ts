import { NextResponse, type NextRequest } from "next/server";

import { auth0 } from "@/server/auth0";

/**
 * - `/auth/*` is handled by the Auth0 SDK (login, callback, logout, access-token, profile).
 * - `/api/*` passes through: every route verifies its own Bearer token (`requireUser`).
 * - Everything else is the app shell. Without a session, redirect to login.
 */
export async function proxy(request: NextRequest) {
  const authResponse = await auth0.middleware(request);
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/auth/") || pathname.startsWith("/api/")) {
    return authResponse;
  }

  const session = await auth0.getSession(request);
  if (!session) {
    const login = new URL("/auth/login", request.nextUrl.origin);
    login.searchParams.set("returnTo", pathname + request.nextUrl.search);
    return NextResponse.redirect(login);
  }

  // Keep any rolled-session cookies the SDK set.
  return authResponse;
}

export const config = {
  matcher: [
    // Skip static assets and the public PWA files (the manifest is fetched without credentials).
    "/((?!_next/static|_next/image|favicon.ico|icon.png|apple-icon.png|manifest.webmanifest|sw.js|icons/|offline.html).*)",
  ],
};
