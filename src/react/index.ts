// @paystrater/react: the Paystrater checkout for React.
// Use a publishable key only, and ship goods on the incoming_payment.succeeded
// webhook, never on onSuccess: that callback is for the payer's experience.
export { PaystraterCheckout, type PaystraterCheckoutProps } from "./PaystraterCheckout.js"
export { usePaystraterPayment, type PayerDetails, type PaystraterPayment, type PaystraterPaymentOptions } from "./usePaystraterPayment.js"
export type { ActionResult, CheckoutState, Deposit, FieldProblem, Stage } from "../core/checkout.js"
export type { EncryptionOptions } from "../core/encryptionConfig.js"
export type { ErrorKind, PaystraterError } from "../core/errors.js"
export type { KeyMode } from "../core/keys.js"
export type { Locale, Strings } from "../core/strings.js"
export type { Appearance, ThemeName, ThemeVariables } from "../core/theme.js"
export type { ChainOption, CheckoutPayment, PaymentMethod, PaymentStatus } from "../core/types.js"
export { SDK_VERSION } from "../core/version.js"
