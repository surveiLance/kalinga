/* global __KALINGA_VERSION__, __KALINGA_ASSETS__, __KALINGA_HASHES__ */
const VERSION = __KALINGA_VERSION__;
const ASSETS = __KALINGA_ASSETS__;
const HASHES = __KALINGA_HASHES__;
const CACHE = `kalinga-app-${VERSION}`;
let preparation;

async function download(cache, url) {
  for (let attempt = 0; attempt < 3; attempt++) {
    let response;
    try { response = await fetch(url, { cache: "reload", credentials: "omit", signal: AbortSignal.timeout(60000) }); }
    catch (error) { if (attempt === 2) throw error; }
    if (response) {
      if (response.ok && !response.redirected && (url.endsWith(".html") || !/text\/html/i.test(response.headers.get("content-type") || ""))) {
        try {
          const digest = await crypto.subtle.digest("SHA-256", await response.clone().arrayBuffer());
          if (Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("") !== HASHES[url]) throw new Error("The application file belongs to a different build. Check for updates.");
          await cache.put(url, response); return;
        }
        catch (error) { if (attempt === 2) throw error; }
      } else if (attempt === 2 || response.status < 500 && ![408, 429].includes(response.status)) throw new Error("An application file could not be prepared.");
    }
    await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** attempt));
  }
}

async function prepare() {
  if (preparation) return preparation;
  preparation = (async () => {
    const cache = await caches.open(CACHE);
    let next = 0, failed = false;
    const downloads = await Promise.allSettled(Array.from({ length: Math.min(6, ASSETS.length) }, async () => {
      while (!failed && next < ASSETS.length) {
        const url = ASSETS[next++];
        try { if (!(await cache.match(url))) await download(cache, url); }
        catch (error) { failed = true; throw error; }
      }
    }));
    const rejected = downloads.find((result) => result.status === "rejected");
    if (rejected) throw rejected.reason;
    await cache.put("/offline/ready", new Response(VERSION));
  })();
  try { await preparation; } finally { preparation = undefined; }
}

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    try {
      await prepare();
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
  if (!["OFFLINE_STATUS", "PREPARE_OFFLINE", "APPLY_UPDATE"].includes(event.data?.type) || !event.ports[0] || !event.source?.url || new URL(event.source.url).origin !== self.location.origin) return;
  event.waitUntil((async () => {
    if (event.data.type === "PREPARE_OFFLINE") {
      if (event.data.version !== VERSION) { event.ports[0].postMessage({ ok: false, message: "Check for updates before preparing offline access." }); return; }
      try { await prepare(); event.ports[0].postMessage({ ok: true }); }
      catch { event.ports[0].postMessage({ ok: false, message: "Offline preparation did not finish. Keep Kalinga connected and retry preparation." }); }
      return;
    }
    const cache = await caches.open(CACHE);
    const prepared = !!(await cache.match("/offline/ready")) && (await Promise.all(ASSETS.map((url) => cache.match(url)))).every(Boolean);
    if (event.data.type === "OFFLINE_STATUS") { event.ports[0].postMessage({ version: VERSION, prepared, assets: ASSETS, canApplyUpdate: true, canPrepareOffline: true }); return; }
    if (!prepared || event.data.version !== VERSION) { event.ports[0].postMessage({ ok: false, message: "The update is not fully downloaded. Check for updates and retry." }); return; }
    const windows = (await self.clients.matchAll({ type: "window", includeUncontrolled: true })).filter((client) => new URL(client.url).origin === self.location.origin);
    if (windows.length !== 1 || windows[0].id !== event.source.id) { event.ports[0].postMessage({ ok: false, message: "Save work in the other Kalinga tabs or app windows and close them, then update here. This window can stay open." }); return; }
    event.ports[0].postMessage({ ok: true, version: VERSION });
    await self.skipWaiting();
  })());
});
