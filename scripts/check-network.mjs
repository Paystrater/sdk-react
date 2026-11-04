// The SDK's one network wrapper is src/core/client.ts. This
// check fails the build if fetch, XMLHttpRequest, EventSource, WebSocket or
// sendBeacon appears anywhere else in src, so nothing bypasses it.
import { readdirSync, readFileSync, statSync } from "node:fs"
import { join } from "node:path"

const WRAPPER = join("src", "core", "client.ts")
const FORBIDDEN = /\b(fetch\s*\(|XMLHttpRequest|EventSource|WebSocket|sendBeacon|from\s+["']axios["'])/

const files = []
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) walk(path)
    else if (/\.(ts|tsx)$/.test(name) && !path.includes("generated")) files.push(path)
  }
}
walk("src")

const offenders = files.filter((f) => f !== WRAPPER && FORBIDDEN.test(readFileSync(f, "utf8").replace(/\/\/.*$|\/\*[\s\S]*?\*\//gm, "")))
if (offenders.length) {
  console.error(`Network calls outside ${WRAPPER}:\n  ${offenders.join("\n  ")}`)
  process.exit(1)
}
console.log(`ok   every network call goes through ${WRAPPER}`)
