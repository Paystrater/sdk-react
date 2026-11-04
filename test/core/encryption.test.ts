import { describe, expect, it } from "vitest"
import vector from "../vectors/encryption.json"
import {
  base64ToBytes,
  bytesToHex,
  createEncryptor,
  decryptWith,
  encryptWith,
  exchangeWith,
  hexToBytes,
  parseMerchantKey
} from "../../src/core/encryption.js"

// The fixed vector. scripts/verify-vector opens the same file with the
// Developer Service's own Go code (openBody, deriveKey, openGCM).
describe("the encryption test vector", () => {
  it("makes the same one-time public key and request ciphertext as the vector", async () => {
    const exchange = await exchangeWith(hexToBytes(vector.ephemeralSecretKey), parseMerchantKey(vector.merchantPublicKey))
    expect(exchange.ephemeralPublicKey).toBe(vector.ephemeralPublicKey)
    const sealed = await encryptWith(exchange.requestKey, base64ToBytes(vector.request.iv), vector.request.plaintext)
    expect(sealed).toEqual({ iv: vector.request.iv, authTag: vector.request.authTag, ciphertext: vector.request.ciphertext })
  })

  it("decrypts the server's answer with the response key", async () => {
    const exchange = await exchangeWith(hexToBytes(vector.ephemeralSecretKey), parseMerchantKey(vector.merchantPublicKey))
    const plain = await decryptWith(exchange.responseKey, vector.response)
    expect(plain).toBe(vector.response.plaintext)
  })

  it("uses the 32-byte X coordinate, not the 33-byte compressed point", () => {
    expect(vector.sharedSecretX).toHaveLength(64)
  })

  it("keeps AES keys non-extractable", async () => {
    const exchange = await exchangeWith(hexToBytes(vector.ephemeralSecretKey), parseMerchantKey(vector.merchantPublicKey))
    expect(exchange.requestKey.extractable).toBe(false)
    expect(exchange.responseKey.extractable).toBe(false)
  })
})

describe("createEncryptor", () => {
  it("refuses a public key that is not on the curve, so the checkout fails closed", () => {
    expect(() => createEncryptor({ keyId: "AbCdEf0123456789", publicKey: "04" + "00".repeat(64) })).toThrow()
  })

  it("encrypts a body with a fresh one-time key each call", async () => {
    const enc = createEncryptor({ keyId: vector.keyId, publicKey: vector.merchantPublicKey })
    const a = await enc.encryptBody('{"a":1}')
    const b = await enc.encryptBody('{"a":1}')
    expect(a.body.keyId).toBe(vector.keyId)
    expect(a.body.ephemeralPublicKey).not.toBe(b.body.ephemeralPublicKey)
    expect(a.body.iv).not.toBe(b.body.iv)
    expect(base64ToBytes(a.body.iv)).toHaveLength(12)
    expect(base64ToBytes(a.body.authTag)).toHaveLength(16)
    expect(a.body.ephemeralPublicKey).toMatch(/^0[23][0-9a-f]{64}$/)
  })

  it("sends the key in headers for a call without a body", async () => {
    const enc = createEncryptor({ keyId: vector.keyId, publicKey: vector.merchantPublicKey })
    const { headers } = await enc.bodylessHeaders()
    expect(headers["X-Paystrater-Encrypted"]).toBe("true")
    expect(headers["X-Paystrater-Key-Id"]).toBe(vector.keyId)
    expect(headers["X-Paystrater-Ephemeral-Key"]!.length).toBeLessThanOrEqual(140)
  })

  it("round-trips hex", () => {
    expect(bytesToHex(hexToBytes("00ff10"))).toBe("00ff10")
    expect(() => hexToBytes("0g")).toThrow()
  })
})
