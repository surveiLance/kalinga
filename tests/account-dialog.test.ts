import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AccountDialog, PasswordRecoveryScreen } from "@/components/account-controls";
const props = { name: 'Ana', school: 'School', email: 'ana@example.com', guest: false, authenticated: true, onClose: () => {}, onSave: async () => ({ ok: true }) };
describe('account control screens', () => {
  it('provides named editable details, read-only email and no disabled placeholder controls', () => {
    const html = renderToStaticMarkup(createElement(AccountDialog, { ...props, kind: 'settings' }));
    expect(html).toContain('Teacher name'); expect(html).toContain('School name'); expect(html).toContain('ana@example.com');
    expect(html).toContain('Save account details'); expect(html).not.toContain('Coming soon');
  });
  it('keeps guest identity fixed and explains local-only demo storage', () => {
    const guest = renderToStaticMarkup(createElement(AccountDialog, { ...props, kind: 'settings', guest: true }));
    expect(guest).toContain('readOnly=""'); expect(guest).toContain('guest name');
    const demo = renderToStaticMarkup(createElement(AccountDialog, { ...props, kind: 'settings', authenticated: false }));
    expect(demo).toContain('this browser');
  });
  it('shows actionable help and a recovery form with password confirmation', () => {
    const help = renderToStaticMarkup(createElement(AccountDialog, { ...props, kind: 'help' }));
    expect(help).toContain('PDF'); expect(help).toContain('Word'); expect(help).toContain('review');
    const recovery = renderToStaticMarkup(createElement(PasswordRecoveryScreen, { accountId: 'teacher', onComplete: () => {}, onCancel: () => {} }));
    expect(recovery).toContain('Confirm new password'); expect(recovery).toContain('minLength="8"');
  });
});
