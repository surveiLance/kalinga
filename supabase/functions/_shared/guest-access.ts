export type GuestGuardClient = { rpc: (name: string) => PromiseLike<{ data: unknown; error: unknown }> };
export type GuestAccessDecision = { allowed: boolean; status: 200 | 403 | 429 | 503; retryAfter?: number };
export async function checkGuestGabayAccess(client: GuestGuardClient, anonymous: boolean, consume = true): Promise<GuestAccessDecision> {
  if (!anonymous) return { allowed: true, status: 200 };
  try {
    const membership = await client.rpc("guest_session_status");
    if (membership.error || !membership.data || typeof membership.data !== "object") return { allowed: false, status: 503 };
    const member = membership.data as Record<string, unknown>;
    if (member.enrolled !== true || member.active !== true) return { allowed: false, status: 403 };
    if (!consume) return { allowed: true, status: 200 };
    const result = await client.rpc("claim_guest_gabay_request");
    if (result.error || !result.data || typeof result.data !== "object") return { allowed: false, status: 503 };
    const quota = result.data as Record<string, unknown>;
    if (quota.allowed === true) return { allowed: true, status: 200 };
    if (quota.allowed !== false) return { allowed: false, status: 503 };
    const retry = Number(quota.retry_after_seconds);
    return { allowed: false, status: 429, retryAfter: Number.isFinite(retry) ? Math.max(1, Math.min(86400, Math.ceil(retry))) : 60 };
  } catch { return { allowed: false, status: 503 }; }
}
export async function runGuestGabayTask(client: GuestGuardClient, anonymous: boolean, task: string, dispatch: () => Promise<Response>, deny: (decision: GuestAccessDecision) => Response) {
  const decision = await checkGuestGabayAccess(client, anonymous, task !== "revision-capabilities");
  return decision.allowed ? dispatch() : deny(decision);
}
