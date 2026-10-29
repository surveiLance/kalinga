import { updateGuards } from "@/lib/app-update";
export type OfflineAvailabilityState = { state: "unprepared" | "preparing" | "ready" | "update" | "error" | "unsupported"; prepared: boolean; message: string; updateReady?: boolean; updating?: boolean };
let availability: OfflineAvailabilityState = { state: "unprepared", prepared: false, message: "Open online to prepare offline access" };
let observed: ServiceWorkerRegistration | undefined;
let checking: Promise<void> | undefined;
const watched = new WeakSet<ServiceWorker>();
export function readOfflineAvailability() { return availability; }
function publish(value: OfflineAvailabilityState) { availability = value; window.dispatchEvent(new Event("kalinga:offline-availability")); }
export function offlinePageMatchesAssets(pageAssets: string[], cachedAssets: string[]) {
  return pageAssets.length > 0 && pageAssets.every((url) => cachedAssets.includes(url));
}
function workerMessage<T>(worker: ServiceWorker, message: Record<string, unknown>) {
  return new Promise<T>((resolve, reject) => {
    const channel = new MessageChannel();
    const timer = window.setTimeout(() => { channel.port1.close(); reject(new Error("Preparation check timed out")); }, 8000);
    channel.port1.onmessage = (event) => { window.clearTimeout(timer); channel.port1.close(); resolve(event.data); };
    worker.postMessage(message, [channel.port2]);
  });
}
function status(worker: ServiceWorker) { return workerMessage<{ version: string; prepared: boolean; assets: string[] }>(worker, { type: "OFFLINE_STATUS" }); }
async function checkRegistration(registration: ServiceWorkerRegistration) {
  if (availability.updating || !navigator.serviceWorker.controller) return;
  try {
    const result = await status(navigator.serviceWorker.controller);
    const pageAssets = Array.from(document.querySelectorAll<HTMLScriptElement | HTMLLinkElement>('script[src],link[rel="stylesheet"]')).map((item) => new URL(item instanceof HTMLScriptElement ? item.src : item.href).pathname).filter((path) => path.startsWith("/_next/static/"));
    const prepared = result.prepared && offlinePageMatchesAssets(pageAssets, result.assets);
    const updateReady = registration.waiting ? (await status(registration.waiting)).prepared : false;
    publish({ state: updateReady || !prepared ? "update" : "ready", prepared, updateReady, message: updateReady ? "Update downloaded. Open App updates to refresh this window safely." : registration.installing ? "Downloading application files. You can keep working." : prepared ? "Application files available offline" : "Application files need preparation. Check for updates while connected." });
  } catch { publish({ ...availability, message: "Offline files could not be checked. Reconnect and retry preparation." }); }
}
function observeRegistration(registration: ServiceWorkerRegistration) {
  const watch = () => {
    const worker = registration.installing;
    if (worker && !watched.has(worker)) { watched.add(worker); worker.addEventListener("statechange", () => { void checkRegistration(registration); }); }
  };
  if (observed !== registration) { observed = registration; registration.addEventListener("updatefound", watch); navigator.serviceWorker.addEventListener("controllerchange", () => { void checkRegistration(registration); }); }
  watch();
}
export async function prepareOfflineApplication() {
  if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) { publish({ state: "unsupported", prepared: false, message: "Offline preparation needs the published app and a supported browser" }); return; }
  if (checking || availability.updating) return checking;
  checking = (async () => {
  publish({ ...availability, state: "preparing", message: "Preparing application files…" });
  try {
    const registration = await Promise.race([navigator.serviceWorker.register("/kalinga-sw.js", { updateViaCache: "none" }), new Promise<never>((_, reject) => window.setTimeout(() => reject(new Error("Preparation took too long")), 15000))]);
    observeRegistration(registration);
    await checkRegistration(registration);
    window.setTimeout(() => { if (availability.state === "preparing") publish({ ...availability, state: "error", message: "Preparation is not complete. Reconnect and retry." }); }, 90000);
  } catch { publish({ ...availability, state: "error", message: "Offline preparation failed. Reconnect and retry." }); }
  })();
  try { await checking; } finally { checking = undefined; }
}
export async function checkApplicationUpdate() {
  await prepareOfflineApplication();
  if (observed && navigator.onLine) {
    try { await Promise.race([observed.update(), new Promise<never>((_, reject) => window.setTimeout(() => reject(new Error("Update check timed out")), 15000))]); await checkRegistration(observed); }
    catch { publish({ ...availability, message: "Could not check for updates. Your current version is still available." }); }
  }
}
export async function applyApplicationUpdate(): Promise<string> {
  const blocked = updateGuards.check();
  if (blocked) return blocked;
  if (availability.updating) return "An update is already being applied.";
  const registration = await navigator.serviceWorker.getRegistration();
  const worker = registration?.waiting;
  if (!worker) return "No downloaded update is waiting. Choose Check for updates first.";
  const ready = await status(worker);
  if (!ready.prepared) return "The update is still downloading. Keep this window open and retry shortly.";
  const changed = updateGuards.check(); if (changed) return changed;
  publish({ ...availability, updating: true, message: "Applying update. This window will refresh…" });
  return new Promise<string>((resolve) => {
    let finished = false;
    const finish = (message: string) => { if (finished) return; finished = true; clearTimeout(timer); navigator.serviceWorker.removeEventListener("controllerchange", activated); if (message) publish({ ...availability, updating: false, message }); resolve(message); };
    const activated = () => { const controller = navigator.serviceWorker.controller; if (!controller) return; void status(controller).then((current) => { if (current.version === ready.version && current.prepared && !finished) { finish(""); window.location.reload(); } }, () => finish("The update could not be confirmed. Your work is unchanged; retry after checking preparation.")); };
    const timer = window.setTimeout(() => finish("The update did not finish. Save your work and reload this window."), 20000);
    navigator.serviceWorker.addEventListener("controllerchange", activated);
    void workerMessage<{ ok: boolean; message?: string }>(worker, { type: "APPLY_UPDATE", version: ready.version }).then((reply) => { if (!reply.ok) finish(reply.message || "The update could not be applied."); }, () => finish("The update could not be applied. Check for updates and retry."));
  });
}
