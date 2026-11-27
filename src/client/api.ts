"use client";

import { getAccessToken } from "@auth0/nextjs-auth0";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

function toLogin(): never {
  const returnTo = window.location.pathname + window.location.search;
  // /auth/login is handled by the Auth0 SDK in proxy.ts, not a Next page: it needs a full navigation.
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
  window.location.assign(`/auth/login?returnTo=${encodeURIComponent(returnTo)}`);
  // Navigation is underway; stop the caller.
  throw new ApiError(401, "Signing in…");
}

async function token(): Promise<string> {
  try {
    return await getAccessToken();
  } catch {
    // No session, or the refresh token is gone.
    return toLogin();
  }
}

/** Call our API with the Auth0 access token. The same contract the mobile app will use later. */
export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("authorization", `Bearer ${await token()}`);
  if (init.body && !headers.has("content-type")) headers.set("content-type", "application/json");

  const res = await fetch(path, { ...init, headers });
  if (res.status === 401) return toLogin();
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new ApiError(res.status, body?.error ?? `HTTP ${res.status}`);
  }
  return (res.status === 204 ? undefined : await res.json()) as T;
}
