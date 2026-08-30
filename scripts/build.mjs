import { build } from "esbuild";
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";

const watch = process.argv.includes("--watch");
const isProd = process.argv.includes("--production");

mkdirSync("dist", { recursive: true });

/** @type {import('esbuild').BuildOptions} */
const shared = {
  bundle: true,
  minify: isProd,
  sourcemap: isProd ? false : "inline",
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

// Visual harness: renders the real UI against a stubbed chrome.* store.
// Open dist/test/ui.html (or ?view=popup) in a browser after building.
await build({
  ...shared,
  entryPoints: ["src/test/harness.tsx"],
  outdir: "dist/test",
  jsx: "automatic",
});

writeFileSync(
  join("dist", "test", "ui.html"),
  `<!doctype html>
<html>
<head><meta charset="utf-8"><link rel="stylesheet" href="harness.css"><title>Memory Wallet · harness</title></head>
<body><div id="root"></div><script src="harness.js"></script></body>
</html>`,
);

console.log(`Build complete → dist/ ${isProd ? "(production)" : ""}`);

if (process.argv.includes("--zip")) {
  const tmp = join("dist-store");
  if (existsSync(tmp)) rmSync(tmp, { recursive: true, force: true });
  mkdirSync(tmp, { recursive: true });
  // Copy everything except dist/test (harness must not be in store zip)
  cpSync("dist", tmp, {
    recursive: true,
    filter: (src) => !src.replaceAll("\\", "/").includes("/test") && !src.endsWith("/test"),
  });
  // Remove test folder if it slipped through
  const testInTmp = join(tmp, "test");
  if (existsSync(testInTmp)) rmSync(testInTmp, { recursive: true, force: true });
  try {
    if (process.platform === "win32") {
      execSync(`powershell -Command "Compress-Archive -Path '${tmp}\\*' -DestinationPath 'dist.zip' -Force"`, { stdio: "inherit" });
    } else {
      execSync(`zip -r dist.zip ${tmp}/*`, { stdio: "inherit" });
    }
    console.log("Store zip → dist.zip (excludes test harness)");
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}
