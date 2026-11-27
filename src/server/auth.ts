import "server-only";

import { createRemoteJWKSet } from "jose";
import { unstable_rethrow } from "next/navigation";

import { UserError } from "./errors";
import { KeyMismatchError } from "./keys";
import { Unauthorized, verifyBearer, type AuthUser, type VerifierConfig } from "./jwt";

export { Unauthorized, type AuthUser };

let defaultConfig: VerifierConfig | null = null;

function config(): VerifierConfig {
  if (!defaultConfig) {
    const domain = process.env.AUTH0_DOMAIN;
    const audience = process.env.AUTH0_AUDIENCE;
    if (!domain || !audience) throw new Error("AUTH0_DOMAIN and AUTH0_AUDIENCE must be set");
    const issuer = `https://${domain}/`;
    defaultConfig = {
      issuer,
      audience,
      // jose caches the key set and refetches on unknown `kid`.
      keys: createRemoteJWKSet(new URL(".well-known/jwks.json", issuer)),
    };
  }
  return defaultConfig;
}

/** Authenticate an API request. Single-user enforcement lives in the Auth0 tenant (sign-ups off). */
export function requireUser(req: Request): Promise<AuthUser> {
  return verifyBearer(req.headers.get("authorization"), config());
}

/** Wrap a route handler so `Unauthorized` becomes a 401 and other errors a generic 500. */
export function withUser<Ctx>(
  handler: (req: Request, user: AuthUser, ctx: Ctx) => Promise<Response>,
): (req: Request, ctx: Ctx) => Promise<Response> {
  return async (req, ctx) => {
    try {
      const user = await requireUser(req);
      return await handler(req, user, ctx);
    } catch (e) {
      // Let Next's internal signals through (e.g. prerender bail-out when a GET reads headers).
      unstable_rethrow(e);
      if (e instanceof Unauthorized) {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
      }
      if (e instanceof UserError) {
        return Response.json({ error: e.message }, { status: e.status });
      }
      if (e instanceof KeyMismatchError) {
        console.error(e.message);
        return Response.json({ error: e.message }, { status: 500 });
      }
      console.error("API error", e instanceof Error ? e.name : "unknown");
      return Response.json({ error: "Internal error" }, { status: 500 });
    }
  };
}
