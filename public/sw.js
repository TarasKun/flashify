const CACHE_VERSION = "flashify-shell-v4";
const APP_SHELL_URL = "/";
const SHELL_ASSETS = [
  "/",
  "/icons/flashify-icon-192.png",
  "/icons/flashify-icon-512.png",
  "/icons/flashify-icon-1024.png",
  "/icons/apple-touch-icon.png",
];
const CACHEABLE_DESTINATIONS = new Set([
  "font",
  "image",
  "manifest",
  "script",
  "style",
  "worker",
]);

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then((cache) => cache.addAll(SHELL_ASSETS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_VERSION)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") {
    return;
  }

  const requestUrl = new URL(request.url);

  if (requestUrl.origin !== self.location.origin) {
    return;
  }

  if (requestUrl.pathname.startsWith("/api/")) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(handleNavigationRequest(request));
    return;
  }

  if (!CACHEABLE_DESTINATIONS.has(request.destination)) {
    return;
  }

  event.respondWith(handleAssetRequest(request));
});

async function handleNavigationRequest(request) {
  const cachedResponse = await caches.match(request);

  try {
    const response = await fetch(request);

    if (response.ok) {
      const cache = await caches.open(CACHE_VERSION);
      await cache.put(request, response.clone());
    }

    return response;
  } catch {
    return (
      cachedResponse ||
      (await caches.match(APP_SHELL_URL)) ||
      Response.error()
    );
  }
}

async function handleAssetRequest(request) {
  const cachedResponse = await caches.match(request);

  if (cachedResponse) {
    return cachedResponse;
  }

  const response = await fetch(request);

  if (response.ok) {
    const cache = await caches.open(CACHE_VERSION);
    await cache.put(request, response.clone());
  }

  return response;
}
