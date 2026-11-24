"use client";
import { T, useInterfaceLanguage } from "@/components/language-switch";
import { useEffect, useRef, useState } from "react";
import { applyApplicationUpdate, checkApplicationUpdate, readOfflineAvailability } from "@/lib/offline-availability";
import { updateGuards } from "@/lib/app-update";

export function useAppUpdateGuard(message: string) { useEffect(() => updateGuards.add(() => message), [message]); }
function useAvailability() {
  const [app, setApp] = useState(readOfflineAvailability);
  useEffect(() => { const changed = () => setApp(readOfflineAvailability()); window.addEventListener("kalinga:offline-availability", changed); return () => window.removeEventListener("kalinga:offline-availability", changed); }, []);
  return app;
}
export function AppUpdateButton({ menuItem = false }: { menuItem?: boolean }) {
  const { t } = useInterfaceLanguage();
  const app = useAvailability();
  if (!menuItem && !app.updateReady) return null;
  return <button className={menuItem ? "app-update-menu-button" : "app-update-notice"} type="button" role={menuItem ? "menuitem" : undefined} aria-haspopup="dialog" onClick={() => window.dispatchEvent(new Event("kalinga:update-open"))}><T>{menuItem ? t("App updates") : t("Update available")}</T></button>;
}
export function AppUpdates() {
  const { t } = useInterfaceLanguage();
  const dialog = useRef<HTMLDialogElement>(null);
  const app = useAvailability();
  const [checking, setChecking] = useState(false);
  const [applying, setApplying] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => { const open = () => { setMessage(""); if (!dialog.current?.open) dialog.current?.showModal(); }; window.addEventListener("kalinga:update-open", open); return () => window.removeEventListener("kalinga:update-open", open); }, []);
  const busy = applying || !!app.updating;
  async function check() { setChecking(true); setMessage(""); try { await checkApplicationUpdate(); } catch { setMessage("Could not check for updates. Reconnect and retry."); } finally { setChecking(false); } }
  async function update() { if (busy) return; setApplying(true); setMessage(""); try { setMessage(await applyApplicationUpdate()); } catch { setMessage("The update could not be applied. Your work is unchanged; check for updates and retry."); } finally { setApplying(false); } }
  return <dialog ref={dialog} className="install-dialog app-updates-dialog" aria-labelledby="app-updates-title" onCancel={(event) => { if (busy) event.preventDefault(); }}><header><div><p className="eyebrow"><T>{"KEEP KALINGA CURRENT"}</T></p><h2 id="app-updates-title"><T>{"App updates"}</T></h2></div><button className="install-close" type="button" aria-label={t("Close app updates")} disabled={busy} onClick={() => dialog.current?.close()}>×</button></header><div className="install-dialog-body"><h3>{app.updateReady ? t("An update is ready") : t("Check for a new version")}</h3><p role="status">{busy ? t("Applying update. This window will refresh…") : app.message}</p><p><T>{"Update now briefly refreshes this window. Your saved classes, lessons, attendance, and downloaded PDFs stay on this device. Save unfinished work first."}</T></p><p className="app-update-help"><T>{"Save work in other Kalinga tabs or app windows and close them before updating here."}</T></p>{message && <p className="app-update-feedback" role="alert">{t(message)}</p>}</div><footer><button className="secondary-button" type="button" disabled={busy || checking} onClick={() => void check()}>{checking ? t("Checking…") : t("Check for updates")}</button><button className="primary-button" type="button" disabled={busy || checking || !app.updateReady} onClick={() => void update()}>{busy ? t("Updating…") : t("Update now")}</button></footer></dialog>;
}
