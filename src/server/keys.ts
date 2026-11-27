import "server-only";

import { createHmac } from "node:crypto";

import { eq } from "drizzle-orm";

import { db } from "./db";
import { settings } from "./db/schema";
import { decryptUrl, deriveKeys, encryptUrl, urlHmac, type UrlKeys } from "./urlcrypto";

let keys: UrlKeys | null = null;
let verified: Promise<void> | null = null;

function k(): UrlKeys {
  if (!keys) {
    const secret = process.env.FEED_URL_KEY;
    if (!secret) throw new Error("FEED_URL_KEY must be set");
    keys = deriveKeys(secret);
  }
  return keys;
}

export class KeyMismatchError extends Error {
  constructor() {
    super(
      "FEED_URL_KEY doesn't match the key this database's feeds were encrypted with. " +
        "Dev and prod share the database, so the key must be identical in every environment.",
    );
  }
}

/**
 * Dev and prod share one database, so they must share FEED_URL_KEY. The first key used stores a
 * fingerprint (an HMAC of a constant: reveals nothing about the key); any other key is refused
 * before it can write feeds the other environment can't decrypt.
 */
export function assertKeyMatchesDb(): Promise<void> {
  verified ??= (async () => {
    const fingerprint = createHmac("sha256", k().mac).update("synaxi key check v1").digest("hex");
    const value = { fingerprint };
    await db()
      .insert(settings)
      .values({ key: "feed_url_key", value })
      .onConflictDoNothing({ target: settings.key });
    const [row] = await db().select().from(settings).where(eq(settings.key, "feed_url_key"));
    if ((row?.value as { fingerprint?: string } | undefined)?.fingerprint !== fingerprint) {
      throw new KeyMismatchError();
    }
  })().catch((e) => {
    verified = null; // retry next time (e.g. a transient DB error)
    throw e;
  });
  return verified;
}

export const sealUrl = (url: string) => ({
  urlEnc: encryptUrl(url, k()),
  urlHmac: urlHmac(url, k()),
});
export const openUrl = (urlEnc: string) => decryptUrl(urlEnc, k());
export const hmacUrl = (url: string) => urlHmac(url, k());
