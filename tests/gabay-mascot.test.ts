import { describe, expect, test } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

async function loadMascotModule() {
  try {
    return await import("../lib/gabay-mascot");
  } catch {
    return undefined;
  }
}

async function loadMascotComponent() {
  try {
    return await import("../components/gabay-mascot");
  } catch {
    return undefined;
  }
}

describe("Gabay mascot presentation", () => {
  test("keeps motion and speaking states independent", async () => {
    const mascot = await loadMascotModule();

    expect(mascot?.gabayMascotClassName("small", true, false)).toBe(
      "gabay-mascot gabay-mascot-small",
    );
    expect(mascot?.gabayMascotClassName("hero", false, true)).toBe(
      "gabay-mascot gabay-mascot-hero motion-paused is-speaking",
    );
  });

  test("keeps Gabay's body fixed while exposing one independently animated arm", async () => {
    const mascot = await loadMascotComponent();

    expect(mascot?.GabayMascot).toBeDefined();

    const markup = renderToStaticMarkup(
      createElement(mascot!.GabayMascot, { size: "hero" }),
    );

    expect(markup).toContain('aria-hidden="true"');
    expect(markup).toContain('class="gabay-mascot-body"');
    expect(markup).toContain('class="gabay-mascot-arm"');
    expect(markup).not.toContain("gabay-mascot-neutral");
    expect(markup).not.toContain("gabay-mascot-wave");
  });

  test("renders the same permanent aura while idle and speaking", async () => {
    const mascot = await loadMascotComponent();

    expect(mascot?.GabayMascot).toBeDefined();

    const idleMarkup = renderToStaticMarkup(
      createElement(mascot!.GabayMascot, { size: "hero" }),
    );
    const speakingMarkup = renderToStaticMarkup(
      createElement(mascot!.GabayMascot, { size: "hero", speaking: true }),
    );

    expect(idleMarkup.match(/class="gabay-mascot-aura"/g)).toHaveLength(1);
    expect(speakingMarkup.match(/class="gabay-mascot-aura"/g)).toHaveLength(1);
    expect(speakingMarkup).toContain("is-speaking");
  });
});
