import { readFile, writeFile, readdir, mkdir } from "node:fs/promises";
import { join, relative } from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

async function files(dir) {
  try { return (await Promise.all((await readdir(dir, { withFileTypes: true })).map((entry) => entry.isDirectory() ? files(join(dir, entry.name)) : [join(dir, entry.name)]))).flat(); }
  catch (error) { if (error.code === "ENOENT") return []; throw error; }
}

export async function buildOfflineWorker(root = process.cwd()) {
  const html = await readFile(join(root, ".next/server/app/index.html"), "utf8");
  await mkdir(join(root, "public/offline"), { recursive: true });
  await writeFile(join(root, "public/offline/shell.html"), html);
  const staticFiles = (await files(join(root, ".next/static"))).filter((p) => !p.endsWith(".map"));
  const publicFiles = (await files(join(root, "public"))).filter((p) => /^(offline\/|favicon\.svg$|kalinga-logo\.png$|gabay-[^/]+\.png$)/.test(relative(join(root, "public"), p)) && !p.endsWith(".map"));
  const inventory = [...staticFiles.map((p) => ["/_next/static/" + relative(join(root, ".next/static"), p), p]), ...publicFiles.map((p) => ["/" + relative(join(root, "public"), p), p])].sort(([a], [b]) => a.localeCompare(b));
  const hash = createHash("sha256");
  for (const [url, path] of inventory) hash.update(url).update(await readFile(path));
  const template = await readFile(new URL("./offline-worker.js", import.meta.url), "utf8");
  hash.update(template);
  const version = hash.digest("hex").slice(0, 20);
  const assets = inventory.map(([url]) => url);
  await writeFile(join(root, "public/kalinga-sw.js"), template.replaceAll("__KALINGA_VERSION__", JSON.stringify(version)).replaceAll("__KALINGA_ASSETS__", JSON.stringify(assets)));
  return { version, assets };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const result = await buildOfflineWorker();
  console.log(`Offline application: ${result.assets.length} assets, build ${result.version}`);
}
