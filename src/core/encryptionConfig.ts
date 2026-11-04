// The encryption options are checked once, before any call, in the main
// bundle; the curve code only loads when they are valid.
// Fail closed: half or malformed options never fall back to plain JSON.

export interface EncryptionOptions {
  /** The key ID shown with the encryption public key in the dashboard: 16 letters and digits */
  keyId: string
  /** The encryption public key, secp256k1 SEC1 hex: 130 characters starting 04, or 66 starting 02 or 03 */
  publicKey: string
}

export type EncryptionCheck =
  | { ok: true; options: EncryptionOptions | null }
  | { ok: false; message: string }

const KEY_ID = /^[A-Za-z0-9]{16}$/
const PUBLIC_KEY = /^(04[0-9a-fA-F]{128}|0[23][0-9a-fA-F]{64})$/

export function checkEncryptionOptions(options: Partial<EncryptionOptions> | null | undefined): EncryptionCheck {
  if (options == null) return { ok: true, options: null }
  const keyId = typeof options.keyId === "string" ? options.keyId.trim() : ""
  const publicKey = typeof options.publicKey === "string" ? options.publicKey.trim() : ""
  if (!keyId && !publicKey) return { ok: true, options: null }
  if (!keyId || !publicKey) {
    return { ok: false, message: "Pass both encryption.keyId and encryption.publicKey from the dashboard, or neither. The checkout never sends plain JSON when encryption is asked for." }
  }
  if (!KEY_ID.test(keyId)) return { ok: false, message: "encryption.keyId must be the 16-character key ID shown in the dashboard." }
  if (!PUBLIC_KEY.test(publicKey)) {
    return { ok: false, message: "encryption.publicKey must be the secp256k1 public key from the dashboard, in hex: 130 characters starting 04, or 66 starting 02 or 03." }
  }
  return { ok: true, options: { keyId, publicKey: publicKey.toLowerCase() } }
}
