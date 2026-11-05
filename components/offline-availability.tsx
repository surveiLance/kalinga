"use client";
import { useEffect } from "react";
import { prepareOfflineApplication, readOfflineAvailability } from "@/lib/offline-availability";
export function OfflineAvailability() {
  useEffect(() => {
    const reconnect = () => { void prepareOfflineApplication(); };
    const focus = () => { const app = readOfflineAvailability(); if (navigator.onLine && !app.prepared && app.state !== "preparing") reconnect(); };
    reconnect();
    window.addEventListener("online", reconnect); window.addEventListener("focus", focus);
    return () => { window.removeEventListener("online", reconnect); window.removeEventListener("focus", focus); };
  }, []);
  return null;
}
