import { describe, expect, it, vi } from "vitest";
import { checkGuestGabayAccess, runGuestGabayTask } from "../supabase/functions/_shared/guest-access";
function client(status: unknown, quota: unknown, broken = false) {
  return { rpc: async (name: string) => { if (broken) throw new Error("Offline"); return { data: name === "guest_session_status" ? status : quota, error: null }; } };
}
const member = { enrolled: true, active: true };
describe("guest Gabay authorization", () => {
  it.each(['chat', 'full-plan', 'revise-plan'])("blocks the %s provider pipeline on denied guest access", async (task) => {
    const inference = vi.fn(async () => new Response('Provider response'));
    const response = await runGuestGabayTask(client({ enrolled: false }, null), true, task, inference, (decision) => new Response('Denied', { status: decision.status }));
    expect(response.status).toBe(403);
    expect(inference).not.toHaveBeenCalled();
  });
  it("keeps permanent users independent of guest setup", async () => {
    expect(await checkGuestGabayAccess(client(null, null, true), false)).toMatchObject({ allowed: true, status: 200 });
  });
  it("denies missing and revoked memberships", async () => {
    expect(await checkGuestGabayAccess(client({ enrolled: false }, null), true)).toMatchObject({ allowed: false, status: 403 });
    expect(await checkGuestGabayAccess(client({ enrolled: true, active: false }, null), true)).toMatchObject({ allowed: false, status: 403 });
  });
  it("fails closed for RPC exceptions, errors, and malformed quotas", async () => {
    expect(await checkGuestGabayAccess(client(member, null, true), true)).toMatchObject({ allowed: false, status: 503 });
    expect(await checkGuestGabayAccess({ rpc: async () => ({ data: null, error: { message: "DB down" } }) }, true)).toMatchObject({ allowed: false, status: 503 });
    expect(await checkGuestGabayAccess(client(member, {}), true)).toMatchObject({ allowed: false, status: 503 });
  });
  it("returns rate limits with a bounded retry and accepts valid quota", async () => {
    expect(await checkGuestGabayAccess(client(member, { allowed: false, retry_after_seconds: 120 }), true)).toEqual({ allowed: false, status: 429, retryAfter: 120 });
    expect(await checkGuestGabayAccess(client(member, { allowed: true, retry_after_seconds: 0 }), true)).toEqual({ allowed: true, status: 200 });
  });
  it("does not consume AI quota for capability checks", async () => {
    expect(await checkGuestGabayAccess(client(member, null), true, false)).toEqual({ allowed: true, status: 200 });
  });
});
