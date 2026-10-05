export type GabayMascotSize = "small" | "medium" | "large" | "hero" | "companion";

export function gabayMascotClassName(size: GabayMascotSize, motion: boolean, speaking: boolean) {
  return [
    "gabay-mascot",
    `gabay-mascot-${size}`,
    motion ? "" : "motion-paused",
    speaking ? "is-speaking" : "",
  ].filter(Boolean).join(" ");
}
