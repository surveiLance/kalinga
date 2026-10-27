import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createAuthCallbackAccess } from "@/lib/offline-access";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabasePublishableKey);

let browserClient: SupabaseClient | null = null;
let callbackAccess: ReturnType<typeof createAuthCallbackAccess> | null = null;
export function hasSupabaseAuthCallback(id?: string) { return callbackAccess?.matches(id) || false; }
export function clearSupabaseAuthCallback() { callbackAccess?.clear(); }

export function getSupabaseBrowserClient() {
  if (!supabaseUrl || !supabasePublishableKey) return null;

  if (!browserClient) {
    callbackAccess = createAuthCallbackAccess(typeof window === "undefined" ? "https://kalinga.invalid/" : window.location.href);
    browserClient = createClient(supabaseUrl, supabasePublishableKey, {
      global: { fetch: (input, init) => {
        const boundedRequest = String(input).startsWith(`${supabaseUrl}/auth/v1/`) || String(input).startsWith(`${supabaseUrl}/storage/v1/object/sign/`);
        return fetch(input, boundedRequest ? { ...init, signal: init?.signal ? AbortSignal.any([init.signal, AbortSignal.timeout(8000)]) : AbortSignal.timeout(8000) } : init);
      } },
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
    browserClient.auth.onAuthStateChange((event, session) => { callbackAccess?.accept(event, session); });
  }

  return browserClient;
}
