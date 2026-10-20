"use client";

import Script from "next/script";
import { useEffect, useRef, useState } from "react";
type Turnstile = { render: (element: HTMLElement, options: Record<string, unknown>) => string; remove: (id: string) => void };
declare global { interface Window { turnstile?: Turnstile } }
export function GuestCaptcha({ siteKey, onToken, attempt = 0 }: { siteKey: string; onToken: (token: string | undefined) => void; attempt?: number }) {
  const element = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!ready || !element.current || !window.turnstile) return;
    const api = window.turnstile;
    const id = api.render(element.current, { sitekey: siteKey, callback: (token: string) => { setFailed(false); onToken(token); }, "expired-callback": () => onToken(undefined), "error-callback": () => { setFailed(true); onToken(undefined); }, theme: "light", size: "flexible" });
    return () => { api.remove(id); onToken(undefined); };
  }, [ready, siteKey, onToken, attempt]);
  return <><Script id="kalinga-turnstile" src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" strategy="afterInteractive" onReady={() => setReady(true)} onError={() => { setFailed(true); onToken(undefined); }} /><div className="guest-captcha" ref={element} role="group" aria-label="Security verification" />{failed && <p className="auth-feedback error" role="alert">Security verification could not load. Check your connection or reload this page.</p>}</>;
}
