// Money stays a decimal string end to end. Base units are
// BigInt, never a float, so a wallet link asks for exactly the amount due.

const DECIMAL = /^(\d+)(?:\.(\d+))?$/

/** A loop, not a /0+$/ regex, whose backtracking grows with the square of a long run of zeros */
function trimTrailingZeros(digits: string): string {
  let end = digits.length
  while (end > 0 && digits[end - 1] === "0") end--
  return digits.slice(0, end)
}

/** "10.25" with 6 decimals -> 10250000n. Undefined when it is not a plain decimal or has more digits than the token */
export function toBaseUnits(amount: string, decimals: number): bigint | undefined {
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 77) return undefined
  const match = DECIMAL.exec(amount.trim())
  if (!match) return undefined
  const whole = match[1] ?? "0"
  const fraction = trimTrailingZeros(match[2] ?? "")
  if (fraction.length > decimals) return undefined
  return BigInt(whole + fraction.padEnd(decimals, "0"))
}

/** The exact amount as the server wrote it, with thousands grouped for reading */
export function formatAmount(amount: string): string {
  const match = DECIMAL.exec(amount.trim())
  if (!match) return amount
  const grouped = (match[1] ?? "0").replace(/\B(?=(\d{3})+(?!\d))/g, ",")
  return match[2] ? `${grouped}.${match[2]}` : grouped
}

/** Compares two decimal strings without floating point: -1, 0 or 1. Undefined when either is not a plain decimal */
export function compareAmounts(a: string, b: string): -1 | 0 | 1 | undefined {
  const x = DECIMAL.exec(a.trim())
  const y = DECIMAL.exec(b.trim())
  if (!x || !y) return undefined
  const scale = Math.max((x[2] ?? "").length, (y[2] ?? "").length)
  const big = (m: RegExpExecArray) => BigInt((m[1] ?? "0") + (m[2] ?? "").padEnd(scale, "0"))
  const d = big(x) - big(y)
  return d === 0n ? 0 : d > 0n ? 1 : -1
}

/** True for a decimal string above zero */
export function isPositiveAmount(amount: string | undefined): boolean {
  if (!amount) return false
  const match = DECIMAL.exec(amount.trim())
  return Boolean(match && /[1-9]/.test(`${match[1]}${match[2] ?? ""}`))
}

/**
 * An EIP-681 link that opens a wallet with the token transfer filled in:
 * ethereum:{token}@{chainId}/transfer?address={deposit}&uint256={base units}.
 * Undefined for a chain's native coin (no token address) or an amount that does not scale.
 */
export function walletLink(input: {
  tokenAddress?: string
  tokenDecimals?: number
  chainId: number
  depositAddress: string
  amount: string
}): string | undefined {
  const { tokenAddress, tokenDecimals, chainId, depositAddress, amount } = input
  if (!tokenAddress || tokenDecimals === undefined || !Number.isInteger(chainId) || chainId <= 0) return undefined
  const units = toBaseUnits(amount, tokenDecimals)
  if (units === undefined) return undefined
  return `ethereum:${tokenAddress}@${chainId}/transfer?address=${depositAddress}&uint256=${units.toString()}`
}
