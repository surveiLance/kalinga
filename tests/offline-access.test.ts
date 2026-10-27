import { describe, expect, it } from "vitest";
import { createAccessEpoch, classifyAccessFailure, lockLocalWorkspace, localWorkspaceLocked, readLocalWorkspace, rememberLocalWorkspace, verifyTeacherSession } from "@/lib/offline-access";
import { workspaceStorageKey } from "@/lib/workspace-keys";
function storage() { const data = new Map<string, string>(); return { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); }, removeItem: (key: string) => { data.delete(key); } }; }
const record = { version: 1 as const, teacherId: "11111111-1111-4111-8111-111111111111", name: "Ana", email: "ana@example.test", verifiedAt: 1 };
describe("personal-device offline access", () => {
  it("opens only the eligible workspace and stores no credentials", () => {
    const local = storage(); rememberLocalWorkspace(local, record);
    expect(readLocalWorkspace(local)).toEqual(record);
    expect(local.getItem(workspaceStorageKey("teacher-" + record.teacherId, "offline-access"))).not.toContain("token");
  });
  it("sign-out wins over delayed cached-session restoration without deleting work", () => {
    const local = storage(); rememberLocalWorkspace(local, record);
    local.setItem(workspaceStorageKey("teacher-" + record.teacherId, "pending-writes"), "important");
    lockLocalWorkspace(local);
    expect(localWorkspaceLocked(local)).toBe(true);
    expect(readLocalWorkspace(local)).toBeNull();
    expect(() => rememberLocalWorkspace(local, record)).toThrow();
    expect(local.getItem(workspaceStorageKey("teacher-" + record.teacherId, "pending-writes"))).toBe("important");
    rememberLocalWorkspace(local, record, true);
    expect(readLocalWorkspace(local)?.teacherId).toBe(record.teacherId);
  });
  it("rejects malformed pointers and refuses to scan another account", () => {
    const local = storage(); rememberLocalWorkspace(local, record);
    local.setItem(workspaceStorageKey("device", "offline-workspace"), "../../another");
    expect(readLocalWorkspace(local)).toBeNull();
  });
  it("fails closed when browser storage cannot be read", () => {
    const local = { ...storage(), getItem: () => { throw new Error("blocked"); } };
    expect(readLocalWorkspace(local)).toBeNull();
    expect(localWorkspaceLocked(local)).toBe(true);
  });
  it("invalidates earlier verification when account or lock changes", () => {
    const epoch = createAccessEpoch(); const first = epoch.begin(); const second = epoch.begin();
    expect(epoch.current(first)).toBe(false); expect(epoch.current(second)).toBe(true);
    epoch.invalidate(); expect(epoch.current(second)).toBe(false);
  });
  it("distinguishes unreachable services from authoritative invalid credentials", () => {
    expect(classifyAccessFailure(new TypeError("Failed to fetch"))).toBe("network");
    expect(classifyAccessFailure({ status: 503 })).toBe("network");
    expect(classifyAccessFailure({ status: 401, code: "bad_jwt" })).toBe("auth");
    expect(classifyAccessFailure({ code: "refresh_token_not_found" })).toBe("auth");
    expect(classifyAccessFailure({ code: "PGRST301" })).toBe("auth");
    expect(classifyAccessFailure({ name: "AuthSessionMissingError" })).toBe("other");
  });
  it("does not treat a local marker as cloud authentication", async () => {
    const result = await verifyTeacherSession({ auth: { getSession: async () => ({ data: { session: null }, error: null }), getUser: async () => { throw new Error("must not request"); } } });
    expect(result.kind).toBe("signin");
  });
  it("bounds an unresponsive session refresh", async () => {
    const result = await verifyTeacherSession({ auth: { getSession: () => new Promise(() => {}), getUser: async () => ({ data: { user: null }, error: null }) } }, 5);
    expect(result.kind).toBe("network");
  });
  it("does not grant one session access based on another user's verification", async () => {
    const result = await verifyTeacherSession({ auth: { getSession: async () => ({ data: { session: { user: { id: "A" } } }, error: null }), getUser: async () => ({ data: { user: { id: "B" } }, error: null }) } });
    expect(result.kind).toBe("signin");
  });
});
