"use client";
import { T, useInterfaceLanguage } from "@/components/language-switch";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Image from "next/image";
import { installationLink, installInstructions, openAppInstall, readInstallState, requestAppInstall, serverInstallState, startAppInstall, subscribeInstall, type InstallBrowser, type InstallResult } from "@/lib/pwa-install";
import { prepareOfflineApplication, readOfflineAvailability } from "@/lib/offline-availability";

export function InstallAppButton({ className = "install-app-button", menuItem = false, onOpen = openAppInstall }: { className?: string; menuItem?: boolean; onOpen?: () => void }) {
  const state = useSyncExternalStore(subscribeInstall, readInstallState, serverInstallState);
  if (state.installed) return null;
  return <button className={className} type="button" role={menuItem ? "menuitem" : undefined} aria-haspopup="dialog" onClick={onOpen}><T>{"Install Kalinga"}</T></button>;
}

export function AppInstall() {
  const { t } = useInterfaceLanguage();
  const dialog = useRef<HTMLDialogElement>(null);
  const state = useSyncExternalStore(subscribeInstall, readInstallState, serverInstallState);
  const [instructions, setInstructions] = useState(() => installInstructions("", "", 0));
  const [result, setResult] = useState<InstallResult | "">("");
  const [offline, setOffline] = useState(readOfflineAvailability);
  const [link, setLink] = useState("");
  const [copyMessage, setCopyMessage] = useState("");
  useEffect(() => {
    const stop = startAppInstall();
    const open = () => { setInstructions(installInstructions(navigator.userAgent, navigator.platform, navigator.maxTouchPoints)); setLink(installationLink(window.location.href)); setCopyMessage(""); setResult(""); if (!dialog.current?.open) dialog.current?.showModal(); };
    const changed = () => setOffline(readOfflineAvailability());
    window.addEventListener("kalinga:install-open", open); window.addEventListener("kalinga:offline-availability", changed);
    return () => { stop?.(); window.removeEventListener("kalinga:install-open", open); window.removeEventListener("kalinga:offline-availability", changed); };
  }, []);
  return <dialog ref={dialog} className="install-dialog" aria-labelledby="install-title">
    <header><Image src="/offline/icon-192.png" alt="" width={52} height={52} /><div><p className="eyebrow"><T>{"KALINGA ON YOUR DEVICE"}</T></p><h2 id="install-title"><T>{"Install Kalinga"}</T></h2></div><button className="install-close" type="button" aria-label={t("Close installation guide")} onClick={() => dialog.current?.close()}>×</button></header>
    <div className="install-dialog-body">
      {state.installed ? <div className="install-success" role="status"><h3><T>{"Kalinga is installed"}</T></h3><p><T>{"Open Kalinga from its new icon on your home screen or app list."}</T></p></div> : <><p className="install-intro"><T>{"Keep Kalinga one tap away, with saved lessons and materials available when you have no signal."}</T></p>{state.canPrompt ? <div className="install-native"><p><T>{"Your browser can install Kalinga on this device."}</T></p><button className="primary-button" type="button" onClick={() => { void requestAppInstall().then(setResult); }}><T>{"Install app"}</T></button></div> : <>
      <p className="install-unavailable"><T>{"This window hasn’t offered an install button. Use the steps below, or keep using Kalinga here."}</T></p>
      {instructions.chooseBrowser && <label className="install-browser-picker"><T>{"Your browser"}</T><select value={instructions.browser} onChange={(event) => { setInstructions(installInstructions(navigator.userAgent, navigator.platform, navigator.maxTouchPoints, event.target.value as InstallBrowser)); setCopyMessage(""); }}><option value="chrome">Google Chrome</option><option value="edge">Microsoft Edge</option><option value="safari">Safari</option><option value="dia">Dia</option><option value="opera">Opera / Opera GX</option><option value="other"><T>{"Another browser"}</T></option></select><small><T>{"Choose your browser if the selection is wrong."}</T></small></label>}
      <p className="install-device">{t(instructions.device)}</p><ol className="install-steps">{instructions.steps.map((step) => <li key={step}>{t(step)}</li>)}</ol>
      {instructions.chooseBrowser && <div className="install-copy-link"><label htmlFor="install-public-link"><T>{"Kalinga link"}</T><input id="install-public-link" value={link} readOnly onFocus={(event) => event.currentTarget.select()} /></label><button className="secondary-button" type="button" onClick={() => { if (!navigator.clipboard) { setCopyMessage("Select and copy the link above."); return; } void navigator.clipboard.writeText(link).then(() => setCopyMessage("Link copied. Paste it into the browser you want to use."), () => setCopyMessage("Select and copy the link above.")); }}><T>{"Copy link"}</T></button>{copyMessage && <p role="status">{t(copyMessage)}</p>}</div>}
      <p className="install-browser-note">{t(instructions.note)} <T>{"Guest and private windows may clear saved work when closed."}</T></p></>}
      {state.prompting && <p role="status"><T>{"Choose Install or Cancel in your browser’s installation window."}</T></p>}
      {result === "accepted" && <p className="install-result" role="status"><T>{"Finish installing in your browser."}</T></p>}
      {result === "dismissed" && <p className="install-result" role="status"><T>{"Installation cancelled. You can keep using Kalinga here and install later from your browser menu."}</T></p>}
      {result === "failed" && <p className="install-result" role="status"><T>{"The installation window could not open. Use the browser steps above instead."}</T></p>}</>}
      <details className="install-offline" open={!offline.prepared || state.installed || result === "accepted"}><summary><T>{"After installing: prepare for offline teaching"}</T></summary><div><p><T>{"After installing, open Kalinga from its new icon. Sign in and wait for “Ready for offline teaching” in the sidebar or your account menu. Save your lessons and download each PDF you need."}</T></p><p className={`install-preparation ${offline.prepared ? "prepared" : ""}`} role="status">{offline.prepared ? t("Application files are saved on this browser.") : t(offline.message)}</p>{!offline.prepared && <button className="text-button" type="button" onClick={() => { void prepareOfflineApplication(); }}><T>{"Check application preparation"}</T></button>}<small><T>{"Installation and offline preparation are separate. Gabay AI, teacher discussions, and new uploads still need internet."}</T></small></div></details>
    </div>
    <footer>{!state.installed && !state.canPrompt && <button className="text-button" type="button" onClick={() => dialog.current?.close()}><T>{"Use Kalinga in this browser"}</T></button>}<button className="secondary-button" type="button" onClick={() => dialog.current?.close()}><T>Done</T></button></footer>
  </dialog>;
}
