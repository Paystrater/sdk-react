// One error shape for every failure. The server's
// error.message is passed through unchanged; the SDK branches only on the
// status and on its own kinds, never on message text.

import type { KeyMode } from "./keys.js"

export type ErrorKind =
  /** The server answered with an error envelope */
  | "api"
  /** No answer: offline, DNS, CORS refused, connection dropped */
  | "network"
  /** No answer within the timeout */
  | "timeout"
  /** The integration is set up wrongly: key, encryption options, payment ID */
  | "setup"
  /** Encryption was asked for and could not be done; never falls back to plain JSON */
  | "encryption"
  /** The caller stopped waiting */
  | "cancelled"

export interface PaystraterError {
  kind: ErrorKind
  /** HTTP status, 0 when there was no answer */
  status: number
  /** For people: the server's own words when it sent them */
  message: string
  /** The server's error.type, for logs only */
  type?: string
  /** Seconds to wait before trying again (429, from Retry-After) */
  retryAfter?: number
}

export const GENERIC_SETUP_MESSAGE = "This checkout is not set up correctly. Ask the shop for a new link."

export function setupError(message: string): PaystraterError {
  return { kind: "setup", status: 0, message }
}

/**
 * What a payer sees. A test key shows set-up problems in plain words for the
 * developer; a live key shows payers a generic line instead. Every
 * other server message passes through unchanged.
 */
export function errorForPayer(error: PaystraterError, mode: KeyMode | undefined, origin?: string): string {
  // 403 on a public key: the site allowlist (or the key's scope); 401: the wrong key
  const setupStatus = error.kind === "api" && (error.status === 401 || error.status === 403)
  if (mode === "test") {
    if (error.kind === "api" && error.status === 403 && origin) {
      return `${error.message} Add ${origin} to this publishable key's sites in the Paystrater dashboard.`
    }
    return error.message
  }
  // Without a valid key there is no mode: that is the developer's own set-up, shown as written
  if (mode === undefined && error.kind === "setup") return error.message
  if (error.kind === "setup" || error.kind === "encryption" || setupStatus) return GENERIC_SETUP_MESSAGE
  return error.message
}
