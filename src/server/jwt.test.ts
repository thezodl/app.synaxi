import { beforeAll, describe, expect, test } from "bun:test";
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT, type JWTVerifyGetKey } from "jose";

import { Unauthorized, verifyBearer } from "./jwt";

const issuer = "https://tenant.example.auth0.com/";
const audience = "https://synaxi.app/api";

let keys: JWTVerifyGetKey;
let sign: (
  claims?: Record<string, unknown>,
  opts?: { exp?: string; iss?: string; aud?: string },
) => Promise<string>;
let foreignSign: () => Promise<string>;

beforeAll(async () => {
  const pair = await generateKeyPair("RS256");
  const other = await generateKeyPair("RS256");
  const jwk = { ...(await exportJWK(pair.publicKey)), kid: "k1", alg: "RS256" };
  keys = createLocalJWKSet({ keys: [jwk] });

  sign = (claims = { sub: "auth0|me" }, opts = {}) =>
    new SignJWT(claims)
      .setProtectedHeader({ alg: "RS256", kid: "k1" })
      .setIssuer(opts.iss ?? issuer)
      .setAudience(opts.aud ?? audience)
      .setIssuedAt()
      .setExpirationTime(opts.exp ?? "5m")
      .sign(pair.privateKey);

  foreignSign = () =>
    new SignJWT({ sub: "auth0|me" })
      .setProtectedHeader({ alg: "RS256", kid: "k1" })
      .setIssuer(issuer)
      .setAudience(audience)
      .setExpirationTime("5m")
      .sign(other.privateKey);
});

const verify = (header: string | null) => verifyBearer(header, { issuer, audience, keys });

describe("verifyBearer", () => {
  test("accepts a valid token", async () => {
    expect(await verify(`Bearer ${await sign()}`)).toEqual({ sub: "auth0|me" });
  });

  test.each([
    ["missing header", async () => null],
    ["wrong scheme", async () => `Basic ${await sign()}`],
    ["garbage token", async () => "Bearer not-a-jwt"],
    ["wrong audience", async () => `Bearer ${await sign(undefined, { aud: "https://other/api" })}`],
    [
      "wrong issuer",
      async () => `Bearer ${await sign(undefined, { iss: "https://evil.example/" })}`,
    ],
    ["expired", async () => `Bearer ${await sign(undefined, { exp: "-1m" })}`],
    ["signed by another key", async () => `Bearer ${await foreignSign()}`],
    ["no sub", async () => `Bearer ${await sign({})}`],
  ])("rejects %s", async (_name, header) => {
    await expect(verify(await header())).rejects.toBeInstanceOf(Unauthorized);
  });
});
