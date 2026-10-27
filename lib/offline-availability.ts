export type OfflineAvailabilityState = { state: "unprepared" | "preparing" | "ready" | "update" | "error" | "unsupported"; prepared: boolean; message: string };
let availability: OfflineAvailabilityState = { state: "unprepared", prepared: false, message: "Open online to prepare offline access" };
export function readOfflineAvailability() { return availability; }
function publish(value: OfflineAvailabilityState) { availability = value; window.dispatchEvent(new Event("kalinga:offline-availability")); }
export function offlinePageMatchesAssets(pageAssets: string[], cachedAssets: string[]) {
  return pageAssets.length > 0 && pageAssets.every((url) => cachedAssets.includes(url));
}
function status(worker: ServiceWorker) {
  return new Promise<{ version: string; prepared: boolean; assets: string[] }>((resolve, reject) => {
    const channel = new MessageChannel();
    const timer = window.setTimeout(() => { channel.port1.close(); reject(new Error("Preparation check timed out")); }, 8000);
    channel.port1.onmessage = (event) => { window.clearTimeout(timer); channel.port1.close(); resolve(event.data); };
    worker.postMessage({ type: "OFFLINE_STATUS" }, [channel.port2]);
  });
}
export async function prepareOfflineApplication() {
  if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) { publish({ state: "unsupported", prepared: false, message: "Offline preparation needs the published app and a supported browser" }); return; }
  publish({ state: "preparing", prepared: false, message: "Preparing application files…" });
  try {
    const registration = await Promise.race([navigator.serviceWorker.register("/kalinga-sw.js", { updateViaCache: "none" }), new Promise<never>((_, reject) => window.setTimeout(() => reject(new Error("Preparation took too long")), 15000))]);
    const check = async () => {
      if (!navigator.serviceWorker.controller) return;
      try {
        const result = await status(navigator.serviceWorker.controller);
        const pageAssets = Array.from(document.querySelectorAll<HTMLScriptElement | HTMLLinkElement>('script[src],link[rel="stylesheet"]')).map((item) => new URL(item instanceof HTMLScriptElement ? item.src : item.href).pathname).filter((path) => path.startsWith("/_next/static/"));
        const prepared = result.prepared && offlinePageMatchesAssets(pageAssets, result.assets);
        publish({ state: prepared ? registration.waiting ? "update" : "ready" : "update", prepared, message: prepared ? registration.waiting ? "Update ready. Save, close Kalinga tabs and reopen to update." : "Application files available offline" : "Save, close Kalinga tabs and reopen online to finish preparation." });
      } catch { publish({ state: "error", prepared: false, message: "Offline files could not be checked. Reconnect and retry preparation." }); }
    };
    navigator.serviceWorker.addEventListener("controllerchange", () => { void check(); });
    registration.addEventListener("updatefound", () => { registration.installing?.addEventListener("statechange", () => { void check(); }); });
    await check();
    window.setTimeout(() => { if (availability.state === "preparing") publish({ state: "error", prepared: false, message: "Preparation is not complete. Reconnect and retry." }); }, 90000);
  } catch { publish({ state: "error", prepared: false, message: "Offline preparation failed. Reconnect and retry." }); }
}
