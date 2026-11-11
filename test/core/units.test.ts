import { describe, expect, it } from "vitest"
import { checkEvmAddress, keccak256, toChecksumAddress } from "../../src/core/address.js"
import { compareAmounts, formatAmount, isPositiveAmount, toBaseUnits, walletLink } from "../../src/core/amount.js"
import { checkEncryptionOptions } from "../../src/core/encryptionConfig.js"
import { errorForPayer, GENERIC_SETUP_MESSAGE } from "../../src/core/errors.js"
import { apiBaseFor, checkPublishableKey, isPaymentId } from "../../src/core/keys.js"
import { fill, stringsFor } from "../../src/core/strings.js"
import { contrastRatio, contrastWarnings, cssVariableName, DARK, LIGHT, resolveTheme } from "../../src/core/theme.js"

const hex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("")

describe("publishable keys", () => {
  it("accepts live and test publishable keys and reads the mode from the prefix", () => {
    expect(checkPublishableKey("pk_live_abc")).toEqual({ ok: true, mode: "live" })
    expect(checkPublishableKey("pk_test_abc")).toEqual({ ok: true, mode: "test" })
  })
  it("refuses a secret key and says why", () => {
    const res = checkPublishableKey("sk_live_abc")
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.message).toMatch(/secret key/)
  })
  it("refuses anything else", () => {
    expect(checkPublishableKey("").ok).toBe(false)
    expect(checkPublishableKey("pk_staging_x").ok).toBe(false)
    expect(checkPublishableKey(undefined).ok).toBe(false)
  })
  it("uses production for live keys and the sandbox for test keys", () => {
    expect(apiBaseFor("live")).toBe("https://api.paystrater.com")
    expect(apiBaseFor("test")).toBe("https://staging-api.paystrater.com")
  })
  it("checks a payment ID before any call and never takes an encoded one", () => {
    expect(isPaymentId("rcv_abc_DEF-123")).toBe(true)
    expect(isPaymentId("rcv_")).toBe(false)
    expect(isPaymentId("rcv_a%2F..")).toBe(false)
    expect(isPaymentId("rcv_a/../b")).toBe(false)
    expect(isPaymentId("snd_abc")).toBe(false)
  })
})

describe("amounts never use floating point", () => {
  it("scales a decimal string to base units with BigInt", () => {
    expect(toBaseUnits("10.25", 6)).toBe(10250000n)
    expect(toBaseUnits("0.000001", 6)).toBe(1n)
    expect(toBaseUnits("1", 18)).toBe(1000000000000000000n)
    expect(toBaseUnits("123456789.123456789123456789", 18)).toBe(123456789123456789123456789n)
  })
  it("refuses more decimals than the token has, and anything that is not a plain decimal", () => {
    expect(toBaseUnits("1.0000001", 6)).toBeUndefined()
    expect(toBaseUnits("1.10000000", 6)).toBe(1100000n)
    expect(toBaseUnits("1e3", 6)).toBeUndefined()
    expect(toBaseUnits("-1", 6)).toBeUndefined()
  })
  it("groups thousands without changing a digit", () => {
    expect(formatAmount("1234567.891234")).toBe("1,234,567.891234")
    expect(formatAmount("10.256789")).toBe("10.256789")
    expect(formatAmount("bad")).toBe("bad")
  })
  it("compares decimal strings", () => {
    expect(compareAmounts("10.00", "10")).toBe(0)
    expect(compareAmounts("9.99", "10")).toBe(-1)
    expect(compareAmounts("10.000001", "10")).toBe(1)
    expect(isPositiveAmount("0.00")).toBe(false)
    expect(isPositiveAmount("0.01")).toBe(true)
    expect(isPositiveAmount(undefined)).toBe(false)
  })
  it("builds the EIP-681 wallet link from tokenAddress and tokenDecimals", () => {
    expect(
      walletLink({ tokenAddress: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", tokenDecimals: 6, chainId: 8453, depositAddress: "0xdbF03B407c01E7cD3CBea99509d93f8DDDC8C6FB", amount: "25.25" })
    ).toBe("ethereum:0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913@8453/transfer?address=0xdbF03B407c01E7cD3CBea99509d93f8DDDC8C6FB&uint256=25250000")
  })
  it("gives no wallet link for a native coin (no token address) or an amount that does not scale", () => {
    expect(walletLink({ chainId: 1, depositAddress: "0x1", amount: "1" })).toBeUndefined()
    expect(walletLink({ tokenAddress: "0x2", tokenDecimals: 2, chainId: 1, depositAddress: "0x1", amount: "1.001" })).toBeUndefined()
  })
})

describe("refund address checks", () => {
  it("implements Keccak-256", () => {
    expect(hex(keccak256(new Uint8Array(0)))).toBe("c5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470")
    expect(hex(keccak256(new TextEncoder().encode("abc")))).toBe("4e03657aea45a94fc7d47ba826c8d667c0d1e6e33a64a036ec44f58fa12d6c45")
    // Longer than one 136-byte block
    expect(hex(keccak256(new Uint8Array(200)))).toHaveLength(64)
  })
  it("matches the EIP-55 examples", () => {
    for (const address of [
      "0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed",
      "0xfB6916095ca1df60bB79Ce92cE3Ea74c37c5d359",
      "0xdbF03B407c01E7cD3CBea99509d93f8DDDC8C6FB",
      "0xD1220A0cf47c7B9Be7A2E6BA89F429762e7b9aDb"
    ]) {
      expect(toChecksumAddress(address.toLowerCase())).toBe(address)
      expect(checkEvmAddress(address)).toBe("ok")
    }
  })
  it("accepts all-lower and all-upper addresses, refuses a wrong checksum or format", () => {
    expect(checkEvmAddress("0x5aaeb6053f3e94c9b9a09f33669435e7ef1beaed")).toBe("ok")
    expect(checkEvmAddress("0x5AAEB6053F3E94C9B9A09F33669435E7EF1BEAED")).toBe("ok")
    expect(checkEvmAddress("0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAeD")).toBe("checksum")
    expect(checkEvmAddress("0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeA")).toBe("format")
    expect(checkEvmAddress("TQn9Y2khEsLJW1ChVWFMSMeRDow5KcbLSE")).toBe("format")
  })
})

describe("encryption options fail closed", () => {
  const publicKey = "04" + "ab".repeat(64)
  it("accepts both or neither", () => {
    expect(checkEncryptionOptions(undefined)).toEqual({ ok: true, options: null })
    expect(checkEncryptionOptions({})).toEqual({ ok: true, options: null })
    expect(checkEncryptionOptions({ keyId: "AbCdEf0123456789", publicKey })).toEqual({ ok: true, options: { keyId: "AbCdEf0123456789", publicKey } })
  })
  it("refuses half or malformed options", () => {
    expect(checkEncryptionOptions({ keyId: "AbCdEf0123456789" }).ok).toBe(false)
    expect(checkEncryptionOptions({ publicKey }).ok).toBe(false)
    expect(checkEncryptionOptions({ keyId: "short", publicKey }).ok).toBe(false)
    expect(checkEncryptionOptions({ keyId: "AbCdEf0123456789", publicKey: "05" + "ab".repeat(64) }).ok).toBe(false)
    expect(checkEncryptionOptions({ keyId: "AbCdEf0123456789", publicKey: "02" + "ab".repeat(32) }).ok).toBe(true)
  })
})

describe("errors for payers", () => {
  const forbidden = { kind: "api" as const, status: 403, message: "This website is not on the API Key's domain allowlist." }
  it("turns the site allowlist 403 into a set-up message in test mode", () => {
    expect(errorForPayer(forbidden, "test", "https://shop.example.com")).toMatch(/Add https:\/\/shop\.example\.com to this publishable key/)
  })
  it("shows payers a generic line for set-up problems in live mode", () => {
    expect(errorForPayer(forbidden, "live")).toBe(GENERIC_SETUP_MESSAGE)
    expect(errorForPayer({ kind: "encryption", status: 0, message: "x" }, "live")).toBe(GENERIC_SETUP_MESSAGE)
  })
  it("passes every other message through unchanged", () => {
    const e = { kind: "api" as const, status: 400, message: "This payment can only be paid with Pay with Paystrater" }
    expect(errorForPayer(e, "live")).toBe(e.message)
    expect(errorForPayer(e, "test")).toBe(e.message)
  })
})

describe("strings", () => {
  it("fills placeholders as plain text and takes overrides", () => {
    expect(fill("Pay {merchant}", { merchant: "<b>Acme</b>" })).toBe("Pay <b>Acme</b>")
    expect(stringsFor("en", { testMode: "Sandbox" }).testMode).toBe("Sandbox")
  })
})

describe("theme", () => {
  it("defaults to the Paystrater design from the dashboard's globals.css", () => {
    expect(LIGHT.colorPrimary).toBe("#285BB6")
    expect(DARK.colorBackground).toBe("#24272F")
    expect(DARK.colorPrimaryText).toBe("#A2AED1")
    expect(DARK.colorPrimary).toBe("#A2AED1")
    expect(DARK.colorOnPrimary).toBe("#131519")
  })
  it("follows prefers-color-scheme on auto and takes the merchant's variables", () => {
    expect(resolveTheme({ theme: "auto" }, true).colorBackground).toBe(DARK.colorBackground)
    expect(resolveTheme({ theme: "auto" }, false).colorBackground).toBe(LIGHT.colorBackground)
    expect(resolveTheme({ variables: { colorPrimary: "#ff0000" } }, false).colorPrimary).toBe("#ff0000")
  })
  it("drops values that could break out of a CSS declaration", () => {
    expect(resolveTheme({ variables: { colorPrimary: "red; background: url(x)" } }, false).colorPrimary).toBe(LIGHT.colorPrimary)
  })
  it("names CSS variables with the ps- prefix", () => {
    expect(cssVariableName("colorPrimaryText")).toBe("--ps-color-primary-text")
  })
  it("passes WCAG AA by default and warns about merchant colours that do not", () => {
    expect(contrastWarnings(LIGHT)).toEqual([])
    expect(contrastWarnings(DARK)).toEqual([])
    expect(contrastRatio("#000", "#fff")).toBeCloseTo(21)
    const warnings = contrastWarnings(resolveTheme({ variables: { colorPrimary: "#9fc5ff" } }, false))
    expect(warnings.join(" ")).toMatch(/Button text/)
  })
})

describe("toBaseUnits on a long run of zeros", () => {
  it("drops trailing zeros and is quick on hostile input", () => {
    expect(toBaseUnits("1.5000", 1)?.toString()).toBe("15")
    expect(toBaseUnits("1.000", 0)?.toString()).toBe("1")
    const start = performance.now()
    expect(toBaseUnits(`1.${"0".repeat(500_000)}1`, 6)).toBeUndefined()
    expect(performance.now() - start).toBeLessThan(500)
  })
})
