import * as esbuild from "esbuild";
import { execSync } from "child_process";
import * as fs from "fs";

// Copy the Docs and schemas directories to dist for runtime access
function copyDir(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src)) {
    const srcPath = `${src}/${entry}`;
    const destPath = `${dest}/${entry}`;
    if (fs.statSync(srcPath).isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

// Build with esbuild — transpile-only, no type checking, very fast
await esbuild.build({
  entryPoints: ["src/index.ts"],
  bundle: false,           // don't bundle — node_modules resolved at runtime
  platform: "node",
  target: "node18",
  format: "cjs",           // commonjs output to match tsconfig
  outdir: "dist",
  sourcemap: "inline",
  logLevel: "info",
  // Fix .js extension imports — esbuild needs to know to resolve .ts
  resolveExtensions: [".ts", ".js"],
});

// Also build supporting files
const files = [
  "src/resources.ts",
  "src/tools.ts",
  "src/prompts.ts",
  "src/content/examples.ts",
  "src/content/errorCodes.ts",
  "src/content/apiReference.ts",
];

await esbuild.build({
  entryPoints: files,
  bundle: false,
  platform: "node",
  target: "node18",
  format: "cjs",
  outdir: "dist",
  sourcemap: "inline",
  logLevel: "info",
  resolveExtensions: [".ts", ".js"],
});

console.log("✓ Build complete");
