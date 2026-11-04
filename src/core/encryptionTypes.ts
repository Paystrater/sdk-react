// The shape of the encryption module, apart from its code, so
// the client can name it without pulling in the curve library. React Native and
// Flutter do not encrypt in v1 and copy the core without ./encryption.
import type { EncryptedRequest, EncryptedResponse } from "./types.js"

export interface Encryptor {
  /** A call with a body: the encrypted body and the key that opens its answer */
  encryptBody(json: string): Promise<{ body: EncryptedRequest; responseKey: CryptoKey }>
  /** A call without a body: the key headers and the key that opens its answer */
  bodylessHeaders(): Promise<{ headers: Record<string, string>; responseKey: CryptoKey }>
  /** Opens an encrypted 2xx answer: the whole {status, message, response} envelope as JSON text */
  decrypt(responseKey: CryptoKey, envelope: EncryptedResponse): Promise<string>
}
