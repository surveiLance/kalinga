import { describe, expect, it } from "vitest";
import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildOfflineWorker } from "../scripts/build-offline-worker.mjs";
import { offlinePageMatchesAssets, offlineUpdateReady } from "@/lib/offline-availability";

describe("offline build inventory", () => {
  it("includes cold lazy imports and fonts but excludes maps and resource snapshots", async () => {
    const root = await mkdtemp(join(tmpdir(), "kalinga-build-"));
    try {
      for (const dir of [".next/server/app", ".next/static/chunks", ".next/static/media", "public/offline", "public/resources"]) await mkdir(join(root, dir), { recursive: true });
      for (const [path, content] of Object.entries({ ".next/server/app/index.html": "<html>clean shell</html>", ".next/static/chunks/main.js": "main", ".next/static/chunks/word.js": "lazy Word", ".next/static/chunks/main.js.map": "private source", ".next/static/media/font.woff2": "font", "public/offline/pdf.worker.min.mjs": "worker", "public/resources/private.pdf": "not an app asset" })) await writeFile(join(root, path), content);
      const result = await buildOfflineWorker(root);
      expect(result.assets).toContain("/_next/static/chunks/word.js");
      expect(result.assets).toContain("/_next/static/media/font.woff2");
      expect(result.assets).toContain("/offline/pdf.worker.min.mjs");
      expect(result.assets).not.toContain("/_next/static/chunks/main.js.map");
      expect(result.assets).not.toContain("/resources/private.pdf");
      expect(await readFile(join(root, "public/offline/shell.html"), "utf8")).toBe("<html>clean shell</html>");
      expect((await buildOfflineWorker(root)).version).toBe(result.version);
    } finally { await rm(root, { recursive: true, force: true }); }
  });

  it("rejects a current page from a different deployment", () => {
    expect(offlinePageMatchesAssets(["/_next/static/new.js"], ["/_next/static/old.js"])).toBe(false);
    expect(offlinePageMatchesAssets(["/_next/static/main.js"], ["/_next/static/main.js", "/_next/static/word.js"])).toBe(true);
    expect(offlinePageMatchesAssets([], ["/_next/static/main.js"])).toBe(false);
  });
  it("offers in-app activation only for complete updates supporting the new update protocol", () => {
    expect(offlineUpdateReady({ prepared: true })).toBe(false);
    expect(offlineUpdateReady({ prepared: false, canApplyUpdate: true })).toBe(false);
    expect(offlineUpdateReady({ prepared: true, canApplyUpdate: true })).toBe(true);
  });
});
