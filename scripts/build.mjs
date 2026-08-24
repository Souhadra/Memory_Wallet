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
