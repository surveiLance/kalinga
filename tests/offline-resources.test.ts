import { beforeEach, describe, expect, it, vi } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import { downloadOfflineResource, getOfflineResource, listOfflineResources, removeOfflineResource, waitForOfflineResourceLink, type OfflineResourceInfo } from "@/lib/offline-resources";
const a = "teacher-11111111-1111-4111-8111-111111111111", b = "teacher-22222222-2222-4222-8222-222222222222";
const info: OfflineResourceInfo = { id: "pdf-a", title: "Local plants", source: "teacher", storagePath: "owner/file.pdf", subject: "Science", grades: "3, 4", description: "Observe plants", tags: [], author: "Teacher", visibility: "shared", type: "Guide", pages: 1 };
const pdf = "%PDF-1.4\nbody\n%%EOF";
const options = { isCurrent: () => true };
beforeEach(() => { vi.stubGlobal("indexedDB", new IDBFactory()); vi.stubGlobal("fetch", async () => new Response(pdf, { headers: { "Content-Type": "application/pdf" } })); });
describe("scoped offline PDF snapshots", () => {
  it("restores actual bytes without retaining a signed URL and isolates accounts", async () => {
    await downloadOfflineResource(a, info, "https://storage.test/a?token=private", options);
    expect(await (await getOfflineResource(a, info.id))?.blob.text()).toBe(pdf);
    expect(JSON.stringify((await listOfflineResources(a))[0].info)).not.toContain("token");
    expect(await listOfflineResources(b)).toEqual([]);
    expect(await listOfflineResources("prototype")).toEqual([]);
  });
  it("removes only this account's snapshot", async () => {
    await downloadOfflineResource(a, info, "/file.pdf", options);
    await downloadOfflineResource(b, info, "/file.pdf", options);
    await removeOfflineResource(a, info.id);
    expect(await getOfflineResource(a, info.id)).toBeUndefined();
    expect((await listOfflineResources(b)).length).toBe(1);
  });
  it.each([["text/html", "<html>not a PDF</html>", ""], ["application/pdf", "%PDF-1.4\ntruncated", ""], ["application/pdf", pdf, "99999"], ["application/pdf", pdf, "20971521"]])("rejects non-PDF, incomplete and oversized transfers (%s, %s)", async (type, body, size) => {
    vi.stubGlobal("fetch", async () => new Response(body, { headers: { "Content-Type": type, ...(size ? { "Content-Length": size } : {}) } }));
    await expect(downloadOfflineResource(a, info, "/file.pdf", options)).rejects.toThrow();
    expect(await listOfflineResources(a)).toEqual([]);
  });
  it("keeps a good copy when replacement fails", async () => {
    await downloadOfflineResource(a, info, "/file.pdf", options);
    vi.stubGlobal("fetch", async () => { throw new TypeError("offline"); });
    await expect(downloadOfflineResource(a, { ...info, title: "Replacement" }, "/file.pdf", options)).rejects.toThrow();
    expect((await getOfflineResource(a, info.id))?.info.title).toBe("Local plants");
  });
  it("does not compare compressed transfer length with the decoded PDF body", async () => {
    vi.stubGlobal("fetch", async () => new Response(pdf, { headers: { "Content-Type": "application/pdf", "Content-Encoding": "gzip", "Content-Length": "10" } }));
    await downloadOfflineResource(a, info, "/file.pdf", options);
    expect((await getOfflineResource(a, info.id))?.size).toBe(pdf.length);
  });
  it("cannot resurrect a download removed while its response is pending", async () => {
    let respond!: (r: Response) => void;
    vi.stubGlobal("fetch", () => new Promise<Response>((resolve) => { respond = resolve; }));
    const pending = downloadOfflineResource(a, info, "/file.pdf", options);
    await vi.waitFor(() => expect(respond).toBeDefined());
    await removeOfflineResource(a, info.id);
    respond(new Response(pdf, { headers: { "Content-Type": "application/pdf" } }));
    await expect(pending).rejects.toThrow();
    expect(await listOfflineResources(a)).toEqual([]);
  });
  it("does not commit after the account changes or an operation is aborted", async () => {
    await expect(downloadOfflineResource(a, info, "/file.pdf", { isCurrent: () => false })).rejects.toThrow();
    await expect(downloadOfflineResource(a, info, "/file.pdf", { signal: AbortSignal.abort(), isCurrent: () => true })).rejects.toThrow();
    expect(await listOfflineResources(a)).toEqual([]);
  });
  it("caps a streamed body even with no declared size", async () => {
    const stream = new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(20 * 1024 * 1024 + 1)); controller.close(); } });
    vi.stubGlobal("fetch", async () => new Response(stream, { headers: { "Content-Type": "application/pdf" } }));
    await expect(downloadOfflineResource(a, info, "/file.pdf", options)).rejects.toThrow(/20 MB/);
    expect(await listOfflineResources(a)).toEqual([]);
  });
  it("bounds link renewal before any PDF bytes are requested", async () => {
    await expect(waitForOfflineResourceLink(() => new Promise<string>(() => {}), undefined, 5)).rejects.toThrow(/renewed/);
  });
  it("cancels an unresponsive link renewal and ignores its late result", async () => {
    const controller = new AbortController(); let finish!: (url: string) => void;
    const pending = waitForOfflineResourceLink(() => new Promise<string>((resolve) => { finish = resolve; }), controller.signal);
    controller.abort();
    await expect(pending).rejects.toThrow(/cancelled/);
    finish("https://storage.test/late.pdf");
    const request = vi.fn();
    await expect(waitForOfflineResourceLink(request, controller.signal)).rejects.toThrow(/cancelled/);
    expect(request).not.toHaveBeenCalled();
  });
});
