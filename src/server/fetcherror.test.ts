import { expect, test } from "bun:test";

import { classifyFetchError } from "./fetcherror";

const withCause = (code: string) =>
  Object.assign(new TypeError("fetch failed"), { cause: { code } });

test("maps undici/system codes to short labels", () => {
  expect(classifyFetchError(withCause("ENOTFOUND"))).toBe("Host not found");
  expect(classifyFetchError(withCause("ECONNREFUSED"))).toBe("Connection refused");
  expect(classifyFetchError(withCause("UND_ERR_CONNECT_TIMEOUT"))).toBe("Timed out");
  expect(classifyFetchError(withCause("CERT_HAS_EXPIRED"))).toBe("TLS error");
  expect(classifyFetchError(withCause("ERR_TLS_CERT_ALTNAME_INVALID"))).toBe("TLS error");
  expect(classifyFetchError(withCause("SOMETHING_ELSE"))).toBe("Network error");
});

test("aborts are timeouts; junk is a network error", () => {
  expect(classifyFetchError(Object.assign(new Error("x"), { name: "AbortError" }))).toBe(
    "Timed out",
  );
  expect(classifyFetchError("nope")).toBe("Network error");
});

test("labels never echo the error message (which can contain the URL)", () => {
  const e = Object.assign(new TypeError("fetch failed https://x.example/feed?token=s"), {
    cause: { code: "ENOTFOUND", message: "getaddrinfo ENOTFOUND x.example" },
  });
  expect(classifyFetchError(e)).not.toContain("x.example");
});
