import { describe, expect, it } from "vitest"
import vectors from "../vectors/core.json"
import { checkEvmAddress, keccak256 } from "../../src/core/address.js"
import { compareAmounts, formatAmount, toBaseUnits, walletLink } from "../../src/core/amount.js"
import { checkPublishableKey, isPaymentId } from "../../src/core/keys.js"

// The same file is copied into sdk-flutter/test/vectors, so the Dart port proves the same answers
describe("shared core vectors", () => {
  it("base units", () => {
    for (const v of vectors.baseUnits) expect(toBaseUnits(v.amount, v.decimals)?.toString() ?? null).toBe(v.units)
  })
  it("formatting and comparing amounts", () => {
    for (const v of vectors.formatAmount) expect(formatAmount(v.amount)).toBe(v.formatted)
    for (const v of vectors.compareAmounts) expect(compareAmounts(v.a, v.b)).toBe(v.result)
  })
  it("wallet links", () => {
    for (const v of vectors.walletLink) expect(walletLink(v)).toBe(v.link)
  })
  it("Keccak-256 and EIP-55", () => {
    const hex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("")
    for (const v of vectors.keccak256) expect(hex(keccak256(new TextEncoder().encode(v.utf8)))).toBe(v.hash)
    for (const v of vectors.evmAddress) expect(checkEvmAddress(v.address)).toBe(v.check)
  })
  it("keys and payment IDs", () => {
    for (const v of vectors.publishableKey) {
      const res = checkPublishableKey(v.key)
      expect(res.ok ? res.mode : null).toBe(v.mode)
    }
    for (const v of vectors.paymentId) expect(isPaymentId(v.id)).toBe(v.valid)
  })
})
