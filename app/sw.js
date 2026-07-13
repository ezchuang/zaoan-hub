const CACHE_NAME = "zaoan-hub-shell-v4";
const APP_SHELL_PATHS = [
  "./",
  "./index.html",
  "./guide.html",
  "./styles.css",
  "./storage.js",
  "./app.js",
  "./data-transfer.js",
  "./privacy.js",
  "./guide.js",
  "./pwa.js",
  "./manifest.webmanifest",
  "./icon.svg"
];
const APP_SHELL_URLS = new Set(APP_SHELL_PATHS.map((path) => new URL(path, self.registration.scope).href));
const INDEX_URL = new URL("./index.html", self.registration.scope).href;
const NAVIGATION_URLS = new Set([
  new URL("./", self.registration.scope).href,
  INDEX_URL,
  new URL("./guide.html", self.registration.scope).href
]);

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll([...APP_SHELL_URLS])).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("fetch", (event) => {
  const request = event.request;

  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) {
    return;
  }

  const requestUrl = canonicalUrl(url);

  if (request.mode === "navigate") {
    if (!NAVIGATION_URLS.has(requestUrl)) {
      return;
    }
    event.respondWith(networkFirst(request));
    return;
  }

  if (!APP_SHELL_URLS.has(requestUrl)) {
    return;
  }

  event.respondWith(cacheFirst(request));
});

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (isCacheable(response)) {
      const cache = await caches.open(CACHE_NAME);
      await cache.put(canonicalUrl(request.url), response.clone());
    }
    return response;
  } catch (error) {
    const cachedResponse = await caches.match(canonicalUrl(request.url));
    return cachedResponse || caches.match(INDEX_URL);
  }
}

async function cacheFirst(request) {
  const requestUrl = canonicalUrl(request.url);
  const cachedResponse = await caches.match(requestUrl);
  if (cachedResponse) {
    return cachedResponse;
  }

  const response = await fetch(request);
  if (isCacheable(response)) {
    const cache = await caches.open(CACHE_NAME);
    await cache.put(requestUrl, response.clone());
  }
  return response;
}

function canonicalUrl(input) {
  const url = new URL(input);
  url.search = "";
  url.hash = "";
  return url.href;
}

function isCacheable(response) {
  return response.ok && response.type === "basic";
}
