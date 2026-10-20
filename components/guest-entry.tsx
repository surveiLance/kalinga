"use client";

import { useEffect, useRef, useState } from "react";
import { guestCaptchaSiteKey, normalizeGuestName } from "@/lib/guest-access";
import { GuestCaptcha } from "@/components/guest-captcha";
export function GuestEntry({ onContinue, onCancel, configured, initialName = "", message = "" }: { onContinue: (name: string, captchaToken?: string) => Promise<{ ok: boolean; message?: string }>; onCancel: () => void; configured: boolean; initialName?: string; message?: string }) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus(); }, []);
  const [name, setName] = useState(initialName);
  const [token, setToken] = useState<string>();
  const [attempt, setAttempt] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const normalized = normalizeGuestName(name);
    if (!normalized.ok) { setError(normalized.message); return; }
    if (!configured || !token) { setError("Complete the security verification to continue."); return; }
    setBusy(true); setError("");
    try {
      const result = await onContinue(normalized.name, token);
      if (!result.ok) setError(result.message || "Guest sign-in did not complete. Please retry.");
    } catch { setError("Check your connection and retry. Your work is unchanged."); }
    finally { setBusy(false); setToken(undefined); setAttempt((current) => current + 1); }
  }
  return <section className="guest-entry" aria-labelledby="guest-entry-title"><p className="eyebrow">YOUR OWN TESTING WORKSPACE</p><h1 ref={heading} id="guest-entry-title" tabIndex={-1}>Welcome, Teacher</h1><p>Enter your name to try Kalinga online. No email or password needed. A matching name never opens someone else’s account.</p><form className="login-form" onSubmit={submit}><label>Your name<input autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} maxLength={80} placeholder="e.g. Ana Reyes" required disabled={busy} /></label>{configured && guestCaptchaSiteKey && <GuestCaptcha siteKey={guestCaptchaSiteKey} onToken={setToken} attempt={attempt} />}{!configured && <p className="auth-feedback error" role="status">Guest testing is not available yet. You can still sign in or use the offline demo.</p>}{(error || message) && <p className="auth-feedback error" role="alert">{error || message}</p>}<button className="login-primary" type="submit" disabled={!configured || !token || busy}>{busy ? "Opening your guest workspace…" : "Start as guest"}</button></form><div className="guest-session-note"><b>This browser remembers your guest session.</b><p>Signing out, clearing browser data, or using another device means you cannot return to this guest account. For long-term use, choose regular sign-in from the start. Use fictional learner details when testing.</p></div><button className="prototype-button" type="button" onClick={onCancel} disabled={busy}>Back to sign in</button></section>;
}

export function GuestSignOut({ busy, error, onConfirm, onCancel }: { busy: boolean; error: string; onConfirm: () => void; onCancel: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { const current = dialog.current; current?.showModal(); return () => current?.close(); }, []);
  return <dialog ref={dialog} className="guest-signout-dialog" aria-modal="true" aria-labelledby="guest-signout-title" onCancel={(event) => { event.preventDefault(); if (!busy) onCancel(); }}><h2 id="guest-signout-title">Sign out of this guest account?</h2><p>You won’t be able to reopen it by entering the same name. Export anything you need first. Signing out does not delete your records, but without a permanent sign-in method you cannot recover this session.</p>{error && <p role="alert">{error}</p>}<div><button className="secondary-button" type="button" onClick={onCancel} disabled={busy}>Cancel</button><button className="primary-button" type="button" onClick={onConfirm} disabled={busy}>{busy ? "Signing out…" : "Sign out of guest"}</button></div></dialog>;
}
