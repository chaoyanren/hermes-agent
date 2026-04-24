import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const webRoot = resolve(here, "..");

const copies = [
  {
    src: resolve(webRoot, "node_modules", "@nous-research", "ui", "dist", "fonts"),
    dest: resolve(webRoot, "public", "fonts"),
  },
  {
    src: resolve(webRoot, "node_modules", "@nous-research", "ui", "dist", "assets"),
    dest: resolve(webRoot, "public", "ds-assets"),
  },
];

for (const { src, dest } of copies) {
  if (!existsSync(src)) {
    throw new Error(`Missing asset source: ${src}`);
  }

  rmSync(dest, { recursive: true, force: true });
  mkdirSync(dirname(dest), { recursive: true });
  cpSync(src, dest, { recursive: true });
}
