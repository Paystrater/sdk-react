// Every word the checkout shows. English in v1; a locale
// option and this table let other languages come later without an API change.
// Status words match the app and the dashboard.

export const en = {
  loading: "Loading the payment…",
  testMode: "Test mode",
  testModeHint: "Test mode: no real money moves.",
  payTo: "Pay {merchant}",
  amountDue: "Amount due",

  chooseMethod: "Choose how to pay",
  methodPayWithPaystrater: "Pay with Paystrater",
  methodPayWithPaystraterHint: "Approve it in your Paystrater app",
  methodTransferToPay: "Transfer to Pay",
  methodTransferToPayHint: "Send from any wallet on {chains}",
  methodAgentic: "Pay with an AI agent",
  methodAgenticHint: "Your agent pays within the limits you set",
  back: "Back to payment methods",
  continue: "Continue",

  payerLabel: "Paystrater ID or username",
  payerHelp: "We'll send the request to your app. Approve it there with your PIN.",
  payerRequired: "Enter your Paystrater ID or username.",
  sendRequest: "Send to my app",
  sentTo: "Sent to {name}",
  approveInApp: "Approve it in your Paystrater app",
  approveInAppHint: "Open the request, check the amount and approve it with your PIN. This page updates by itself.",
  openApp: "Open the Paystrater app",
  wrongAccount: "Not your account? Go back and start the payment again with the right Paystrater ID.",

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
  getAddress: "Get the deposit address",

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
  waitingForDeposit: "Watching for your transfer…",
  depositNotice: "Send only {token} on {chain}. Anything else sent here can't be recovered.",
  paymentDetails: "Payment details",
  tokenContract: "Token contract",
  network: "Network",
  chainId: "Chain ID",

  agentTitle: "Pay with your AI agent",
  agentHint: "Give this prompt to your agent. It pays within your limits, and this page updates when it does.",
  copyPrompt: "Copy prompt",

  statusProcessing: "Payment received",
  statusProcessingHint: "Confirming it on the network. This usually takes under a minute.",
  statusSucceeded: "Payment complete",
  statusSucceededHint: "{merchant} has your payment. You can close this page.",
  excessRefunded: "You sent more than needed; the extra {amount} {token} was returned to your address.",
  statusExpired: "This payment has expired",
  statusExpiredHint: "Nothing arrived in time, so nothing was taken. Start again from {merchant}.",
  statusUnderpaid: "You sent less than the amount",
  statusUnderpaidHint: "Your funds are safe. We've emailed you a link to get them back.",
  statusLate: "Your transfer arrived after the payment expired",
  statusLateHint: "Your funds are safe. We've emailed you a link to get them back.",
  statusCancelled: "This payment was cancelled",
  statusCancelledHint: "{merchant} cancelled it. Nothing more to pay here.",
  statusFailed: "This payment didn't go through",
  statusRefunded: "This payment was refunded",
  statusUnknown: "Updating",
  closePage: "You can close this page.",
  startAgain: "Start again",

  errorTitle: "We couldn't load this payment",
  tryAgain: "Try again",
  poweredBy: "Powered by",
  leaveWarning: "A transfer may be on its way. If you leave, you won't see it confirmed here."
} as const

export type Strings = { [K in keyof typeof en]: string }
export type Locale = "en"

const TABLES: Record<Locale, Strings> = { en }

/** The strings for a locale, with any of the merchant's overrides */
export function stringsFor(locale: Locale = "en", overrides?: Partial<Strings>): Strings {
  return { ...(TABLES[locale] ?? en), ...overrides }
}

/**
 * Capitalizes the first letter of every word and leaves the rest as it is,
 * as CSS text-transform: capitalize does: "ada's coffee" → "Ada's Coffee".
 * For names where CSS cannot reach: screen reader labels, and the React
 * Native and Flutter SDKs.
 */
export function capitalizeWords(text: string): string {
  return text.replace(/(^|\s)(\S)/gu, (_, space: string, letter: string) => space + letter.toUpperCase())
}

/** A piece of a filled template: plain text, or the value of one placeholder */
export interface FillPart {
  text: string
  /** The placeholder this text filled, such as "merchant" */
  key?: string
}

/** fill, in pieces, so a placeholder's value can be shown on its own (a name in capitals) */
export function fillParts(template: string, values: Record<string, string | number | undefined>): FillPart[] {
  const parts: FillPart[] = []
  let last = 0
  for (const match of template.matchAll(/\{(\w+)\}/g)) {
    const at = match.index ?? 0
    if (at > last) parts.push({ text: template.slice(last, at) })
    const key = match[1]!
    const value = values[key]
    if (value !== undefined && value !== "") parts.push({ text: String(value), key })
    last = at + match[0].length
  }
  if (last < template.length) parts.push({ text: template.slice(last) })
  return parts
}

/** Fills {name} placeholders. Values are plain text and are never parsed as markup */
export function fill(template: string, values: Record<string, string | number | undefined>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => {
    const value = values[key]
    return value === undefined ? "" : String(value)
  })
}
