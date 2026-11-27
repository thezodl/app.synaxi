import "server-only";

import { decryptUrl, deriveKeys, encryptUrl, urlHmac, type UrlKeys } from "./urlcrypto";

let keys: UrlKeys | null = null;

function k(): UrlKeys {
  if (!keys) {
    const secret = process.env.FEED_URL_KEY;
    if (!secret) throw new Error("FEED_URL_KEY must be set");
    keys = deriveKeys(secret);
  }
  return keys;
}

export const sealUrl = (url: string) => ({
  urlEnc: encryptUrl(url, k()),
  urlHmac: urlHmac(url, k()),
});
export const openUrl = (urlEnc: string) => decryptUrl(urlEnc, k());
export const hmacUrl = (url: string) => urlHmac(url, k());
