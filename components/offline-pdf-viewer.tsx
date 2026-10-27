"use client";
import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";

export function OfflinePdfViewer({ blob, title }: { blob: Blob; title: string }) {
  const [pdf, setPdf] = useState<PDFDocumentProxy>();
  const [page, setPage] = useState(1);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [url, setUrl] = useState("");
  const canvas = useRef<HTMLCanvasElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let active = true;
    let destroy: (() => void) | undefined;
    const objectUrl = URL.createObjectURL(blob);
    void (async () => {
      await Promise.resolve();
      if (!active) return;
      setUrl(objectUrl); setPage(1); setPdf(undefined); setError("");
      const library = await import("pdfjs-dist");
      const data = new Uint8Array(await blob.arrayBuffer());
      if (!active) return;
      library.GlobalWorkerOptions.workerSrc = "/offline/pdf.worker.min.mjs";
      const task = library.getDocument({ data, cMapUrl: "/offline/cmaps/", cMapPacked: true, standardFontDataUrl: "/offline/standard_fonts/", wasmUrl: "/offline/wasm/" });
      destroy = () => { void task.destroy(); };
      const document = await task.promise;
      if (active) setPdf(document); else destroy();
    })().catch(() => { if (active) setError("This PDF could not be displayed here. You can still open the downloaded file below."); });
    return () => { active = false; destroy?.(); URL.revokeObjectURL(objectUrl); };
  }, [blob]);
  useEffect(() => {
    if (!pdf || !canvas.current) return;
    let active = true;
    let cancel: (() => void) | undefined;
    void (async () => {
      const sheet = await pdf.getPage(page);
      if (!active || !canvas.current) return;
      const base = sheet.getViewport({ scale: 1 });
      const viewport = sheet.getViewport({ scale: Math.min(2, Math.max(240, (panel.current?.clientWidth || 600) - 24) / base.width) });
      const scale = Math.min(window.devicePixelRatio || 1, 2, Math.sqrt(8000000 / (viewport.width * viewport.height)));
      const element = canvas.current;
      element.width = Math.floor(viewport.width * scale); element.height = Math.floor(viewport.height * scale);
      element.style.width = `${viewport.width}px`; element.style.height = `${viewport.height}px`;
      const task = sheet.render({ canvas: element, viewport, transform: [scale, 0, 0, scale, 0, 0] });
      cancel = () => task.cancel();
      await task.promise;
      const content = await sheet.getTextContent();
      if (active) setText(content.items.map((item) => "str" in item ? item.str : "").join(" "));
    })().catch((cause: unknown) => { if (active && !(cause instanceof Error && cause.name === "RenderingCancelledException")) setError("This page could not be rendered. Try opening the local file."); });
    return () => { active = false; cancel?.(); };
  }, [pdf, page]);
  return <div className="offline-pdf-viewer" ref={panel}><div className="offline-pdf-controls"><button type="button" disabled={!pdf || page === 1} onClick={() => setPage((p) => p - 1)}>← Previous page</button><span role="status">{pdf ? `Page ${page} of ${pdf.numPages}` : "Opening downloaded PDF…"}</span><button type="button" disabled={!pdf || page >= pdf.numPages} onClick={() => setPage((p) => p + 1)}>Next page →</button></div>{error && <p role="alert">{error}</p>}<canvas ref={canvas} aria-label={`${title}, page ${page}`} />{text && <details><summary>Read page text</summary><p>{text}</p></details>}{url && <a href={url} target="_blank" rel="noreferrer">Open downloaded PDF in your browser ↗</a>}</div>;
}
