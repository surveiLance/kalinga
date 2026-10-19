import { beforeEach, describe, expect, it, vi } from "vitest";
import { requestGabayRevision } from "@/lib/gabay-ai";
import { revisionSource } from "@/lib/lesson-revisions";
import { revisionTaskKind, revisionPrompt, generateRevision } from "../supabase/functions/_shared/gabay-revision";
const backend = vi.hoisted(() => ({ configured: true, session: true, replies: [] as Array<{ data: unknown; error: unknown }>, calls: [] as unknown[] }));
vi.mock("@/lib/supabase/client", () => ({ isSupabaseConfigured: true, getSupabaseBrowserClient: () => !backend.configured ? null : { auth: { getSession: async () => ({ data: { session: backend.session ? {} : null } }) }, functions: { invoke: async (_: string, options: unknown) => { backend.calls.push(options); return backend.replies.shift() || { data: null, error: null }; } } } }));
const request = { id: "r1", instruction: "Use leaves", scope: "experience" as const, source: revisionSource({ id: "p", classId: "c", title: "Plants", subject: "Science", grades: ["3"], duration: "60 minutes", quarter: "Quarter 1", materials: "Paper", slots: [{ id: "s1", time: "8:00 AM", durationMinutes: 60, teacherFocus: "Guide Grade 3", gradeTasks: { "3": "Observe" } }], savedAt: "today" }) };
const context = { view: "plan", gradeLevels: ["3"], classId: "c", offline: false };
const capabilities = { data: { revisionVersion: 1 }, error: null };
beforeEach(() => { backend.configured = true; backend.session = true; backend.calls = []; backend.replies = []; });
describe("revision boundary", () => {
  it("validates actual inference responses and handles provider rate limits", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ id: request.id, changes: [{ field: "materials", value: "Leaves" }] }) } }] })));
    expect(await generateRevision(request, "test-key", "test-model", fetcher)).toMatchObject({ status: 200, proposal: { changes: [{ field: "materials", value: "Leaves" }] } });
    expect(fetcher.mock.calls[0][1]?.signal).toBeInstanceOf(AbortSignal);
    fetcher.mockResolvedValueOnce(new Response("", { status: 429 }));
    expect(await generateRevision(request, "test-key", "test-model", fetcher)).toMatchObject({ status: 429 });
    fetcher.mockResolvedValueOnce(new Response(JSON.stringify({ choices: [{ message: { content: '{"id":"r1","changes":[{"field":"title","value":"Changed"}]}' } }] })));
    await expect(generateRevision(request, "test-key", "test-model", fetcher)).rejects.toThrow();
  });
  it("rejects unknown tasks rather than falling through to chat", () => {
    expect(revisionTaskKind(undefined)).toBe("chat");
    expect(revisionTaskKind({ type: "full-plan" })).toBe("full-plan");
    expect(revisionTaskKind({ type: "revise-plan" })).toBe("revise-plan");
    expect(() => revisionTaskKind({ type: "reivse-plan" })).toThrow();
  });
  it("includes protected reference context and scoped instructions in the revision prompt", () => {
    expect(revisionPrompt(request)).toContain("Use leaves");
    expect(revisionPrompt(request)).toContain("experience");
    expect(revisionPrompt(request)).toContain("curriculum");
  });
  it("does not call inference in prototype or signed-out mode", async () => {
    backend.configured = false;
    expect(await requestGabayRevision(request, context)).toMatchObject({ connected: false, reason: "not-configured" });
    backend.configured = true; backend.session = false;
    expect(await requestGabayRevision(request, context)).toMatchObject({ connected: false, reason: "not-signed-in" });
    expect(backend.calls).toEqual([]);
  });
  it("capability-gates older deployed functions without sending the lesson", async () => {
    backend.replies = [{ data: { reply: "Legacy chat answer" }, error: null }];
    expect(await requestGabayRevision(request, context)).toMatchObject({ connected: false, reason: "unsupported" });
    expect(backend.calls).toHaveLength(1);
    expect(JSON.stringify(backend.calls)).not.toContain("Plants");
  });
  it("validates a provider proposal before returning it to the editor", async () => {
    backend.replies = [capabilities, { data: { proposal: { id: "r1", changes: [{ field: "materials", value: "Leaves" }] } }, error: null }];
    expect(await requestGabayRevision(request, context)).toMatchObject({ connected: true, proposal: { changes: [{ field: "materials", value: "Leaves" }] } });
    expect(JSON.stringify(backend.calls[1])).toContain('"type":"revise-plan"');
    backend.replies = [capabilities, { data: { proposal: { id: "r1", changes: [{ field: "competencyCodes", grade: "3", value: "Invented" }] } }, error: null }];
    expect(await requestGabayRevision(request, context)).toMatchObject({ connected: false, reason: "unavailable" });
  });
  it("handles rate limits and cancelled requests without a mutation result", async () => {
    backend.replies = [capabilities, { data: null, error: { context: { status: 429 } } }];
    expect(await requestGabayRevision(request, context)).toMatchObject({ connected: false, reason: "busy" });
    const controller = new AbortController(); controller.abort();
    expect(await requestGabayRevision(request, context, controller.signal)).toMatchObject({ connected: false, reason: "cancelled" });
  });
});
