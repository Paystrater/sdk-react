// Encryption to the merchant's encryption key, loaded
// only when the merchant passes encryption options. It matches the Developer
// Service (internal/app/services/encryption): ECDH on secp256k1 with a fresh
// one-time key per call, the X coordinate of the shared point as the secret,
// HKDF-SHA256 with no salt and info "paystrater-v1-request-body" (or
// "-response-body"), then AES-256-GCM with a random 12-byte IV.
//
// Only three functions of @noble/secp256k1 are used: the random key, the public
// key and the shared secret. WebCrypto does the rest, with non-extractable keys.
// JavaScript cannot promise constant-time maths; each private key is used once,
// for one call, and never stored, which keeps that acceptable.
import { getPublicKey, getSharedSecret, Point, utils } from "@noble/secp256k1"
import type { EncryptionOptions } from "./encryptionConfig.js"
import type { Encryptor } from "./encryptionTypes.js"
import type { EncryptedRequest, EncryptedResponse } from "./types.js"

const REQUEST_INFO = "paystrater-v1-request-body"
const RESPONSE_INFO = "paystrater-v1-response-body"
const IV_LENGTH = 12
const TAG_LENGTH = 16

export type { Encryptor } from "./encryptionTypes.js"

export interface Exchange {
  ephemeralPublicKey: string
  requestKey: CryptoKey
  responseKey: CryptoKey
}

export function hexToBytes(hex: string): Uint8Array {
  if (hex.length % 2 !== 0 || !/^[0-9a-fA-F]*$/.test(hex)) throw new Error("not hex")
  const out = new Uint8Array(hex.length / 2)
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  return out
}

export function bytesToHex(bytes: Uint8Array): string {
  let out = ""
  for (const b of bytes) out += b.toString(16).padStart(2, "0")
  return out
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = ""
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary)
}

export function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64)
  const out = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i)
  return out
}

async function deriveAesKey(secret: Uint8Array, info: string, usage: "encrypt" | "decrypt"): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey("raw", secret as BufferSource, "HKDF", false, ["deriveKey"])
  return crypto.subtle.deriveKey(
    { name: "HKDF", hash: "SHA-256", salt: new Uint8Array(0), info: new TextEncoder().encode(info) },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    [usage]
  )
}

/** Parses the merchant's key once; throws on a point that is not on the curve */
export function parseMerchantKey(publicKeyHex: string): Uint8Array {
  const point = Point.fromHex(publicKeyHex)
  point.assertValidity()
  return point.toBytes(true)
}

/**
 * One key exchange with a given one-time secret. Exported for the fixed test
 * vector only; calls use a fresh secret from `utils.randomSecretKey`, which
 * reads crypto.getRandomValues.
 */
export async function exchangeWith(ephemeralSecret: Uint8Array, merchantKey: Uint8Array): Promise<Exchange> {
  const ephemeralPublicKey = bytesToHex(getPublicKey(ephemeralSecret, true))
  // In 3.x getSharedSecret returns 33 bytes (a prefix byte, then X); the server uses the 32-byte X
  const shared = getSharedSecret(ephemeralSecret, merchantKey, true).slice(1)
  try {
    const [requestKey, responseKey] = await Promise.all([
      deriveAesKey(shared, REQUEST_INFO, "encrypt"),
      deriveAesKey(shared, RESPONSE_INFO, "decrypt")
    ])
    return { ephemeralPublicKey, requestKey, responseKey }
  } finally {
    shared.fill(0)
  }
}

/** AES-256-GCM with the tag split off, base64 as the server reads it */
export async function encryptWith(key: CryptoKey, iv: Uint8Array, plaintext: string) {
  const sealed = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv: iv as BufferSource }, key, new TextEncoder().encode(plaintext))
  )
  return {
    iv: bytesToBase64(iv),
    authTag: bytesToBase64(sealed.slice(sealed.length - TAG_LENGTH)),
    ciphertext: bytesToBase64(sealed.slice(0, sealed.length - TAG_LENGTH))
  }
}

export async function decryptWith(key: CryptoKey, envelope: EncryptedResponse): Promise<string> {
  const iv = base64ToBytes(envelope.iv)
  const tag = base64ToBytes(envelope.authTag)
  const ciphertext = base64ToBytes(envelope.ciphertext)
  if (iv.length !== IV_LENGTH || tag.length !== TAG_LENGTH) throw new Error("bad envelope")
  const joined = new Uint8Array(ciphertext.length + tag.length)
  joined.set(ciphertext)
  joined.set(tag, ciphertext.length)
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: iv as BufferSource }, key, joined)
  return new TextDecoder().decode(plain)
}

async function freshExchange(merchantKey: Uint8Array): Promise<Exchange> {
  const secret = utils.randomSecretKey()
  try {
    return await exchangeWith(secret, merchantKey)
  } finally {
    // The one-time private key is dropped as soon as the AES keys exist
    secret.fill(0)
  }
}

/** Throws when the merchant's key is not a secp256k1 point: the caller fails closed */
export function createEncryptor(options: EncryptionOptions): Encryptor {
  const merchantKey = parseMerchantKey(options.publicKey)
  return {
    async encryptBody(json) {
      const exchange = await freshExchange(merchantKey)
      const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH))
      const sealed = await encryptWith(exchange.requestKey, iv, json)
      return {
        body: { keyId: options.keyId, ephemeralPublicKey: exchange.ephemeralPublicKey, ...sealed },
        responseKey: exchange.responseKey
      }
    },
    async bodylessHeaders() {
      const exchange = await freshExchange(merchantKey)
      return {
        headers: {
          "X-Paystrater-Encrypted": "true",
          "X-Paystrater-Key-Id": options.keyId,
          "X-Paystrater-Ephemeral-Key": exchange.ephemeralPublicKey
        },
        responseKey: exchange.responseKey
      }
    },
    decrypt: decryptWith
  }
}
