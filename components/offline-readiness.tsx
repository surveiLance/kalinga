"use client";
import { useEffect, useState } from "react";
import { readOfflineAvailability, prepareOfflineApplication } from "@/lib/offline-availability";
import { listOfflineResources } from "@/lib/offline-resources";
import { offlineReadiness } from "@/lib/offline-readiness";
import { workspaceStorageKey } from "@/lib/workspace-keys";
export function OfflineReadiness({ scope, persisted, storageError, pendingCount, cloudVerified, online }: { scope: string; persisted: boolean; storageError: string; pendingCount: number; cloudVerified: boolean; online: boolean }) {
  const [app, setApp] = useState(readOfflineAvailability);
  const [downloads, setDownloads] = useState({ count: 0, bytes: 0 });
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    const update = () => setApp(readOfflineAvailability());
    const refresh = () => { void listOfflineResources(scope).then((items) => { if (active) { setDownloads({ count: items.length, bytes: items.reduce((sum, item) => sum + item.size, 0) }); setError(""); } }).catch(() => { if (active) setError("Offline PDFs could not be checked"); }); };
    const storage = (event: StorageEvent) => { if (event.key === workspaceStorageKey(scope, "offline-downloads")) refresh(); };
    window.addEventListener("kalinga:offline-availability", update); window.addEventListener("kalinga:downloads", refresh); window.addEventListener("storage", storage);
    refresh();
    return () => { active = false; window.removeEventListener("kalinga:offline-availability", update); window.removeEventListener("kalinga:downloads", refresh); window.removeEventListener("storage", storage); };
  }, [scope]);
  const state = offlineReadiness({ appPrepared: app.prepared, workspacePersisted: persisted, storageError, downloadCount: downloads.count, downloadBytes: downloads.bytes, pendingCount, cloudVerified, online });
  return <details className={`offline-card sidebar-status offline-readiness ${state.readyForOffline ? "prepared" : ""}`}><summary><span className="status-dot" /><span><strong>{state.summary}</strong><small>{downloads.count} PDFs downloaded · {(downloads.bytes / 1048576).toFixed(1)} MB</small></span></summary><div><p>{app.message}</p><p>{state.syncMessage}</p>{error && <p role="status">{error}</p>}<p>{state.limitations.join(" ")}</p><button className="text-button" type="button" onClick={() => { void prepareOfflineApplication(); void navigator.storage?.persist?.().catch(() => false); }}>Check preparation</button></div></details>;
}
