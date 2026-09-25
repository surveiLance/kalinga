import { describe, expect, it } from "vitest";
import { redactGabayPII } from "@/supabase/functions/_shared/gabay-privacy";

describe("redactGabayPII", () => {
  it("removes known learner names without changing ordinary lesson text", () => {
    expect(redactGabayPII("Please help Juan Dela Cruz with fractions.", ["Juan Dela Cruz"]))
      .toBe("Please help [learner name removed] with fractions.");
  });

  it("matches names case-insensitively and prefers the longest roster name", () => {
    expect(redactGabayPII("ANA SANTOS and Ana need support.", ["Ana", "Ana Santos"]))
      .toBe("[learner name removed] and [learner name removed] need support.");
  });

  it("removes twelve-digit learner identifiers with spaces or hyphens", () => {
    expect(redactGabayPII("LRN 1234-5678-9012", [])).toBe("LRN [learner identifier removed]");
    expect(redactGabayPII("LRN 1234 5678 9012", [])).toBe("LRN [learner identifier removed]");
  });
});
