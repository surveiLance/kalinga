"use client";
import { T, useInterfaceLanguage } from "@/components/language-switch";

import { useEffect, useRef, useState } from "react";
import { finishPasswordRecovery, normalizeAccountDetails, requestPasswordReset, type AccountResult } from "@/lib/account-controls";
import { guestCaptchaSiteKey } from "@/lib/guest-access";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { GuestCaptcha } from "@/components/guest-captcha";
import { useAppUpdateGuard } from "@/components/app-updates";

export type AccountPanel = "settings" | "help" | "reset";
function ResetRequest({ email: initialEmail }: { email: string }) {
  const { t } = useInterfaceLanguage();
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
  return <form className="account-form" onSubmit={submit}><p><T>{"We’ll email a secure link to choose a new password. Your classes and lesson plans stay in the same account."}</T></p><label><T>Email address</T><input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required disabled={busy} /></label>{guestCaptchaSiteKey && <GuestCaptcha siteKey={guestCaptchaSiteKey} attempt={attempt} onToken={setToken} />}{result && <p className={`account-feedback ${result.ok ? "success" : "error"}`} role={result.ok ? "status" : "alert"}>{t(result.message || "")}</p>}<button className="primary-button" type="submit" disabled={busy || (!!guestCaptchaSiteKey && !token)}>{busy ? t("Sending…") : t("Send reset link")}</button><small><T>{"Reset links expire. Use the latest email and open it on a trusted device. Never share the link or your password."}</T></small></form>;
}
export function AccountDialog({ kind, name, school, email, guest, authenticated, onClose, onSave }: { kind: AccountPanel; name: string; school: string; email: string; guest: boolean; authenticated: boolean; onClose: () => void; onSave: (name: string, school: string) => Promise<AccountResult> }) {
  const { t } = useInterfaceLanguage();
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
  return <dialog ref={dialog} className="account-dialog" aria-labelledby="account-dialog-title" onCancel={(event) => { event.preventDefault(); if (!busy) onClose(); }}><header><div><p className="eyebrow"><T>{"YOUR TEACHING SPACE"}</T></p><h2 id="account-dialog-title">{panel === "settings" ? t("Account settings") : panel === "help" ? t("Help & support") : t("Reset your password")}</h2></div><button type="button" aria-label={t("Close account dialog")} onClick={onClose} disabled={busy}>×</button></header><div className="account-dialog-body">{panel === "settings" ? <><p>{authenticated ? t("Keep your name and school ready for your next lesson plan.") : t("Offline demo: these details stay in this browser. They do not create an online account.")}</p><form className="account-form" onSubmit={submit}><label><T>{"Teacher name"}</T><input type="text" autoComplete="name" maxLength={80} value={draftName} onChange={(event) => setDraftName(event.target.value)} readOnly={guest} required disabled={busy} /></label>{guest && <small><T>{"Your guest name is fixed for this testing session."}</T></small>}<label><T>{"School name"}</T>{" "}<small><T>Optional</T></small><input type="text" autoComplete="organization" maxLength={160} value={draftSchool} onChange={(event) => setDraftSchool(event.target.value)} disabled={busy} /></label>{authenticated && <div className="account-email"><b><T>{"Sign-in email"}</T></b><span>{email || t("Guest session · no email")}</span><small><T>{"Your sign-in email is not changed by this form."}</T></small></div>}<p className="account-save-note"><T>{"New lesson plans use these details. Existing saved plans keep their teacher and school information; their activities are not rewritten."}</T></p>{result && <p className={`account-feedback ${result.ok ? "success" : "error"}`} role={result.ok ? "status" : "alert"}>{t(result.message || "")}</p>}<button className="primary-button" type="submit" disabled={busy}>{busy ? t("Saving…") : t("Save account details")}</button></form>{authenticated && !guest && <button className="account-text-button" type="button" onClick={() => setPanel("reset")} disabled={busy}><T>{"Send a password reset email"}</T></button>}</> : panel === "reset" ? <ResetRequest email={email} /> : <div className="account-help"><p><T>{"Choose a topic for the steps. You stay in control of every change."}</T></p><details open><summary><T>{"Prepare and export a lesson plan"}</T></summary><p><T>{"Open Plan lessons, choose your class and topic, then draft with Gabay or write it yourself. Click the document fields to edit. Always review facts, grade-level activities and competency codes before submitting for quality assurance."}</T></p><p><T>{"Choose Save lesson to keep changes. Print / PDF opens your browser’s print dialog: choose Save as PDF, A4 paper and turn off browser headers/footers. Download Word gives you an editable .docx file."}</T></p></details><details><summary><T>{"Understand saving and offline work"}</T></summary><p><T>{"The top status shows whether work is saved on this device, waiting to sync, or needs attention. With a regular account, keep this browser open and reconnect to sync. Retry the status button if needed. Do not clear browser data while changes are waiting."}</T></p><p><T>{"Offline demo data stays in this browser and is not shared with teachers. Opening the website for the first time still needs internet."}</T></p></details><details><summary><T>{"Get help from Gabay or other teachers"}</T></summary><p><T>{"Ask Gabay for guidance or use Improve lesson with Gabay for proposed edits. Review suggestions before applying them. Ask teachers is for connected questions, replies and shared resources—do not post learner names or private details."}</T></p></details><details><summary><T>{"Report a problem safely"}</T></summary><p><T>{"Note the page, what you clicked and what happened. Send those steps to your Kalinga project contact. If you include a screenshot, hide learner information, email addresses and private content. Never send passwords, reset links or API keys."}</T></p></details></div>}</div><footer><button className="secondary-button" type="button" onClick={onClose} disabled={busy}><T>Done</T></button></footer></dialog>;
}
export function PasswordRecoveryScreen({ accountId, onComplete, onCancel }: { accountId: string; onComplete: () => void; onCancel: () => void }) {
  const { t } = useInterfaceLanguage();
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
  return <main className="login-screen"><section className="login-panel password-recovery" aria-labelledby="password-recovery-title"><p className="eyebrow"><T>{"SECURE ACCOUNT RECOVERY"}</T></p><h1 id="password-recovery-title"><T>{"Choose a new password"}</T></h1><p><T>{"Your reset link opened this secure form. Your teaching records will stay in the same account."}</T></p>{!result?.ok && <form className="account-form" onSubmit={submit}><label><T>{"New password"}</T><input type="password" autoComplete="new-password" minLength={8} required value={password} onChange={(event) => setPassword(event.target.value)} disabled={busy} /></label><label><T>{"Confirm new password"}</T><input type="password" autoComplete="new-password" minLength={8} required value={confirmation} onChange={(event) => setConfirmation(event.target.value)} disabled={busy} /></label><button className="primary-button" type="submit" disabled={busy}>{busy ? t("Updating…") : t("Update password")}</button></form>}{result && <p className={`account-feedback ${result.ok ? "success" : "error"}`} role={result.ok ? "status" : "alert"}>{t(result.message || "")}</p>}{result?.ok ? <button className="primary-button" type="button" onClick={onComplete}><T>{"Return to Kalinga"}</T></button> : <button className="account-text-button" type="button" onClick={onCancel} disabled={busy}><T>{"Cancel and return to sign in"}</T></button>}</section></main>;
}
