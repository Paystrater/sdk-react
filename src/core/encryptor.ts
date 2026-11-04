// Loads the encryption code only when it is needed: a
// bundler puts ./encryption in its own chunk behind this dynamic import.
import type { EncryptionOptions } from "./encryptionConfig.js"
import type { Encryptor } from "./encryptionTypes.js"

export type { Encryptor } from "./encryptionTypes.js"

/** For ClientConfig.encryptor: throws when the key is not a secp256k1 point, so the client fails closed */
export function encryptorFor(options: EncryptionOptions): () => Promise<Encryptor> {
  return () => import("./encryption.js").then((m) => m.createEncryptor(options))
}
