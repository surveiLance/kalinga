import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { GuestEntry } from "@/components/guest-entry";
describe('guest name entry', () => {
  it('asks for a name without email/password and explains browser session limits', () => {
    const html = renderToStaticMarkup(createElement(GuestEntry, { configured: true, onContinue: async () => ({ ok: true }), onCancel: () => {} }));
    expect(html).toContain('Your name'); expect(html).toMatch(/maxlength="80"/i);
    expect(html).not.toContain('type="email"'); expect(html).not.toContain('type="password"');
    expect(html).toContain('clearing browser data'); expect(html).toContain('Back to sign in');
  });
  it('does not promise connected access when configuration is missing', () => {
    const html = renderToStaticMarkup(createElement(GuestEntry, { configured: false, message: 'Network unavailable', onContinue: async () => ({ ok: false }), onCancel: () => {} }));
    expect(html).toContain('Guest testing is not available yet');
    expect(html).toContain('role="alert"'); expect(html).toContain('disabled=""');
  });
});
