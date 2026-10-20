import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { WalkthroughOffer, WalkthroughCard } from "@/components/gabay-walkthrough";
describe("walkthrough controls", () => {
  it("replaces off-screen instructions with directions and pauses Next", () => {
    const markup = renderToStaticMarkup(createElement(WalkthroughCard, { step: 7, targetFound: false, canAdvance: false, onMove: () => {}, onExit: () => {}, onLocate: () => {} }));
    expect(markup).toContain("Let’s find this step");
    expect(markup).not.toContain("Check the class, subject, topic, and teaching date.");
    expect(markup).toMatch(/disabled=""[^>]*>Next/);
    expect(markup).toContain("Skip step");
  });
  it("offers an explicit opt-out and explains that the teacher operates real controls", () => {
    const markup = renderToStaticMarkup(createElement(WalkthroughOffer, { onStart: () => {}, onDismiss: () => {} }));
    expect(markup).toContain('aria-modal="true"');
    expect(markup).toContain("Not now");
    expect(markup).toContain("You stay in control");
  });
  it("keeps every step skippable and gives missing-target directions rather than fake controls", () => {
    const markup = renderToStaticMarkup(createElement(WalkthroughCard, { step: 0, targetFound: false, onMove: () => {}, onExit: () => {}, onLocate: () => {} }));
    expect(markup).toContain("Skip step");
    expect(markup).toContain('tabindex="-1"');
    expect(markup).toContain("Exit tour");
    expect(markup).toContain("On a phone, tap Classes below.");
    expect(markup).not.toContain('aria-modal="true"');
  });
});
