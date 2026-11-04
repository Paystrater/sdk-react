// Writes test/vectors/encryption.json: one fixed encryption vector
// made with the SDK's own code. The same file is checked against the
// Developer Service's Go code (scripts/verify-vector) and ported to Dart, so
// every build proves the client and the server agree.
import { build } from "esbuild"
import { getPublicKey } from "@noble/secp256k1"
import { writeFileSync } from "node:fs"
import { pathToFileURL } from "node:url"

// The SDK's own encryption module, built as it ships
const out = "node_modules/.cache/paystrater-encryption.mjs"
await build({ entryPoints: ["src/core/encryption.ts"], bundle: true, format: "esm", platform: "neutral", outfile: out, logLevel: "warning" })
const { bytesToHex, encryptWith, exchangeWith, parseMerchantKey } = await import(pathToFileURL(out).href)

const fill = (start, n) => Uint8Array.from({ length: n }, (_, i) => (start + i) & 0xff)
const merchantSecret = fill(0x01, 32)
const ephemeralSecret = fill(0x21, 32)
const requestIv = fill(0xa0, 12)
const responseIv = fill(0xb0, 12)
const keyId = "PsTestVectorKey1"
const request = JSON.stringify({ receivePaymentId: "rcv_vector0001", chainId: 8453, payerEmail: "payer@example.com" })
const response = JSON.stringify({ status: 200, message: "Payment found", response: { id: "rcv_vector0001", status: "requires_action" } })

const merchantPublicKey = bytesToHex(getPublicKey(merchantSecret, false))
const exchange = await exchangeWith(ephemeralSecret.slice(), parseMerchantKey(merchantPublicKey))

// The response key decrypts only; to make the response half of the vector the same
// derivation is run with an encrypt key, from the same shared secret
const { getSharedSecret } = await import("@noble/secp256k1")
const shared = getSharedSecret(ephemeralSecret, parseMerchantKey(merchantPublicKey), true).slice(1)
const material = await crypto.subtle.importKey("raw", shared, "HKDF", false, ["deriveKey"])
const responseKey = await crypto.subtle.deriveKey(
  { name: "HKDF", hash: "SHA-256", salt: new Uint8Array(0), info: new TextEncoder().encode("paystrater-v1-response-body") },
  material,
  { name: "AES-GCM", length: 256 },
  false,
  ["encrypt"]
)

const vector = {
  description: "Paystrater checkout encryption vector: secp256k1 ECDH (X coordinate), HKDF-SHA256 no salt, AES-256-GCM. Fixed keys and IVs for tests only.",
  merchantSecretKey: bytesToHex(merchantSecret),
  merchantPublicKey,
  keyId,
  ephemeralSecretKey: bytesToHex(ephemeralSecret),
  ephemeralPublicKey: exchange.ephemeralPublicKey,
  sharedSecretX: bytesToHex(shared),
  request: { plaintext: request, ...(await encryptWith(exchange.requestKey, requestIv, request)) },
  response: { plaintext: response, ...(await encryptWith(responseKey, responseIv, response)) }
}
writeFileSync("test/vectors/encryption.json", JSON.stringify(vector, null, 2) + "\n")
console.log("wrote test/vectors/encryption.json")
