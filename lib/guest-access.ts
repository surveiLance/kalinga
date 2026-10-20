import type { SupabaseClient, User } from "@supabase/supabase-js";

export const guestAccessEnabled = process.env.NEXT_PUBLIC_GUEST_ACCESS_ENABLED === "true";
export const guestCaptchaSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "";
export type GuestIdentity = { userId: string; displayName: string; mentionTag: string };
export type GuestSessionResult = { status: "ready"; identity: GuestIdentity } | { status: "setup-required" | "revoked" | "unavailable"; message: string };
const unavailable = (): GuestSessionResult => ({ status: "unavailable", message: "Guest testing is not available right now. Please retry or use sign in. Your existing work is unchanged." });
export function normalizeGuestName(value: string): { ok: true; name: string } | { ok: false; message: string } {
  if ([...value].some((character) => { const code = character.charCodeAt(0); return code < 32 || code >= 127 && code <= 159; })) return { ok: false, message: "Enter a name without line breaks or control characters." };
  const name = value.trim().replace(/\s+/g, " ");
  return [...name].length >= 1 && [...name].length <= 80 ? { ok: true, name } : { ok: false, message: "Enter your name using 1 to 80 characters." };
}
function sessionResult(value: unknown, userId: string): GuestSessionResult {
  if (!value || typeof value !== "object") return unavailable();
  const row = value as Record<string, unknown>;
  if (row.enrolled === false) return { status: "setup-required", message: "Enter your name to finish setting up this guest workspace." };
  if (row.enrolled === true && row.active === false) return { status: "revoked", message: "Guest access is unavailable for this session. Your local work has not been deleted." };
  if (row.enrolled !== true || row.active !== true || row.user_id !== userId || typeof row.display_name !== "string" || !normalizeGuestName(row.display_name).ok || typeof row.mention_tag !== "string" || !/^@guest_[a-f0-9]{32}$/.test(row.mention_tag)) return unavailable();
  return { status: "ready", identity: { userId, displayName: row.display_name, mentionTag: row.mention_tag } };
}
export async function resolveGuestSession(client: SupabaseClient, user: User): Promise<GuestSessionResult> {
  try {
    const { data, error } = await client.rpc("guest_session_status");
    return error ? unavailable() : sessionResult(data, user.id);
  } catch { return unavailable(); }
}
export function guestOperationMessage(error: unknown, fallback: string) {
  const message = error && typeof error === "object" && "message" in error ? String(error.message) : "";
  if (/Guest questions limit reached/i.test(message)) return "Guest testing allows 5 questions per hour. Please try later; your draft is unchanged.";
  if (/Guest replies limit reached/i.test(message)) return "Guest testing allows 20 replies or comments per 5 minutes. Please try later; your draft is unchanged.";
  if (/Guest uploads limit reached/i.test(message)) return "Guest testing allows 10 uploads per hour. Please try later; your file has not been submitted.";
  return fallback;
}
export async function startGuestSession(client: SupabaseClient, value: string, captchaToken?: string): Promise<GuestSessionResult> {
  const name = normalizeGuestName(value);
  if (!name.ok) return { status: "setup-required", message: name.message };
  try {
    const session = await client.auth.getSession();
    if (session.error) return unavailable();
    let user = session.data.session?.user;
    if (user && !user.is_anonymous) return { status: "unavailable", message: "You are already signed in. Use your existing workspace instead of replacing it." };
    const capabilities = await client.rpc("guest_access_capabilities");
    if (capabilities.error || capabilities.data?.version !== 1 || capabilities.data?.enabled !== true) return unavailable();
    if (!user) {
      const created = await client.auth.signInAnonymously({ options: { data: { display_name: name.name }, captchaToken } });
      if (created.error || !created.data.user?.is_anonymous) return { status: "unavailable", message: "Guest sign-in did not complete. Check your connection and verification, then retry." };
      user = created.data.user;
    }
    const result = await client.rpc("complete_guest_setup", { display_name: name.name });
    return result.error ? unavailable() : sessionResult(result.data, user.id);
  } catch { return unavailable(); }
}
export function createAccountResolver() {
  let version = 0;
  return {
    cancel() { version++; },
    async resolve(client: SupabaseClient, user: User, apply: (result: GuestSessionResult | { status: "regular" }) => void) {
      const current = ++version;
      const result = user.is_anonymous ? await resolveGuestSession(client, user) : { status: "regular" as const };
      if (version === current) apply(result);
    },
  };
}
