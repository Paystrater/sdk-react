// Helpers for Paystrater's hosted checkout page.
// They live in the package so the hosted page and the SDK are tested together
// and never drift; merchants embedding the component do not need them.
import { checkEncryptionOptions, type EncryptionOptions } from "../core/encryptionConfig.js"
import { checkPublishableKey } from "../core/keys.js"
import type { PaymentStatus } from "../core/types.js"

export { PAYMENT_ID, isPaymentId } from "../core/keys.js"

export interface HostedLink {
  publishableKey: string
  encryption: EncryptionOptions | null
}

export type FragmentResult =
  | { ok: true; link: HostedLink }
  /** No usable pk_live_/pk_test_ key: "This payment link is incomplete" */
  | { ok: false; reason: "incomplete" }
  /** kid without epk, epk without kid, or either malformed: fail closed, never plain JSON */
  | { ok: false; reason: "encryption" }

export const LINK_INCOMPLETE = "This payment link is incomplete"
export const LINK_MISCONFIGURED = "This checkout link is not set up correctly. Ask the shop for a new link."

/**
 * Reads `#key=pk_…&kid=…&epk=…` from the link's fragment, which never reaches a
 * server or a log. Only a publishable key is accepted.
 */
export function parseCheckoutFragment(hash: string): FragmentResult {
  const params = new URLSearchParams(hash.replace(/^#/, ""))
  const key = params.get("key") ?? ""
  const check = checkPublishableKey(key)
  if (!check.ok) return { ok: false, reason: "incomplete" }
  const kid = params.get("kid")
  const epk = params.get("epk")
  if (kid === null && epk === null) return { ok: true, link: { publishableKey: key, encryption: null } }
  // Both are needed (decided 2 Nov); half set up fails closed
  if (!kid || !epk) return { ok: false, reason: "encryption" }
  const enc = checkEncryptionOptions({ keyId: kid, publicKey: epk })
  if (!enc.ok || !enc.options) return { ok: false, reason: "encryption" }
  return { ok: true, link: { publishableKey: key, encryption: enc.options } }
}

/**
 * Where to send the payer after a final status: the merchant's URL with
 * `payment` and `status` added. Only https, or http://localhost and
 * http://127.0.0.1 in test mode; anything else answers undefined.
 */
export function returnUrl(raw: string | undefined, paymentId: string, status: string, testMode: boolean): string | undefined {
  if (!raw) return undefined
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return undefined
  }
  if (url.username || url.password) return undefined
  const local = url.hostname === "localhost" || url.hostname === "127.0.0.1"
  const allowed = url.protocol === "https:" || (testMode && url.protocol === "http:" && local)
  if (!allowed) return undefined
  url.searchParams.set("payment", paymentId)
  url.searchParams.set("status", status)
  return url.toString()
}

/** succeeded goes to successUrl; expired, cancelled or failed to cancelUrl; anything else stays */
export function returnTarget(status: PaymentStatus | string): "success" | "cancel" | undefined {
  if (status === "succeeded") return "success"
  if (status === "expired" || status === "cancelled" || status === "failed") return "cancel"
  return undefined
}

export type LeaveContext = "not_started" | "deposit" | "processing"

/** The "Back to <merchant>" dialog's words, which depend on where the payment is */
export function leaveMessage(
  context: LeaveContext,
  values: { merchantName: string; amount?: string; tokenTicker?: string; chainName?: string }
): { title: string; body: string } {
  if (context === "processing") {
    return {
      title: "Your payment is being confirmed",
      body: `If you leave now, you won't see the result here, but ${values.merchantName} will still be paid.`
    }
  }
  if (context === "deposit") {
    return {
      title: "Leave checkout?",
      body: `If you've already sent ${values.amount} ${values.tokenTicker} on ${values.chainName}, stay until it's confirmed. Leaving won't stop money you've sent, but you won't see the confirmation here.`
    }
  }
  return {
    title: "Leave checkout?",
    body: `Your payment isn't finished. You'll need to start again from ${values.merchantName}.`
  }
}

/** Seconds the end screen counts down before it follows the return link */
export const RETURN_COUNTDOWN_S = 5
