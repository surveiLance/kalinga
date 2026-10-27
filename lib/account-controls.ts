import type { SupabaseClient } from "@supabase/supabase-js";

export type AccountResult = { ok: boolean; message?: string };
export function normalizeAccountDetails(name: string, school: string) {
  const clean = (value: string) => value.trim().replace(/\s+/g, " ");
  if ([...name, ...school].some((value) => { const code = value.charCodeAt(0); return code < 32 || code >= 127 && code <= 159; })) return { ok: false as const, message: "Use names without line breaks or control characters." };
  const normalized = { name: clean(name), school: clean(school) };
  if (!normalized.name || [...normalized.name].length > 80) return { ok: false as const, message: "Enter a teacher name using 1 to 80 characters." };
  if ([...normalized.school].length > 160) return { ok: false as const, message: "Use up to 160 characters for your school name." };
  return { ok: true as const, ...normalized };
}
export function preservePlanIdentity<T extends { teacherName?: string; schoolName?: string }>(plans: T[], name: string, school: string): T[] {
  return plans.map((plan) => ({ ...plan, teacherName: plan.teacherName ?? name, schoolName: plan.schoolName ?? school }));
}
export function prepareAccountUpdate<T extends { teacherName?: string; schoolName?: string }>(plans: T[], name: string, school: string, authenticated: boolean, cloudLoaded: boolean, profileLoaded: boolean) {
  if (authenticated && (!cloudLoaded || !profileLoaded)) return { ok: false as const, message: "Connect and let your existing profile and lesson plans load before changing account details. This protects earlier lesson headers. If loading fails, reconnect and reload the page." };
  return { ok: true as const, plans: preservePlanIdentity(plans, name, school) };
}
export function createProfileReadGate() {
  let version = 0;
  return {
    invalidate() { version++; },
    async read<T>(load: () => PromiseLike<T>, apply: (value: T) => void) {
      const current = ++version;
      const value = await load();
      if (current === version) apply(value);
    },
  };
}
export async function requestPasswordReset(client: SupabaseClient | null, email: string, origin: string, captchaToken?: string): Promise<AccountResult> {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return { ok: false, message: "Connect to the internet to send a password-reset email." };
  if (!client) return { ok: false, message: "Account recovery is not configured on this device." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return { ok: false, message: "Enter a valid email address." };
  try {
    const url = new URL(origin);
    if (!['https:', 'http:'].includes(url.protocol)) return { ok: false, message: "Open Kalinga in your browser to reset your password." };
    const { error } = await client.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${url.origin}/?password-reset=1`, captchaToken });
    if (error) return { ok: false, message: error.status === 429 ? "Too many recovery requests. Wait a few minutes before trying again." : "The reset email could not be sent. Check your connection and security verification, then retry." };
    return { ok: true, message: "If this email has a Kalinga account, a password-reset link will arrive shortly. Check your spam folder too. Open the newest link." };
  } catch { return { ok: false, message: "Check your connection and try again. Your password has not changed." }; }
}
export async function finishPasswordRecovery(client: SupabaseClient | null, password: string, confirmation: string, recoveryAccountId: string): Promise<AccountResult> {
  if (password.length < 8) return { ok: false, message: "Use at least 8 characters for your new password." };
  if (password !== confirmation) return { ok: false, message: "The two passwords do not match." };
  if (!client) return { ok: false, message: "Account recovery is not configured on this device." };
  try {
    const session = await client.auth.getSession();
    if (!recoveryAccountId || session.error || !session.data.session || session.data.session.user.is_anonymous || session.data.session.user.id !== recoveryAccountId) return { ok: false, message: "This reset link is no longer valid for the current account. Request a new link from Sign in." };
    const { error } = await client.auth.updateUser({ password });
    if (error) return { ok: false, message: "The password could not be changed. The link may have expired, or the password may not meet your account’s security rules. Request a new link or try a different password." };
    return { ok: true, message: "Your password was changed. You can return to your teaching space." };
  } catch { return { ok: false, message: "The request did not finish. Keep this page open and try again." }; }
}
