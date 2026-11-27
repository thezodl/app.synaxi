import { describe, expect, test } from "bun:test";
import { randomBytes } from "node:crypto";

import { decryptUrl, deriveKeys, encryptUrl, normalizeFeedUrl, urlHmac } from "./urlcrypto";

const keys = deriveKeys(randomBytes(32).toString("base64"));
const URL_ = "https://example.com/feed?token=not-a-real-secret";

describe("feed URL crypto", () => {
  test("round-trips", () => {
    expect(decryptUrl(encryptUrl(URL_, keys), keys)).toBe(URL_);
  });

  test("ciphertext is randomised and doesn't contain the URL", () => {
    const a = encryptUrl(URL_, keys);
    expect(a).not.toBe(encryptUrl(URL_, keys));
    expect(Buffer.from(a, "base64url").toString("latin1")).not.toContain("token");
  });

  test("detects tampering", () => {
    const buf = Buffer.from(encryptUrl(URL_, keys), "base64url");
    buf[20]! ^= 1;
    expect(() => decryptUrl(buf.toString("base64url"), keys)).toThrow();
  });

  test("rejects the wrong key", () => {
    const other = deriveKeys(randomBytes(32).toString("base64"));
    expect(() => decryptUrl(encryptUrl(URL_, keys), other)).toThrow();
  });

  test("HMAC is stable across trivial URL differences, and differs per key", () => {
    expect(urlHmac("HTTPS://Example.com:443/feed?token=not-a-real-secret", keys)).toBe(
      urlHmac(URL_, keys),
    );
    expect(urlHmac(URL_, keys)).not.toBe(urlHmac("https://example.com/other", keys));
    expect(urlHmac(URL_, deriveKeys(randomBytes(32).toString("base64")))).not.toBe(
      urlHmac(URL_, keys),
    );
  });

  test("normalises", () => {
    expect(normalizeFeedUrl("  http://EXAMPLE.com:80/a  ")).toBe("http://example.com/a");
  });

  test("insists on a 32-byte key", () => {
    expect(() => deriveKeys(randomBytes(16).toString("base64"))).toThrow();
  });
});
