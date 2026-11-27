/**
 * Turn a fetch failure into a short, URL-free label for the user. Pure (no Next imports), so it's
 * unit-tested. Node's fetch (undici) puts the system error on `cause`.
 */
export function classifyFetchError(e: unknown): string {
  if (!(e instanceof Error)) return "Network error";
  if (e.name === "AbortError" || e.name === "TimeoutError") return "Timed out";
  const code = String((e as { cause?: { code?: unknown } }).cause?.code ?? "");
  if (code === "ENOTFOUND" || code === "EAI_AGAIN") return "Host not found";
  if (code === "ECONNREFUSED") return "Connection refused";
  if (code === "ECONNRESET" || code === "UND_ERR_SOCKET") return "Connection reset";
  if (code === "UND_ERR_CONNECT_TIMEOUT" || code === "ETIMEDOUT") return "Timed out";
  if (/CERT|TLS|SSL|SELF_SIGNED/.test(code)) return "TLS error";
  if (code === "UND_ERR_HEADERS_OVERFLOW" || code === "UND_ERR_RES_CONTENT_LENGTH_MISMATCH")
    return "Bad response";
  return "Network error";
}
