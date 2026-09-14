const CACHE_PREFIX = `zaoan-hub-shell:${new URL(self.registration.scope).pathname}:`;
const CACHE_VERSION = "v9";
const CACHE_NAME = `${CACHE_PREFIX}${CACHE_VERSION}`;
const APP_SHELL_PATHS = [
  "./", "./index.html", "./guide.html", "./styles.css", "./storage.js", "./state.js",
  "./app.js", "./data-transfer.js", "./privacy.js", "./guide.js", "./pwa.js", "./legacy-upgrade.js",
  "./manifest.webmanifest", "./icon.svg", "./greetings.js",
  "./morning-flowers.png", "./morning-lake.png", "./morning-tea.png"
];
const APP_SHELL_URLS = new Set(APP_SHELL_PATHS.map((path) => new URL(path, self.registration.scope).href));
const NAVIGATION_URLS = new Set(["./", "./index.html", "./guide.html"].map((path) => new URL(path, self.registration.scope).href));

self.addEventListener("install", (event) => {
  // Download a complete release, bypassing the HTTP cache. Updates wait for consent.
  event.waitUntil(caches.open(CACHE_NAME).then((cache) =>
    cache.addAll([...APP_SHELL_URLS].map((url) => new Request(url, { cache: "reload" })))
  ));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys
      .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
      .map((key) => caches.delete(key))))
    .then(() => self.clients.claim()));
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    event.waitUntil(self.skipWaiting());
  }
  if (event.data?.type === "CACHE_STATUS" && event.ports[0]) {
    event.waitUntil(caches.open(CACHE_NAME).then(async (cache) => {
      const entries = await Promise.all([...APP_SHELL_URLS].map((url) => cache.match(url)));
      event.ports[0].postMessage({ ready: entries.every(Boolean) });
    }).catch(() => event.ports[0].postMessage({ ready: false })));
  }
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  url.search = "";
  url.hash = "";
  const key = url.href;
  if (!APP_SHELL_URLS.has(key)) return;
  if (request.mode === "navigate" && !NAVIGATION_URLS.has(key)) return;
  // Keep HTML and scripts on the same release instead of mixing network HTML with old JS.
  event.respondWith(caches.open(CACHE_NAME).then(async (cache) => {
    const cached = await cache.match(key);
    return cached || fetch(request);
  }));
});
