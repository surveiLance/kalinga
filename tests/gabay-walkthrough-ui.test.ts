import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { WalkthroughOffer, WalkthroughCard } from "@/components/gabay-walkthrough";
import { PageGuideButton } from "@/components/page-guides";
describe("walkthrough controls", () => {
  const item = { id: "plan-edit", title: "Edit the ILAW document", body: "Review each grade before saving.", targets: ["plan-document"] };
  const controls = { onMove: () => {}, onExit: () => {}, onLocate: () => {} };
  it("provides manual help as a non-submitting button, including inside a popup", () => {
    const markup = renderToStaticMarkup(createElement(PageGuideButton, { onStart: () => {}, compact: true }));
    expect(markup).toContain('type="button"');
    expect(markup).toContain("Guide this page");
    expect(markup).not.toContain('type="submit"');
  });
  it("gives missing-target guidance without trapping the teacher or pointing to another page", () => {
    const markup = renderToStaticMarkup(createElement(WalkthroughCard, { item, pageLabel: "Plan lessons", step: 1, total: 3, targetFound: false, ...controls }));
    expect(markup).not.toContain(item.body);
    expect(markup).toContain("not visible");
    expect(markup).not.toMatch(/disabled=""[^>]*>Next/);
    expect(markup).not.toContain("Show the highlighted area");
  });
  it("offers non-blocking help for this page with an explicit opt-out", () => {
    const markup = renderToStaticMarkup(createElement(WalkthroughOffer, { pageLabel: "Classes & learners", onShown: () => {}, onStart: () => {}, onDismiss: () => {} }));
    expect(markup).not.toContain("<dialog");
    expect(markup).not.toContain('aria-modal="true"');
    expect(markup).toContain("Show me");
    expect(markup).toContain("Not now");
    expect(markup).toContain("Classes &amp; learners");
    expect(markup).toContain("You stay in control");
  });
  it("counts only the current page and finishes without a cross-page chapter selector", () => {
    const markup = renderToStaticMarkup(createElement(WalkthroughCard, { item, pageLabel: "Plan lessons", step: 1, total: 2, targetFound: true, ...controls }));
    expect(markup).toContain("2 of 2");
    expect(markup).toContain(item.body);
    expect(markup).toContain("Finish guide");
    expect(markup).toContain("Exit guide");
    expect(markup).not.toContain("<select");
    expect(markup).not.toContain('type="submit"');
  });
});
