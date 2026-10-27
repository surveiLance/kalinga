import { mkdir, copyFile, cp } from "node:fs/promises";
import sharp from "sharp";

await mkdir("public/offline", { recursive: true });
for (const size of [192, 512]) await sharp("public/favicon.svg").resize(size, size).png().toFile(`public/offline/icon-${size}.png`);
await copyFile("node_modules/pdfjs-dist/build/pdf.worker.min.mjs", "public/offline/pdf.worker.min.mjs");
for (const dir of ["cmaps", "standard_fonts", "wasm"]) await cp(`node_modules/pdfjs-dist/${dir}`, `public/offline/${dir}`, { recursive: true });
