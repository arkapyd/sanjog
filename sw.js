// SANJOG service worker
const CACHE = "sanjog-v8";
const SHELL = ["./", "./index.html", "./engine.js", "./network.json",
               "./manifest.webmanifest", "./bg-howrah-sketch.jpg",
               "./icon-192.png", "./icon-512.png", "./icon-512-maskable.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;   // map search etc: browser handles it, never cached

  // network.json: always try the network first so fresh ward data wins,
  // fall back to the cached copy when offline.
  if (url.pathname.endsWith("/network.json")) {
    e.respondWith(
      fetch(e.request)
        .then(r => { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); return r; })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  // everything else: cache first, then network (and cache what we fetch).
  e.respondWith(
    caches.match(e.request).then(hit => hit ||
      fetch(e.request).then(r => {
        const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); return r;
      }).catch(() => e.request.mode === "navigate" ? caches.match("./index.html") : undefined)
    )
  );
});
