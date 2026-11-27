import { createCipheriv, createDecipheriv, createHmac, hkdfSync, randomBytes } from "node:crypto";

/**
 * Feed URLs can carry private tokens, so they're stored encrypted (AES-256-GCM) with an HMAC
 * alongside for uniqueness. One 32-byte secret (FEED_URL_KEY) is split with HKDF into separate
 * encryption and MAC keys. No Next imports, so it's unit-testable under `bun test`.
 *
 * Stored format (base64url): version(1) ‖ iv(12) ‖ ciphertext ‖ tag(16).
 */
const VERSION = 1;
const IV_LEN = 12;
const TAG_LEN = 16;

export interface UrlKeys {
  enc: Buffer;
  mac: Buffer;
}

export function deriveKeys(secretBase64: string): UrlKeys {
  const ikm = Buffer.from(secretBase64, "base64");
  if (ikm.length !== 32) throw new Error("FEED_URL_KEY must be 32 bytes, base64-encoded");
  const derive = (info: string) =>
    Buffer.from(hkdfSync("sha256", ikm, Buffer.alloc(0), `synaxi feed-url ${info} v1`, 32));
  return { enc: derive("enc"), mac: derive("mac") };
}

/** Canonical form for dedupe: parsed by WHATWG URL (lowercases scheme/host, drops default port). */
export function normalizeFeedUrl(url: string): string {
  return new URL(url.trim()).toString();
}

export function encryptUrl(url: string, keys: UrlKeys): string {
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv("aes-256-gcm", keys.enc, iv);
  const ct = Buffer.concat([cipher.update(url, "utf8"), cipher.final()]);
  return Buffer.concat([Buffer.from([VERSION]), iv, ct, cipher.getAuthTag()]).toString("base64url");
}

export function decryptUrl(stored: string, keys: UrlKeys): string {
  const buf = Buffer.from(stored, "base64url");
  if (buf.length < 1 + IV_LEN + TAG_LEN || buf[0] !== VERSION) {
    throw new Error("Unsupported feed URL ciphertext");
  }
  const iv = buf.subarray(1, 1 + IV_LEN);
  const tag = buf.subarray(buf.length - TAG_LEN);
  const ct = buf.subarray(1 + IV_LEN, buf.length - TAG_LEN);
  const decipher = createDecipheriv("aes-256-gcm", keys.enc, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
}

export function urlHmac(url: string, keys: UrlKeys): string {
  return createHmac("sha256", keys.mac).update(normalizeFeedUrl(url)).digest("base64url");
}
