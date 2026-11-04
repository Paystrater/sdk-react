// The framework-free core of the Paystrater checkout: the
// API client, the checkout flow and polling, errors, theme tokens and the
// helpers both SDKs share. React Native bundles these same files.
export { createClient, readRetryAfter, type CallResult, type CheckoutClient, type ClientConfig, type RateLimit } from "./client.js"
export {
  Checkout,
  depositFrom,
  offeredMethods,
  transferChains,
  type ActionResult,
  type CheckoutCallbacks,
  type CheckoutOptions,
  type CheckoutState,
  type Deposit,
  type FieldProblem,
  type Stage,
  type TransferToPayDetailsInput
} from "./checkout.js"
export { alwaysActive, browserActivity, type ActivitySource } from "./activity.js"
export { checkEvmAddress, keccak256, toChecksumAddress, type AddressCheck } from "./address.js"
export { compareAmounts, formatAmount, isPositiveAmount, toBaseUnits, walletLink } from "./amount.js"
export { checkEncryptionOptions, type EncryptionCheck, type EncryptionOptions } from "./encryptionConfig.js"
export { encryptorFor, type Encryptor } from "./encryptor.js"
export { errorForPayer, GENERIC_SETUP_MESSAGE, type ErrorKind, type PaystraterError } from "./errors.js"
export { apiBaseFor, checkPublishableKey, isPaymentId, PAYMENT_ID, type KeyCheck, type KeyMode } from "./keys.js"
export { en, fill, stringsFor, type Locale, type Strings } from "./strings.js"
export {
  contrastRatio,
  contrastWarnings,
  cssVariableName,
  DARK,
  LIGHT,
  resolveTheme,
  toCssVariables,
  type Appearance,
  type ThemeName,
  type ThemeVariables
} from "./theme.js"
export {
  FINAL_STATUSES,
  isFinalStatus,
  type ChainOption,
  type CheckoutPayment,
  type PaymentMethod,
  type PaymentStatus,
  type TransferToPayDetails,
  type TransferToPayStart
} from "./types.js"
export { SDK_VERSION } from "./version.js"
