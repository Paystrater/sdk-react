// Every word the checkout shows. English in v1; a locale
// option and this table let other languages come later without an API change.
// Status words match the app and the dashboard.

export const en = {
  loading: "Loading the payment…",
  testMode: "Test mode",
  testModeHint: "Test mode: no real money moves.",
  payTo: "Pay {merchant}",
  amountDue: "Amount due",

  chooseMethod: "How would you like to pay?",
  methodPayWithPaystrater: "Pay with Paystrater",
  methodPayWithPaystraterHint: "Approve in your Paystrater app",
  methodTransferToPay: "Transfer to Pay",
  methodTransferToPayHint: "Send from any wallet on {chains}",
  methodAgentic: "Pay with an AI agent",
  methodAgenticHint: "Give your agent a prompt to pay",
  back: "Back",
  continue: "Continue",

  payerLabel: "Paystrater ID or username",
  payerHelp: "We send the request to your Paystrater app. You approve it there.",
  payerRequired: "Enter your Paystrater ID or username.",
  sendRequest: "Send to my app",
  sentTo: "Sent to {name}",
  approveInApp: "Approve the payment in your Paystrater app",
  approveInAppHint: "Open the request in the app, check the amount and approve it with your PIN. This page updates when you do.",
  openApp: "Open the Paystrater app",
  wrongAccount: "Not you? Check the ID and try again with a new payment from the shop.",

  chooseChain: "Network",
  emailLabel: "Email",
  emailHelp: "Recommended. We email your receipt, and a link to get funds back if anything goes wrong.",
  nameLabel: "Name",
  refundAddressLabel: "Refund address",
  refundAddressHelp: "An address on the same network for any refund. Without it, refunds go back to the address you send from, which an exchange may not credit.",
  refundAddressFormat: "Enter a wallet address: 0x followed by 40 characters.",
  refundAddressChecksum: "This address has a typo: its capital letters don't match. Copy it again from your wallet.",
  emailFormat: "Enter a valid email address, or leave it empty.",
  optional: "optional",
  getAddress: "Show the deposit address",

  sendExactly: "Send exactly {amount} {token} on {chain}",
  depositAddress: "Deposit address",
  copy: "Copy",
  copyAddress: "Copy address",
  copied: "Copied",
  copyAmount: "Copy amount",
  copyContract: "Copy contract address",
  shareAddress: "Share address",
  selectToCopy: "Press and hold the address to copy it.",
  openInWallet: "Open in wallet",
  qrLabel: "QR code of the deposit address",
  fee: "Includes a {fee} {token} network fee",
  expiresIn: "Expires in {time}",
  expired: "Expired",
  received: "Received so far: {amount} {token}",
  waitingForDeposit: "Waiting for your transfer…",
  depositNotice: "Send only {token} on {chain}. Other tokens or networks can't be recovered.",
  paymentDetails: "Payment details",
  tokenContract: "Token contract",
  network: "Network",
  chainId: "Chain ID",

  agentTitle: "Pay with your AI agent",
  agentHint: "Give this prompt to your agent. It pays within your limits, and this page updates when it does.",
  copyPrompt: "Copy prompt",

  statusProcessing: "Payment received, confirming",
  statusProcessingHint: "This usually takes under a minute.",
  statusSucceeded: "Paid",
  statusSucceededHint: "{merchant} has your payment.",
  excessRefunded: "You sent more than needed; the extra {amount} {token} was returned to your address.",
  statusExpired: "This payment expired",
  statusExpiredHint: "Nothing arrived in time. Start again from {merchant}.",
  statusUnderpaid: "You sent less than the amount",
  statusUnderpaidHint: "We've emailed you a link to get your funds back.",
  statusLate: "Your transfer arrived after the payment expired",
  statusLateHint: "We've emailed you a link to get your funds back.",
  statusCancelled: "This payment was cancelled",
  statusCancelledHint: "{merchant} cancelled it. Nothing more to pay here.",
  statusFailed: "This payment didn't go through",
  statusRefunded: "This payment was refunded",
  statusUnknown: "Updating",
  closePage: "You can close this page.",
  startAgain: "Start again",

  errorTitle: "Something went wrong",
  tryAgain: "Try again",
  leaveWarning: "A transfer may be on its way. If you leave, you won't see it confirmed here."
} as const

export type Strings = { [K in keyof typeof en]: string }
export type Locale = "en"

const TABLES: Record<Locale, Strings> = { en }

/** The strings for a locale, with any of the merchant's overrides */
export function stringsFor(locale: Locale = "en", overrides?: Partial<Strings>): Strings {
  return { ...(TABLES[locale] ?? en), ...overrides }
}

/** Fills {name} placeholders. Values are plain text and are never parsed as markup */
export function fill(template: string, values: Record<string, string | number | undefined>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => {
    const value = values[key]
    return value === undefined ? "" : String(value)
  })
}
