import { build } from "esbuild";
import { cpSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const watch = process.argv.includes("--watch");

mkdirSync("dist", { recursive: true });

/** @type {import('esbuild').BuildOptions} */
const shared = {
  bundle: true,
  minify: false,
  sourcemap: "inline",
  logLevel: "info",
  target: ["chrome120"],
};

const pages = [
  { entry: "src/popup/main.tsx", outdir: "dist/popup" },
  { entry: "src/options/main.tsx", outdir: "dist/options" },
];

const watchOpt = watch ? {} : undefined;

for (const p of pages) {
  await build({
    ...shared,
    entryPoints: [p.entry],
    outdir: p.outdir,
    jsx: "automatic",
    ...(watch ? { watch: {} } : {}),
  });
}

await build({
  ...shared,
  entryPoints: ["src/background/index.ts"],
  outfile: "dist/background/background.js",
  format: "esm",
  ...(watch ? { watch: {} } : {}),
});

await build({
  ...shared,
  entryPoints: ["src/content/index.ts"],
  outfile: "dist/content/content.js",
  format: "iife",
  ...(watch ? { watch: {} } : {}),
});

// Offscreen document: hosts the local embedding model (semantic search).
// ESM so import.meta / top-level constructs from transformers.js survive.
await build({
  ...shared,
  entryPoints: ["src/offscreen/offscreen.ts"],
  outfile: "dist/offscreen/offscreen.js",
  format: "esm",
  ...(watch ? { watch: {} } : {}),
});

cpSync("src/offscreen/offscreen.html", join("dist", "offscreen", "offscreen.html"));

// ONNX Runtime wasm binaries are served from the extension itself — no CDN.
mkdirSync(join("dist", "offscreen", "wasm"), { recursive: true });
for (const f of [
  "ort-wasm-simd-threaded.mjs",
  "ort-wasm-simd-threaded.wasm",
  "ort-wasm-simd-threaded.jsep.mjs",
  "ort-wasm-simd-threaded.jsep.wasm",
]) {
  cpSync(join("node_modules", "onnxruntime-web", "dist", f), join("dist", "offscreen", "wasm", f));
}

cpSync("src/manifest.json", join("dist", "manifest.json"));
cpSync("src/assets", join("dist", "assets"), { recursive: true });

writeFileSync(
  join("dist", "popup", "popup.html"),
  `<!doctype html>
<html>
<head><meta charset="utf-8"><link rel="stylesheet" href="main.css"></head>
<body><div id="root"></div><script src="main.js"></script></body>
</html>`,
);

writeFileSync(
  join("dist", "options", "options.html"),
  `<!doctype html>
<html>
<head><meta charset="utf-8"><link rel="stylesheet" href="main.css"><title>Memory Wallet</title></head>
<body><div id="root"></div><script src="main.js"></script></body>
</html>`,
);

console.log("Build complete → dist/");
