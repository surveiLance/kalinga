"use client";
import { useEffect, useRef, useState } from "react";
import { appLaunchTarget } from "@/lib/app-launch";
import styles from "./app-launch.module.css";

type LaunchQueue = { setConsumer(consumer: (params: { targetURL?: string }) => void): void };
export function AppLaunch() {
  const dialog = useRef<HTMLDialogElement>(null);
  const [pending, setPending] = useState("");
  const [deferred, setDeferred] = useState(false);
  useEffect(() => {
    const queue = (window as Window & { launchQueue?: LaunchQueue }).launchQueue;
    if (!queue) return;
    queue.setConsumer(({ targetURL }) => { const target = appLaunchTarget(targetURL, window.location.href); if (target) { setPending(target); setDeferred(false); } });
    return () => queue.setConsumer(() => {});
  }, []);
  useEffect(() => { if (pending && !deferred && !dialog.current?.open) dialog.current?.showModal(); }, [pending, deferred]);
  function defer() { dialog.current?.close(); setDeferred(true); }
  return <>{pending && deferred && <button className={`app-update-notice ${styles.resume}`} type="button" onClick={() => setDeferred(false)}>Finish opening email link</button>}<dialog ref={dialog} className="install-dialog" aria-labelledby="app-launch-title" onCancel={() => setDeferred(true)}><header><div><p className="eyebrow">CONTINUE IN THIS WINDOW</p><h2 id="app-launch-title">Open your email link</h2></div><button className="install-close" type="button" aria-label="Close email link" onClick={defer}>×</button></header><div className="install-dialog-body"><p>Your sign-in or password-reset link arrived in this Kalinga window.</p><p>Continuing will refresh this window. Save any unfinished work first. Your saved classes and lessons stay on this device.</p></div><footer><button className="secondary-button" type="button" onClick={defer}>Keep working</button><button className="primary-button" type="button" onClick={() => { if (pending) window.location.assign(pending); }}>Continue with email link</button></footer></dialog></>;
}
