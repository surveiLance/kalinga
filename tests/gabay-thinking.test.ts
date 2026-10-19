import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

describe("Gabay chat waiting indicator", () => {
  it("announces thinking while showing the mascot instead of a waiting sentence", async () => {
    const { GabayThinking } = await import("../components/gabay-thinking");
    const markup = renderToStaticMarkup(createElement(GabayThinking, { motion: true }));
    expect(markup).toContain('role="status"');
    expect(markup).toContain("Gabay is thinking");
    expect(markup).toContain("gabay-mascot-body");
    expect(markup).not.toContain("Sandali");
  });

  it("honors the app's motion-off preference without removing the waiting status", async () => {
    const { GabayThinking } = await import("../components/gabay-thinking");
    const markup = renderToStaticMarkup(createElement(GabayThinking, { motion: false }));
    expect(markup).toContain("motion-paused");
    expect(markup).toContain("Gabay is thinking");
    expect(markup).toContain('aria-hidden="true"');
  });
});
