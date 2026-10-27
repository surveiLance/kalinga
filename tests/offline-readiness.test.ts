import { describe, expect, it } from "vitest";
import { offlineReadiness } from "@/lib/offline-readiness";
const base = { appPrepared: true, workspacePersisted: true, storageError: "", downloadCount: 2, downloadBytes: 1000, pendingCount: 0, cloudVerified: true, online: true };
describe("truthful offline readiness", () => {
  it("requires both application files and actual workspace persistence", () => {
    expect(offlineReadiness(base).readyForOffline).toBe(true);
    expect(offlineReadiness({ ...base, appPrepared: false }).readyForOffline).toBe(false);
    expect(offlineReadiness({ ...base, workspacePersisted: false }).readyForOffline).toBe(false);
    expect(offlineReadiness({ ...base, storageError: "full" }).readyForOffline).toBe(false);
  });
  it("keeps local availability distinct from authentication and sync", () => {
    const result = offlineReadiness({ ...base, cloudVerified: false, online: false, pendingCount: 3 });
    expect(result.readyForOffline).toBe(true);
    expect(result.syncMessage).toContain("3");
    expect(result.limitations.join(" ")).toContain("internet");
  });
});
