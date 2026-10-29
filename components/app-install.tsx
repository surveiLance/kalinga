"use client";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Image from "next/image";
import { installationLink, installInstructions, openAppInstall, readInstallState, requestAppInstall, serverInstallState, startAppInstall, subscribeInstall, type InstallBrowser, type InstallResult } from "@/lib/pwa-install";
import { prepareOfflineApplication, readOfflineAvailability } from "@/lib/offline-availability";

export function InstallAppButton({ className = "install-app-button", menuItem = false, onOpen = openAppInstall }: { className?: string; menuItem?: boolean; onOpen?: () => void }) {
  const state = useSyncExternalStore(subscribeInstall, readInstallState, serverInstallState);
  if (state.installed) return null;
  return <button className={className} type="button" role={menuItem ? "menuitem" : undefined} aria-haspopup="dialog" onClick={onOpen}>Install Kalinga</button>;
}

export function AppInstall() {
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
    <header><Image src="/offline/icon-192.png" alt="" width={52} height={52} /><div><p className="eyebrow">KALINGA ON YOUR DEVICE</p><h2 id="install-title">Install Kalinga</h2></div><button className="install-close" type="button" aria-label="Close installation guide" onClick={() => dialog.current?.close()}>×</button></header>
    <div className="install-dialog-body">
      {state.installed ? <div className="install-success" role="status"><h3>Kalinga is installed</h3><p>Open Kalinga from its new icon on your home screen or app list.</p></div> : <><p className="install-intro">Keep Kalinga one tap away, with saved lessons and materials available when you have no signal.</p>{state.canPrompt ? <div className="install-native"><p>Your browser can install Kalinga on this device.</p><button className="primary-button" type="button" onClick={() => { void requestAppInstall().then(setResult); }}>Install app</button></div> : <>
      <p className="install-unavailable">This window hasn’t offered an install button. Use the steps below, or keep using Kalinga here.</p>
      {instructions.chooseBrowser && <label className="install-browser-picker">Your browser<select value={instructions.browser} onChange={(event) => { setInstructions(installInstructions(navigator.userAgent, navigator.platform, navigator.maxTouchPoints, event.target.value as InstallBrowser)); setCopyMessage(""); }}><option value="chrome">Google Chrome</option><option value="edge">Microsoft Edge</option><option value="safari">Safari</option><option value="dia">Dia</option><option value="opera">Opera / Opera GX</option><option value="other">Another browser</option></select><small>Choose your browser if the selection is wrong.</small></label>}
      <p className="install-device">{instructions.device}</p><ol className="install-steps">{instructions.steps.map((step) => <li key={step}>{step}</li>)}</ol>
      {instructions.chooseBrowser && <div className="install-copy-link"><label htmlFor="install-public-link">Kalinga link<input id="install-public-link" value={link} readOnly onFocus={(event) => event.currentTarget.select()} /></label><button className="secondary-button" type="button" onClick={() => { if (!navigator.clipboard) { setCopyMessage("Select and copy the link above."); return; } void navigator.clipboard.writeText(link).then(() => setCopyMessage("Link copied. Paste it into the browser you want to use."), () => setCopyMessage("Select and copy the link above.")); }}>Copy link</button>{copyMessage && <p role="status">{copyMessage}</p>}</div>}
      <p className="install-browser-note">{instructions.note} Guest and private windows may clear saved work when closed.</p></>}
      {state.prompting && <p role="status">Choose Install or Cancel in your browser’s installation window.</p>}
      {result === "accepted" && <p className="install-result" role="status">Finish installing in your browser.</p>}
      {result === "dismissed" && <p className="install-result" role="status">Installation cancelled. You can keep using Kalinga here and install later from your browser menu.</p>}
      {result === "failed" && <p className="install-result" role="status">The installation window could not open. Use the browser steps above instead.</p>}</>}
      <details className="install-offline"><summary>After installing: prepare for offline teaching</summary><div><p>After installing, open Kalinga from its new icon. Sign in and wait for “Ready for offline teaching” in the sidebar or your account menu. Save your lessons and download each PDF you need.</p><p className={`install-preparation ${offline.prepared ? "prepared" : ""}`} role="status">{offline.prepared ? "Application files are saved on this browser." : offline.message}</p>{!offline.prepared && <button className="text-button" type="button" onClick={() => { void prepareOfflineApplication(); }}>Check application preparation</button>}<small>Installation and offline preparation are separate. Gabay AI, teacher discussions, and new uploads still need internet.</small></div></details>
    </div>
    <footer>{!state.installed && !state.canPrompt && <button className="text-button" type="button" onClick={() => dialog.current?.close()}>Use Kalinga in this browser</button>}<button className="secondary-button" type="button" onClick={() => dialog.current?.close()}>Done</button></footer>
  </dialog>;
}
