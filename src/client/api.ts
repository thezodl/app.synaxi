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

async function send(path: string, init: RequestInit): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set("authorization", `Bearer ${await token()}`);
  if (init.body && !headers.has("content-type")) headers.set("content-type", "application/json");

  const res = await fetch(path, { ...init, headers });
  if (res.status === 401) return toLogin();
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new ApiError(res.status, body?.error ?? `HTTP ${res.status}`);
  }
  return res;
}

/** Call our API with the Auth0 access token. The same contract the mobile app will use later. */
export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await send(path, init);
  return (res.status === 204 ? undefined : await res.json()) as T;
}

/**
 * Download an API response as a file. A plain <a href> can't carry the Bearer token, so fetch it
 * and save via an object URL.
 */
export async function download(path: string, fallbackName: string): Promise<void> {
  const res = await send(path, {});
  const name = /filename="([^"]+)"/.exec(res.headers.get("content-disposition") ?? "")?.[1];
  const url = URL.createObjectURL(await res.blob());
  const a = Object.assign(document.createElement("a"), {
    href: url,
    download: name ?? fallbackName,
  });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
