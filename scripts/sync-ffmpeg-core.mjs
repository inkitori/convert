import { copyFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = resolve(root, "node_modules/@ffmpeg/core/dist/esm");
const destination = resolve(root, "public/ffmpeg");

await mkdir(destination, { recursive: true });

for (const file of ["ffmpeg-core.js", "ffmpeg-core.wasm"]) {
  await copyFile(resolve(source, file), resolve(destination, file));
}

console.log("Synced the single-thread FFmpeg core.");
