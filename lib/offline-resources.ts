import { workspaceStorageKey } from "@/lib/workspace-keys";
export type OfflineResourceInfo = { id: string; source: "starter" | "teacher"; storagePath?: string; ownerId?: string; title: string; subject: string; grades: string; description: string; tags: string[]; author: string; visibility?: "private" | "shared"; type: string; pages: number };
export type OfflineResource = { version: 1; scope: string; info: OfflineResourceInfo; blob: Blob; size: number; downloadedAt: number };
const maxBytes = 20 * 1024 * 1024;
function validScope(scope: string) { if (scope !== "prototype" && !/^teacher-[a-f0-9-]{36}$/i.test(scope)) throw new Error("Open a teacher workspace first."); }
async function database() {
  if (typeof indexedDB === "undefined") throw new Error("This browser cannot store offline PDFs.");
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open("kalinga-offline-resources", 1);
    request.onupgradeneeded = () => { request.result.createObjectStore("resources"); request.result.createObjectStore("operations"); };
    request.onerror = () => reject(new Error("Device storage is unavailable. Your classroom work is unchanged."));
    request.onblocked = () => reject(new Error("Close other Kalinga tabs and retry the download."));
    request.onsuccess = () => resolve(request.result);
  });
}
async function transaction<T>(mode: IDBTransactionMode, run: (tx: IDBTransaction, done: (value: T) => void) => void): Promise<T> {
  const db = await database();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(["resources", "operations"], mode);
    let result: T;
    tx.oncomplete = () => { db.close(); resolve(result); };
    tx.onabort = tx.onerror = () => { db.close(); reject(new Error("The offline file could not be stored. It may have been cancelled, removed, or device storage is full.")); };
    try { run(tx, (value) => { result = value; }); } catch (error) { tx.abort(); reject(error); }
  });
}
function announce(scope: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("kalinga:downloads", { detail: scope }));
  try { localStorage.setItem(workspaceStorageKey(scope, "offline-downloads"), crypto.randomUUID()); } catch { /* The PDF transaction already succeeded. */ }
}
export function waitForOfflineResourceLink(resolve: () => PromiseLike<string>, signal?: AbortSignal, timeoutMs = 8000): Promise<string> {
  return new Promise((done, reject) => {
    if (signal?.aborted) { reject(new Error("Download cancelled.")); return; }
    const abort = () => { cleanup(); reject(new Error("Download cancelled.")); };
    const timer = setTimeout(() => { cleanup(); reject(new Error("The PDF link could not be renewed. Reconnect and retry.")); }, timeoutMs);
    const cleanup = () => { clearTimeout(timer); signal?.removeEventListener("abort", abort); };
    signal?.addEventListener("abort", abort, { once: true });
    Promise.resolve().then(resolve).then((url) => { cleanup(); done(url); }, (error) => { cleanup(); reject(error); });
  });
}
export async function listOfflineResources(scope: string) {
  validScope(scope);
  return transaction<OfflineResource[]>("readonly", (tx, done) => {
    const request = tx.objectStore("resources").getAll();
    request.onsuccess = () => done((request.result as OfflineResource[]).filter((item) => item.scope === scope && item.version === 1 && item.blob?.size === item.size && item.size > 0));
  });
}
export async function getOfflineResource(scope: string, id: string) {
  validScope(scope);
  return transaction<OfflineResource | undefined>("readonly", (tx, done) => {
    const request = tx.objectStore("resources").get([scope, id]);
    request.onsuccess = () => { const value = request.result as OfflineResource | undefined; done(value?.version === 1 && value.blob?.size === value.size && value.size > 0 ? value : undefined); };
  });
}
export async function removeOfflineResource(scope: string, id: string) {
  validScope(scope);
  await transaction<void>("readwrite", (tx) => { tx.objectStore("operations").delete([scope, id]); tx.objectStore("resources").delete([scope, id]); });
  announce(scope);
}
export async function downloadOfflineResource(scope: string, info: OfflineResourceInfo, url: string, options: { signal?: AbortSignal; isCurrent: () => boolean; onProgress?: (value: { received: number; total?: number }) => void }) {
  validScope(scope);
  const token = crypto.randomUUID();
  const current = () => { if (!options.isCurrent() || options.signal?.aborted) throw new Error("Download cancelled; the workspace changed."); };
  current();
  await transaction<void>("readwrite", (tx) => { tx.objectStore("operations").put(token, [scope, info.id]); });
  const controller = new AbortController();
  const abort = () => controller.abort();
  options.signal?.addEventListener("abort", abort, { once: true });
  const timeout = setTimeout(abort, 60000);
  try {
    const response = await fetch(url, { signal: controller.signal, cache: "no-store", credentials: "omit" });
    if (!response.ok || !/^application\/pdf(?:;|$)/i.test(response.headers.get("content-type") || "") || !response.body) throw new Error("The server did not return a PDF. Reconnect and retry.");
    const declared = !response.headers.get("content-encoding") || response.headers.get("content-encoding") === "identity" ? response.headers.get("content-length") : null;
    const total = declared ? Number(declared) : undefined;
    if (total !== undefined && (!Number.isFinite(total) || total <= 0 || total > maxBytes)) throw new Error("The PDF must be 20 MB or smaller.");
    const reader = response.body.getReader();
    const chunks: Uint8Array<ArrayBuffer>[] = [];
    let received = 0;
    try {
      while (true) {
        current();
        const { value, done } = await reader.read();
        if (done) break;
        received += value.byteLength;
        if (received > maxBytes) throw new Error("The PDF must be 20 MB or smaller.");
        chunks.push(new Uint8Array(value));
        options.onProgress?.({ received, total });
      }
    } finally { await reader.cancel().catch(() => {}); }
    if (!received || total !== undefined && total !== received) throw new Error("The download is incomplete. Please retry.");
    const blob = new Blob(chunks, { type: "application/pdf" });
    if (!(await blob.slice(0, 1024).text()).includes("%PDF-") || !(await blob.slice(-2048).text()).includes("%%EOF")) throw new Error("The PDF is incomplete or invalid. Please retry.");
    current();
    const cleanInfo: OfflineResourceInfo = { id: info.id, source: info.source, storagePath: info.storagePath, ownerId: info.ownerId, title: info.title, subject: info.subject, grades: info.grades, description: info.description, tags: [...info.tags], author: info.author, visibility: info.visibility, type: info.type, pages: info.pages };
    const result: OfflineResource = { version: 1, scope, info: cleanInfo, blob, size: received, downloadedAt: Date.now() };
    await transaction<void>("readwrite", (tx) => {
      const request = tx.objectStore("operations").get([scope, info.id]);
      request.onsuccess = () => { if (request.result !== token || !options.isCurrent() || controller.signal.aborted) { tx.abort(); return; } tx.objectStore("resources").put(result, [scope, info.id]); };
    });
    announce(scope);
    return result;
  } finally { clearTimeout(timeout); options.signal?.removeEventListener("abort", abort); }
}
