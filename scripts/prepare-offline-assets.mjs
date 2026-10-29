import { mkdir, copyFile, cp } from "node:fs/promises";
import sharp from "sharp";

await mkdir("public/offline", { recursive: true });
for (const size of [192, 512]) await sharp("public/favicon.svg").resize(size, size).png().toFile(`public/offline/icon-${size}.png`);
await sharp("public/favicon.svg").resize(180, 180).png().toFile("public/offline/apple-touch-icon.png");
await sharp({ create: { width: 512, height: 512, channels: 4, background: "#fffaf2" } }).composite([{ input: await sharp("public/favicon.svg").resize(320, 320).png().toBuffer(), left: 96, top: 96 }]).png().toFile("public/offline/icon-maskable-512.png");
await copyFile("node_modules/pdfjs-dist/build/pdf.worker.min.mjs", "public/offline/pdf.worker.min.mjs");
for (const dir of ["cmaps", "standard_fonts", "wasm"]) await cp(`node_modules/pdfjs-dist/${dir}`, `public/offline/${dir}`, { recursive: true });
