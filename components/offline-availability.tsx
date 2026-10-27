"use client";
import { useEffect } from "react";
import { prepareOfflineApplication } from "@/lib/offline-availability";
export function OfflineAvailability() {
  useEffect(() => { void prepareOfflineApplication(); }, []);
  return null;
}
