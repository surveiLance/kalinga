import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeAccountDetails, requestPasswordReset, finishPasswordRecovery, preservePlanIdentity, createProfileReadGate, prepareAccountUpdate } from "@/lib/account-controls";
describe('account controls', () => {
  it('validates teacher and school names without silently accepting control characters', () => {
    expect(normalizeAccountDetails('  Ana   Reyes ', '  Kasilayan  School  ')).toEqual({ ok: true, name: 'Ana Reyes', school: 'Kasilayan School' });
    for (const name of ['', 'A'.repeat(81), 'Ana\nReyes']) expect(normalizeAccountDetails(name, 'School').ok).toBe(false);
    expect(normalizeAccountDetails('Ana', 'X'.repeat(161)).ok).toBe(false);
    expect(normalizeAccountDetails('Ana', '').ok).toBe(true);
  });
  it('retains earlier lesson identity when account defaults change, preserving explicit blank schools', () => {
    const plans = [{ id: 'old', teacherName: undefined, schoolName: undefined }, { id: 'pinned', teacherName: 'Other', schoolName: '' }];
    expect(preservePlanIdentity(plans, 'Ana', 'Old School')).toEqual([{ id: 'old', teacherName: 'Ana', schoolName: 'Old School' }, { id: 'pinned', teacherName: 'Other', schoolName: '' }]);
    expect(plans[0].teacherName).toBeUndefined();
  });
  it('sends recovery only to the same app origin and includes the security token', async () => {
    let sent: unknown;
    const client = { auth: { resetPasswordForEmail: async (...args: unknown[]) => { sent = args; return { data: {}, error: null }; } } } as unknown as SupabaseClient;
    expect((await requestPasswordReset(client, ' ana@example.com ', 'https://kalinga.test/path', 'token')).ok).toBe(true);
    expect(sent).toEqual(['ana@example.com', { redirectTo: 'https://kalinga.test/?password-reset=1', captchaToken: 'token' }]);
  });
  it('rejects expired recovery sessions and mismatched passwords without changing credentials', async () => {
    const client = { auth: { getSession: async () => ({ data: { session: null }, error: null }), updateUser: async () => { throw Error('must not change password'); } } } as unknown as SupabaseClient;
    expect((await finishPasswordRecovery(client, 'longpassword', 'longpassword', 'teacher')).ok).toBe(false);
    expect((await finishPasswordRecovery(client, 'longpassword', 'different', 'teacher')).ok).toBe(false);
    expect((await finishPasswordRecovery(client, 'short', 'short', 'teacher')).ok).toBe(false);
  });
  it('updates passwords only for a live permanent recovery session and reports network failures', async () => {
    let received = '';
    const client = { auth: { getSession: async () => ({ data: { session: { user: { id: 'teacher', is_anonymous: false } } }, error: null }), updateUser: async ({ password }: { password: string }) => { received = password; return { data: {}, error: null }; } } } as unknown as SupabaseClient;
    expect((await finishPasswordRecovery(client, '  longpassword  ', '  longpassword  ', 'teacher')).ok).toBe(true);
    expect(received).toBe('  longpassword  ');
    client.auth.resetPasswordForEmail = async () => { throw Error('network'); };
    expect((await requestPasswordReset(client, 'ana@example.com', 'https://kalinga.test')).ok).toBe(false);
  });
  it('does not update a different account after a recovery-session switch', async () => {
    let changed = false;
    const client = { auth: { getSession: async () => ({ data: { session: { user: { id: 'B', is_anonymous: false } } }, error: null }), updateUser: async () => { changed = true; return { error: null }; } } } as unknown as SupabaseClient;
    expect((await finishPasswordRecovery(client, 'longpassword', 'longpassword', 'A')).ok).toBe(false);
    expect(changed).toBe(false);
  });
  it('ignores a delayed profile read after a settings edit or a newer account read', async () => {
    const gate = createProfileReadGate();
    let finish!: (value: string) => void;
    const applied: string[] = [];
    const read = gate.read(() => new Promise<string>((resolve) => { finish = resolve; }), (value) => applied.push(value));
    gate.invalidate(); applied.push('new settings'); finish('old server'); await read;
    expect(applied).toEqual(['new settings']);
    const old = gate.read(() => new Promise<string>((resolve) => { finish = resolve; }), (value) => applied.push(value));
    await gate.read(async () => 'account B', (value) => applied.push(value)); finish('account A'); await old;
    expect(applied).toEqual(['new settings', 'account B']);
  });
  it('waits for both profile and cloud plans before pinning legacy lesson identities', () => {
    const plans = [{ teacherName: undefined, schoolName: undefined }];
    expect(prepareAccountUpdate(plans, 'Ana', 'Old School', true, false, true).ok).toBe(false);
    expect(prepareAccountUpdate(plans, 'Ana', 'Old School', true, true, false).ok).toBe(false);
    expect(prepareAccountUpdate(plans, 'Ana', 'Old School', true, true, true)).toEqual({ ok: true, plans: [{ teacherName: 'Ana', schoolName: 'Old School' }] });
    expect(prepareAccountUpdate(plans, 'Ana', '', false, false, false).ok).toBe(true);
  });
});
