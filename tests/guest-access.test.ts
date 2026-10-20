import { describe, expect, it } from "vitest";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createAccountResolver, guestOperationMessage, normalizeGuestName, resolveGuestSession, startGuestSession } from "@/lib/guest-access";
import { workspaceStorageKey } from "@/lib/workspace-keys";
const guest = { id: 'aaaa0000-0000-0000-0000-000000000001', is_anonymous: true, user_metadata: {} } as User;
const identity = { enrolled: true, active: true, user_id: guest.id, display_name: 'Ana', mention_tag: '@guest_aaaa0000000000000000000000000001' };
function backend(options: { user?: User | null; failSetup?: boolean; enabled?: boolean; status?: unknown } = {}) {
  let user: User | null = options.user === undefined ? guest : options.user;
  let created = 0;
  const client = {
    auth: {
      getSession: async () => ({ data: { session: user ? { user } : null }, error: null }),
      signInAnonymously: async () => { created++; user = guest; return { data: { user: guest }, error: null }; },
    },
    rpc: async (name: string) => ({ data: name === 'guest_access_capabilities' ? { version: 1, enabled: options.enabled !== false } : name === 'guest_session_status' ? options.status ?? identity : identity, error: name === 'complete_guest_setup' && options.failSetup ? { message: 'Offline' } : null }),
  } as unknown as SupabaseClient;
  return { client, created: () => created };
}
describe('guest account setup', () => {
  it('explains guest limits without exposing arbitrary server errors', () => {
    expect(guestOperationMessage({ message: 'Guest questions limit reached. Please try later.' }, 'Fallback')).toContain('5 questions');
    expect(guestOperationMessage({ message: 'secret database details' }, 'Fallback')).toBe('Fallback');
  });
  it('normalizes human names and rejects blank, control characters and overlong names', () => {
    expect(normalizeGuestName('  Ana   Reyes  ')).toEqual({ ok: true, name: 'Ana Reyes' });
    for (const value of ['   ', 'A'.repeat(81), 'Ana\nReyes', 'Ana\u0000']) expect(normalizeGuestName(value).ok).toBe(false);
    expect(normalizeGuestName('Ána 李').ok).toBe(true);
  });
  it('reuses the same guest session on setup retries, including network failures', async () => {
    const api = backend({ failSetup: true });
    expect((await startGuestSession(api.client, 'Ana')).status).toBe('unavailable');
    await startGuestSession(api.client, 'Ana');
    expect(api.created()).toBe(0);
  });
  it('creates an individual guest only when no session exists', async () => {
    const api = backend({ user: null });
    expect(await startGuestSession(api.client, 'Ana', 'test-token')).toMatchObject({ status: 'ready', identity: { userId: guest.id, displayName: 'Ana' } });
    expect(api.created()).toBe(1);
    await startGuestSession(api.client, 'Ana');
    expect(api.created()).toBe(1);
    expect(workspaceStorageKey(`teacher-${guest.id}`, 'pending-writes')).not.toBe(workspaceStorageKey('prototype', 'pending-writes'));
  });
  it('does not replace permanent sessions or create accounts when backend entry is disabled', async () => {
    const regular = backend({ user: { ...guest, is_anonymous: false } });
    expect((await startGuestSession(regular.client, 'Ana')).status).toBe('unavailable');
    expect(regular.created()).toBe(0);
    const disabled = backend({ user: null, enabled: false });
    expect((await startGuestSession(disabled.client, 'Ana')).status).toBe('unavailable');
    expect(disabled.created()).toBe(0);
  });
  it('resolves missing, revoked and mismatched identities without opening a workspace', async () => {
    expect((await resolveGuestSession(backend({ status: { enrolled: false } }).client, guest)).status).toBe('setup-required');
    expect((await resolveGuestSession(backend({ status: { ...identity, active: false } }).client, guest)).status).toBe('revoked');
    expect((await resolveGuestSession(backend({ status: { ...identity, user_id: 'someone-else' } }).client, guest)).status).toBe('unavailable');
  });
  it('accepts only the newest asynchronous account resolution and ignores results after cancellation', async () => {
    let finish!: (value: unknown) => void;
    const slow = { rpc: () => new Promise((resolve) => { finish = resolve; }) } as unknown as SupabaseClient;
    const gate = createAccountResolver();
    const accepted: string[] = [];
    const old = gate.resolve(slow, guest, () => accepted.push('old'));
    await gate.resolve(backend().client, { ...guest, id: 'regular', is_anonymous: false }, () => accepted.push('regular'));
    finish({ data: identity, error: null }); await old;
    expect(accepted).toEqual(['regular']);
    const pending = gate.resolve(slow, guest, () => accepted.push('cancelled'));
    gate.cancel(); finish({ data: identity, error: null }); await pending;
    expect(accepted).toEqual(['regular']);
  });
});
