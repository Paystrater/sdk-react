// Builds dist/: ES modules and CommonJS, TypeScript
// types for both, no polyfills, browser targets from the last two years.
// @noble/secp256k1 is bundled into our own output, so merchants install
// nothing else; in the ES build it sits in a chunk that only loads when
// encryption options are passed.
import { build } from "esbuild"
import { execFileSync } from "node:child_process"
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"

const pkg = JSON.parse(readFileSync("package.json", "utf8"))
rmSync("dist", { recursive: true, force: true })

const entries = { index: "src/react/index.ts", core: "src/core/index.ts", hosted: "src/hosted/index.ts" }
const shared = {
  bundle: true,
  platform: "browser",
  target: ["es2022", "chrome110", "firefox110", "safari16", "edge110"],
  external: ["react", "react-dom", "react/jsx-runtime"],
  jsx: "automatic",
  define: { __SDK_VERSION__: JSON.stringify(pkg.version) },
  legalComments: "eof",
  sourcemap: true,
  logLevel: "warning"
}

// The component and hook are client code for React Server Components hosts
const useClient = { js: '"use client";' }

await build({ ...shared, entryPoints: entries, format: "esm", splitting: true, outdir: "dist/esm", chunkNames: "chunks/[name]-[hash]" })
await build({ ...shared, entryPoints: entries, format: "cjs", outdir: "dist/cjs" })

// "use client" on the React entry only
for (const file of ["dist/esm/index.js", "dist/cjs/index.js"]) {
  writeFileSync(file, `${useClient.js}\n${readFileSync(file, "utf8")}`)
}

// Types: one tree per format; dist/cjs reads as CommonJS through its own package.json
execFileSync("node_modules/.bin/tsc", ["-p", "tsconfig.build.json", "--outDir", "dist/esm/types"], { stdio: "inherit" })
cpSync("dist/esm/types", "dist/cjs/types", { recursive: true })
writeFileSync("dist/cjs/package.json", JSON.stringify({ type: "commonjs" }, null, 2) + "\n")
mkdirSync("dist", { recursive: true })
console.log(`Built ${pkg.name}@${pkg.version}`)
