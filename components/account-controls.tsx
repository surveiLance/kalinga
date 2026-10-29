"use client";

import { useEffect, useRef, useState } from "react";
import { finishPasswordRecovery, normalizeAccountDetails, requestPasswordReset, type AccountResult } from "@/lib/account-controls";
import { guestCaptchaSiteKey } from "@/lib/guest-access";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { GuestCaptcha } from "@/components/guest-captcha";
import { useAppUpdateGuard } from "@/components/app-updates";

export type AccountPanel = "settings" | "help" | "reset";
function ResetRequest({ email: initialEmail }: { email: string }) {
  const [email, setEmail] = useState(initialEmail);
  const [token, setToken] = useState<string>();
  const [attempt, setAttempt] = useState(0);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<AccountResult>();
  useAppUpdateGuard(busy ? "Wait for the password-reset request to finish before updating." : "");
  async function submit(event: React.FormEvent) {
    event.preventDefault(); if (busy) return;
    setBusy(true); setResult(undefined);
    try { setResult(await requestPasswordReset(getSupabaseBrowserClient(), email, window.location.origin, token)); }
    finally { setBusy(false); setToken(undefined); setAttempt((value) => value + 1); }
  }
  return <form className="account-form" onSubmit={submit}><p>We’ll email a secure link to choose a new password. Your classes and lesson plans stay in the same account.</p><label>Email address<input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required disabled={busy} /></label>{guestCaptchaSiteKey && <GuestCaptcha siteKey={guestCaptchaSiteKey} attempt={attempt} onToken={setToken} />}{result && <p className={`account-feedback ${result.ok ? "success" : "error"}`} role={result.ok ? "status" : "alert"}>{result.message}</p>}<button className="primary-button" type="submit" disabled={busy || (!!guestCaptchaSiteKey && !token)}>{busy ? "Sending…" : "Send reset link"}</button><small>Reset links expire. Use the latest email and open it on a trusted device. Never share the link or your password.</small></form>;
}
export function AccountDialog({ kind, name, school, email, guest, authenticated, onClose, onSave }: { kind: AccountPanel; name: string; school: string; email: string; guest: boolean; authenticated: boolean; onClose: () => void; onSave: (name: string, school: string) => Promise<AccountResult> }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [panel, setPanel] = useState(kind);
  const [draftName, setDraftName] = useState(name);
  const [draftSchool, setDraftSchool] = useState(school);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<AccountResult>();
  useAppUpdateGuard(busy ? "Wait for your account details to finish saving before updating." : panel === "settings" && (draftName.trim() !== name.trim() || draftSchool.trim() !== school.trim()) && !result?.ok ? "Save your account details before updating." : "");
  useEffect(() => { const current = dialog.current; current?.showModal(); return () => current?.close(); }, []);
  async function submit(event: React.FormEvent) {
    event.preventDefault(); if (busy) return;
    const details = normalizeAccountDetails(draftName, draftSchool);
    if (!details.ok) { setResult(details); return; }
    setBusy(true); setResult(undefined);
    try { setResult(await onSave(guest ? name : details.name, details.school)); }
    catch { setResult({ ok: false, message: "Your details could not be saved. Keep this form open and retry." }); }
    finally { setBusy(false); }
  }
  return <dialog ref={dialog} className="account-dialog" aria-labelledby="account-dialog-title" onCancel={(event) => { event.preventDefault(); if (!busy) onClose(); }}><header><div><p className="eyebrow">YOUR TEACHING SPACE</p><h2 id="account-dialog-title">{panel === "settings" ? "Account settings" : panel === "help" ? "Help & support" : "Reset your password"}</h2></div><button type="button" aria-label="Close account dialog" onClick={onClose} disabled={busy}>×</button></header><div className="account-dialog-body">{panel === "settings" ? <><p>{authenticated ? "Keep your name and school ready for your next lesson plan." : "Offline demo: these details stay in this browser. They do not create an online account."}</p><form className="account-form" onSubmit={submit}><label>Teacher name<input type="text" autoComplete="name" maxLength={80} value={draftName} onChange={(event) => setDraftName(event.target.value)} readOnly={guest} required disabled={busy} /></label>{guest && <small>Your guest name is fixed for this testing session.</small>}<label>School name <small>Optional</small><input type="text" autoComplete="organization" maxLength={160} value={draftSchool} onChange={(event) => setDraftSchool(event.target.value)} disabled={busy} /></label>{authenticated && <div className="account-email"><b>Sign-in email</b><span>{email || "Guest session · no email"}</span><small>Your sign-in email is not changed by this form.</small></div>}<p className="account-save-note">New lesson plans use these details. Existing saved plans keep their teacher and school information; their activities are not rewritten.</p>{result && <p className={`account-feedback ${result.ok ? "success" : "error"}`} role={result.ok ? "status" : "alert"}>{result.message}</p>}<button className="primary-button" type="submit" disabled={busy}>{busy ? "Saving…" : "Save account details"}</button></form>{authenticated && !guest && <button className="account-text-button" type="button" onClick={() => setPanel("reset")} disabled={busy}>Send a password reset email</button>}</> : panel === "reset" ? <ResetRequest email={email} /> : <div className="account-help"><p>Choose a topic for the steps. You stay in control of every change.</p><details open><summary>Prepare and export a lesson plan</summary><p>Open Plan lessons, choose your class and topic, then draft with Gabay or write it yourself. Click the document fields to edit. Always review facts, grade-level activities and competency codes before submitting for quality assurance.</p><p>Choose Save lesson to keep changes. Print / PDF opens your browser’s print dialog: choose Save as PDF, A4 paper and turn off browser headers/footers. Download Word gives you an editable .docx file.</p></details><details><summary>Understand saving and offline work</summary><p>The top status shows whether work is saved on this device, waiting to sync, or needs attention. With a regular account, keep this browser open and reconnect to sync. Retry the status button if needed. Do not clear browser data while changes are waiting.</p><p>Offline demo data stays in this browser and is not shared with teachers. Opening the website for the first time still needs internet.</p></details><details><summary>Get help from Gabay or other teachers</summary><p>Ask Gabay for guidance or use Improve lesson with Gabay for proposed edits. Review suggestions before applying them. Ask teachers is for connected questions, replies and shared resources—do not post learner names or private details.</p></details><details><summary>Report a problem safely</summary><p>Note the page, what you clicked and what happened. Send those steps to your Kalinga project contact. If you include a screenshot, hide learner information, email addresses and private content. Never send passwords, reset links or API keys.</p></details></div>}</div><footer><button className="secondary-button" type="button" onClick={onClose} disabled={busy}>Done</button></footer></dialog>;
}
export function PasswordRecoveryScreen({ accountId, onComplete, onCancel }: { accountId: string; onComplete: () => void; onCancel: () => void }) {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<AccountResult>();
  async function submit(event: React.FormEvent) {
    event.preventDefault(); if (busy) return;
    setBusy(true); setResult(undefined);
    try { const saved = await finishPasswordRecovery(getSupabaseBrowserClient(), password, confirmation, accountId); setResult(saved); if (saved.ok) { setPassword(""); setConfirmation(""); } }
    finally { setBusy(false); }
  }
  return <main className="login-screen"><section className="login-panel password-recovery" aria-labelledby="password-recovery-title"><p className="eyebrow">SECURE ACCOUNT RECOVERY</p><h1 id="password-recovery-title">Choose a new password</h1><p>Your reset link opened this secure form. Your teaching records will stay in the same account.</p>{!result?.ok && <form className="account-form" onSubmit={submit}><label>New password<input type="password" autoComplete="new-password" minLength={8} required value={password} onChange={(event) => setPassword(event.target.value)} disabled={busy} /></label><label>Confirm new password<input type="password" autoComplete="new-password" minLength={8} required value={confirmation} onChange={(event) => setConfirmation(event.target.value)} disabled={busy} /></label><button className="primary-button" type="submit" disabled={busy}>{busy ? "Updating…" : "Update password"}</button></form>}{result && <p className={`account-feedback ${result.ok ? "success" : "error"}`} role={result.ok ? "status" : "alert"}>{result.message}</p>}{result?.ok ? <button className="primary-button" type="button" onClick={onComplete}>Return to Kalinga</button> : <button className="account-text-button" type="button" onClick={onCancel} disabled={busy}>Cancel and return to sign in</button>}</section></main>;
}
