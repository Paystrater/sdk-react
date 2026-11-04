// Generates src/core/generated/developer-api.ts from the Developer API OpenAPI
// document, so a route or field change reaches the SDK
// through the spec, never by hand. The default is the copy built in the
// backend repo on this computer (`./scripts.sh docs` in developer-service),
// usually the newest (Mike, 2 Nov); without it, the published document.
// DEVELOPER_API_SPEC points at another one.
import { execFileSync } from "node:child_process"
import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"

const local = join(homedir(), "Go Projects/paystrater/developer-service/docs/openapi/developer-api.yaml")
const spec = process.env.DEVELOPER_API_SPEC || (existsSync(local) ? local : "https://docs.paystrater.com/developer-api.yaml")
const out = "src/core/generated/developer-api.ts"
execFileSync("node_modules/.bin/openapi-typescript", [spec, "-o", out], { stdio: "inherit" })

// Inline answers are written as SuccessEnvelope & { response?: … }; drop the
// envelope's own catch-all `response` so each route keeps its own type
const generated = readFileSync(out, "utf8")
const envelope = 'components["schemas"]["SuccessEnvelope"] & {'
writeFileSync(out, generated.replaceAll(envelope, 'Omit<components["schemas"]["SuccessEnvelope"], "response"> & {'))
