// Size budgets, checked in CI: the whole React checkout under
// 20 KB gzipped, with the encryption code in its own chunk that loads only when
// encryption options are passed. Measured as a merchant's bundler would ship
// it: minified, React left out, then gzipped. Fails the build when over.
import { build } from "esbuild"
import { gzipSync } from "node:zlib"

const BUDGETS = { checkout: 20 * 1024, encryption: 10 * 1024 }

const result = await build({
  entryPoints: { index: "src/react/index.ts" },
  bundle: true,
  splitting: true,
  format: "esm",
  minify: true,
  target: "es2022",
  external: ["react", "react-dom", "react/jsx-runtime"],
  jsx: "automatic",
  write: false,
  metafile: true,
  outdir: "out",
  logLevel: "warning"
})

const outputs = result.metafile.outputs
const files = new Map(result.outputFiles.map((f) => [f.path.slice(f.path.indexOf("out/")), f.contents]))
const gz = (path) => gzipSync(files.get(path)).length

// The checkout: the entry and everything it imports statically. A dynamic import is a separate chunk
const entry = Object.keys(outputs).find((p) => outputs[p].entryPoint === "src/react/index.ts")
const seen = new Set()
const walk = (path) => {
  if (seen.has(path)) return
  seen.add(path)
  for (const imp of outputs[path].imports) if (imp.kind === "import-statement" && outputs[imp.path]) walk(imp.path)
}
walk(entry)
const checkout = [...seen].reduce((sum, p) => sum + gz(p), 0)
const lazy = Object.keys(outputs).filter((p) => !seen.has(p) && p.endsWith(".js"))
const encryption = lazy.reduce((sum, p) => sum + gz(p), 0)

const kb = (n) => `${(n / 1024).toFixed(1)} KB`
let failed = false
for (const [name, size] of [["checkout", checkout], ["encryption", encryption]]) {
  const over = size > BUDGETS[name]
  failed ||= over
  console.log(`${over ? "OVER" : "ok  "} ${name.padEnd(10)} ${kb(size).padStart(8)} of ${kb(BUDGETS[name])} gzipped`)
}
if (lazy.length === 0) {
  console.log("FAIL the encryption code is not in its own chunk")
  failed = true
}
process.exit(failed ? 1 : 0)
