import { jwtVerify, type JWTVerifyGetKey } from "jose";

export interface AuthUser {
  sub: string;
}

export class Unauthorized extends Error {
  readonly status = 401;
  constructor() {
    super("Unauthorized");
  }
}

export interface VerifierConfig {
  issuer: string;
  audience: string;
  keys: JWTVerifyGetKey;
}

/**
 * Verify an `Authorization: Bearer <access token>` header against the Auth0 tenant.
 * Pure function of its config so it can be unit-tested with a local key set.
 */
export async function verifyBearer(
  authorization: string | null,
  cfg: VerifierConfig,
): Promise<AuthUser> {
  const match = /^Bearer\s+(\S+)$/i.exec(authorization ?? "");
  if (!match) throw new Unauthorized();
  try {
    const { payload } = await jwtVerify(match[1]!, cfg.keys, {
      issuer: cfg.issuer,
      audience: cfg.audience,
      algorithms: ["RS256"],
    });
    if (!payload.sub) throw new Unauthorized();
    return { sub: payload.sub };
  } catch {
    // Don't leak why (expired, bad signature, wrong audience...).
    throw new Unauthorized();
  }
}
