/* global __KALINGA_VERSION__, __KALINGA_ASSETS__ */
const VERSION = __KALINGA_VERSION__;
const ASSETS = __KALINGA_ASSETS__;
const CACHE = `kalinga-app-${VERSION}`;

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    try {
      for (const url of ASSETS) {
        const response = await fetch(url, { cache: "reload", credentials: "omit", signal: AbortSignal.timeout(60000) });
        if (!response.ok || response.redirected || !url.endsWith(".html") && /text\/html/i.test(response.headers.get("content-type") || "")) throw new Error("An application file could not be prepared.");
        await cache.put(url, response);
      }
      await cache.put("/offline/ready", new Response(VERSION));
      if (!self.registration.active) await self.skipWaiting();
    } catch (error) { await caches.delete(CACHE); throw error; }
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const previous = (await caches.keys()).filter((name) => name.startsWith("kalinga-app-") && name !== CACHE);
    for (const name of previous.slice(0, -1)) await caches.delete(name);
    await self.clients.claim();
  })());
});

async function navigate(request, url) {
  try {
    const response = await fetch(request, { signal: AbortSignal.timeout(5000) });
    if (response.status < 500) return response;
  }
  catch {
    /* A prepared workspace remains usable when the network is unreachable. */
  }
  if (url.search) return new Response("Connect to the internet to open this link. Your saved classroom work is unchanged.", { status: 503, headers: { "Content-Type": "text/plain" } });
  const cache = await caches.open(CACHE);
  return await cache.match("/offline/shell.html") || new Response("Open Kalinga online once to prepare it for offline use.", { status: 503 });
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;
  if (request.mode === "navigate" && url.pathname === "/") { event.respondWith(navigate(request, url)); return; }
  let path = !url.search && ASSETS.includes(url.pathname) ? url.pathname : "";
  if (url.pathname === "/_next/image") {
    const image = url.searchParams.get("url");
    if (image && ASSETS.includes(image) && /^\/[^?]+\.(png|svg)$/.test(image)) path = image;
  }
  if (!path) return;
  event.respondWith((async () => (await (await caches.open(CACHE)).match(path)) || fetch(request))());
});

self.addEventListener("message", (event) => {
  if (event.data?.type !== "OFFLINE_STATUS" || !event.ports[0] || !event.source?.url || new URL(event.source.url).origin !== self.location.origin) return;
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    const prepared = !!(await cache.match("/offline/ready")) && (await Promise.all(ASSETS.map((url) => cache.match(url)))).every(Boolean);
    event.ports[0].postMessage({ version: VERSION, prepared, assets: ASSETS });
  })());
});
