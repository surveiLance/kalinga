import { describe, expect, it, vi } from "vitest";
import { formatInterfaceDate, interfaceTranslations, setInterfaceLanguage, translateInterface } from "@/lib/interface-language";
import { askConnectedGabay } from "@/lib/gabay-ai";
const backend = vi.hoisted(() => ({ invoke: vi.fn(async () => ({ data: { reply: "Test reply" }, error: null })) }));
vi.mock("@/lib/supabase/client", () => ({ isSupabaseConfigured: () => true, getSupabaseBrowserClient: () => ({ auth: { getSession: async () => ({ data: { session: {} } }) }, functions: { invoke: backend.invoke } }) }));

describe("interface language consistency", () => {
  it("keeps every variable available in both translations", () => {
    const variables = (text: string) => [...text.matchAll(/\{\w+\}/g)].map((match) => match[0]).sort();
    for (const [key, translations] of Object.entries(interfaceTranslations)) for (const value of translations) {
      expect(value.trim(), key).not.toBe("");
      expect(variables(value), key).toEqual(variables(key));
    }
  });
  it("inserts dynamic values literally without translating teacher content", () => {
    expect(translateInterface("fil", "Ready to help with {page}", { page: "18C $& {count}" })).toBe("Handang tumulong sa 18C $& {count}");
    expect(translateInterface("hil", "{count} learners", { count: 3 })).toBe("3 ka estudyante");
    expect(translateInterface("fil", "Teacher’s original lesson title")).toBe("Teacher’s original lesson title");
  });
  it("localizes weekdays and months without relying on Hiligaynon browser locale support", () => {
    const date = new Date(2026, 10, 9, 12);
    expect(formatInterfaceDate("hil", date)).toContain("Lunes");
    expect(formatInterfaceDate("hil", date)).toContain("Nobyembre");
    expect(formatInterfaceDate("en", date)).toContain("November");
  });
  it("sends the current selected language for new replies while preserving old messages and lesson language", async () => {
    vi.stubGlobal("window", { localStorage: { setItem: vi.fn() } });
    const history = [{ role: "gabay" as const, text: "Original English reply" }];
    const pageContext = { view: "plan", gradeLevels: ["3"], language: "English", responseLanguage: "en" as const, offline: false };
    try {
      for (const language of ["fil", "hil", "en"] as const) {
        setInterfaceLanguage(language);
        await askConnectedGabay("hello", pageContext, history);
        expect(backend.invoke).toHaveBeenLastCalledWith("gabay-chat", { body: { message: "hello", pageContext: { ...pageContext, responseLanguage: language }, history } });
      }
      expect(history[0].text).toBe("Original English reply");
      expect(pageContext.language).toBe("English");
    } finally { setInterfaceLanguage("en"); vi.unstubAllGlobals(); }
  });
});
