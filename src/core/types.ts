// Checkout shapes, generated from the public Developer API spec.
// Never write an API shape by hand: run `npm run types` after a spec
// change, and a renamed or removed field then fails `npm run typecheck`.
import type { components } from "./generated/developer-api.js"

type Schemas = components["schemas"]

/** A payment as `GET /v1/checkout/payments/{id}` answers it */
export type CheckoutPayment = Schemas["ReceivePayment"]
export type PaymentStatus = CheckoutPayment["status"]
export type PaymentMethod = NonNullable<CheckoutPayment["method"]>
export type ChainOption = Schemas["ChainOption"]
export type TransferToPayDetails = Schemas["TransferToPayDetails"]

/** The answer of `POST /v1/checkout/transfer-to-pay` */
export type TransferToPayStart = Schemas["TransferToPayCheckout"]
export type TransferToPayInput = Schemas["TransferToPayCheckoutInput"]
export type PayWithPaystraterInput = Schemas["PayWithPaystraterCheckoutInput"]
export type AgenticInput = Schemas["AgenticCheckoutInput"]
export type RefundAddressInput = Schemas["RefundAddressInput"]

export type EncryptedRequest = Schemas["EncryptedRequest"]
export type EncryptedResponse = Schemas["EncryptedResponse"]

/** Statuses after which the payment can no longer change on the checkout */
export const FINAL_STATUSES: readonly PaymentStatus[] = ["succeeded", "failed", "expired", "cancelled", "refunded"]

export function isFinalStatus(status: string | undefined): boolean {
  return FINAL_STATUSES.includes(status as PaymentStatus)
}
