import { workspaceStorageKey } from "@/lib/workspace-keys";
export type LocalAccessRecord = { version: 1; teacherId: string; name: string; email: string; verifiedAt: number };
type DeviceStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;
const pointerKey = workspaceStorageKey("device", "offline-workspace"), lockKey = workspaceStorageKey("device", "offline-lock");
const teacherIdValid = (id: unknown): id is string => typeof id === "string" && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id);
export function localWorkspaceLocked(storage: DeviceStorage) { try { return !!storage.getItem(lockKey); } catch { return true; } }
export function readLocalWorkspace(storage: DeviceStorage): LocalAccessRecord | null {
  try {
    if (localWorkspaceLocked(storage)) return null;
    const id = storage.getItem(pointerKey);
    if (!teacherIdValid(id)) return null;
    const value = JSON.parse(storage.getItem(workspaceStorageKey(`teacher-${id}`, "offline-access")) || "null");
    return value?.version === 1 && value.teacherId === id && typeof value.name === "string" && typeof value.email === "string" && Number.isFinite(value.verifiedAt) ? value : null;
  } catch { return null; }
}
export function rememberLocalWorkspace(storage: DeviceStorage, record: LocalAccessRecord, unlock = false) {
  if (!teacherIdValid(record.teacherId) || record.version !== 1 || !Number.isFinite(record.verifiedAt)) throw new Error("The teacher identity is not valid.");
  if (localWorkspaceLocked(storage) && !unlock) throw new Error("Sign in again to unlock this device workspace.");
  storage.setItem(workspaceStorageKey(`teacher-${record.teacherId}`, "offline-access"), JSON.stringify(record));
  storage.setItem(pointerKey, record.teacherId);
  if (unlock) storage.removeItem(lockKey);
}
export function lockLocalWorkspace(storage: DeviceStorage) {
  storage.setItem(lockKey, crypto.randomUUID());
  storage.removeItem(pointerKey);
}
export function createAccessEpoch() {
  let version = 0;
  return { begin() { return ++version; }, invalidate() { version++; }, current(value: number) { return value === version; } };
}
export function classifyAccessFailure(error: unknown): "network" | "auth" | "other" {
  const value = error && typeof error === "object" ? error as { status?: number; code?: string; name?: string } : {};
  if (value.status === 401 || value.status === 403 || /^(PGRST301|PGRST303|bad_jwt|invalid_jwt|refresh_token_not_found|refresh_token_already_used|session_not_found|session_expired|user_banned)$/.test(value.code || "")) return "auth";
  if (error instanceof TypeError || value.status && value.status >= 500 || /Fetch|Timeout|Abort/.test(value.name || "")) return "network";
  return "other";
}
type UserIdentity = { id: string; is_anonymous?: boolean };
type Verification<T> = { kind: "ready"; user: T } | { kind: "network" | "denied" | "signin" };
export async function verifyTeacherSession<T extends UserIdentity>(client: { auth: { getSession(): PromiseLike<{ data: { session: { user: T } | null }; error: unknown }>; getUser(): PromiseLike<{ data: { user: T | null }; error: unknown }> } }, timeoutMs = 8000): Promise<Verification<T>> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const verify = async (): Promise<Verification<T>> => {
    try {
      const session = await client.auth.getSession();
      if (session.error) return { kind: classifyAccessFailure(session.error) === "auth" ? "denied" : "network" };
      if (!session.data.session) return { kind: "signin" };
      const verified = await client.auth.getUser();
      if (verified.error) return { kind: classifyAccessFailure(verified.error) === "auth" ? "denied" : "network" };
      return verified.data.user?.id === session.data.session.user.id ? { kind: "ready", user: verified.data.user } : { kind: "signin" };
    } catch (error) { return { kind: classifyAccessFailure(error) === "auth" ? "denied" : "network" }; }
  };
  try { return await Promise.race([verify(), new Promise<Verification<T>>((resolve) => { timer = setTimeout(() => resolve({ kind: "network" }), timeoutMs); })]); }
  finally { clearTimeout(timer); }
}
