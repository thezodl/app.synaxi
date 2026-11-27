// Synaxi service worker. Online-first: it caches nothing but an offline fallback page.
// Never cache /api/* or /auth/* (auth state, secrets). Bump VERSION to replace the cache.
const VERSION = "v1";
const CACHE = `synaxi-${VERSION}`;
const OFFLINE_URL = "/offline.html";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll([OFFLINE_URL, "/icons/icon-192.png"]))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Page navigations go to the network; if that fails (offline), show the fallback page.
self.addEventListener("fetch", (event) => {
  if (event.request.mode !== "navigate") return;
  event.respondWith(
    fetch(event.request).catch(() =>
      caches.match(OFFLINE_URL).then((r) => r ?? new Response("Offline", { status: 503 })),
    ),
  );
});
