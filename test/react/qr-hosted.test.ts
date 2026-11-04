import { describe, expect, it } from "vitest"
import { leaveMessage, parseCheckoutFragment, returnTarget, returnUrl } from "../../src/hosted/index.js"
import { qrMatrix, qrPath } from "../../src/react/qr.js"

describe("the QR encoder", () => {
  // Checked module for module, mask included, against Project Nayuki's qrcodegen
  // (the encoder inside qrcode.react) for this address and five other inputs
  it("encodes a deposit address as version 3, level M, matching the reference encoder", async () => {
    const m = qrMatrix("0xdbF03B407c01E7cD3CBea99509d93f8DDDC8C6FB")!
    expect(m).toHaveLength(29)
    const bits = m.map((r) => r.map((b) => (b ? 1 : 0)).join("")).join("")
    const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(bits)))
    expect(Array.from(digest, (b) => b.toString(16).padStart(2, "0")).join("")).toBe("c92fc88cfdc8df86028651b17acfc236937dce37eb5aad283502d0966eea40f4")
  })

  it("draws the three finder patterns", () => {
    const m = qrMatrix("hello")!
    const n = m.length
    for (const [x, y] of [[0, 0], [n - 7, 0], [0, n - 7]] as const) {
      expect(m[y]!.slice(x, x + 7)).toEqual([true, true, true, true, true, true, true])
      expect(m[y + 1]![x + 1]).toBe(false)
      expect(m[y + 3]![x + 3]).toBe(true)
    }
  })

  it("refuses text that does not fit in version 10", () => {
    expect(qrMatrix("x".repeat(300))).toBeUndefined()
  })

  it("draws one path of unit squares", () => {
    expect(qrPath([[true, false], [false, true]])).toBe("M0 0h1v1h-1zM1 1h1v1h-1z")
  })
})

describe("the hosted link", () => {
  const epk = "04" + "ab".repeat(64)

  it("reads the publishable key from the fragment", () => {
    expect(parseCheckoutFragment("#key=pk_live_abc")).toEqual({ ok: true, link: { publishableKey: "pk_live_abc", encryption: null } })
  })

  it("says the link is incomplete without a usable key, and never takes a secret key", () => {
    expect(parseCheckoutFragment("")).toEqual({ ok: false, reason: "incomplete" })
    expect(parseCheckoutFragment("#key=sk_live_abc")).toEqual({ ok: false, reason: "incomplete" })
    expect(parseCheckoutFragment("#kid=AbCdEf0123456789")).toEqual({ ok: false, reason: "incomplete" })
  })

  it("encrypts with kid and epk, and fails closed when only one is there or either is malformed", () => {
    expect(parseCheckoutFragment(`#key=pk_test_a&kid=AbCdEf0123456789&epk=${epk}`)).toEqual({
      ok: true,
      link: { publishableKey: "pk_test_a", encryption: { keyId: "AbCdEf0123456789", publicKey: epk } }
    })
    expect(parseCheckoutFragment("#key=pk_test_a&kid=AbCdEf0123456789")).toEqual({ ok: false, reason: "encryption" })
    expect(parseCheckoutFragment(`#key=pk_test_a&epk=${epk}`)).toEqual({ ok: false, reason: "encryption" })
    expect(parseCheckoutFragment(`#key=pk_test_a&kid=short&epk=${epk}`)).toEqual({ ok: false, reason: "encryption" })
    expect(parseCheckoutFragment("#key=pk_test_a&kid=AbCdEf0123456789&epk=04zz")).toEqual({ ok: false, reason: "encryption" })
  })
})

describe("return links", () => {
  it("adds payment and status to the merchant's URL", () => {
    expect(returnUrl("https://shop.example.com/thanks?order=7", "rcv_1", "succeeded", false)).toBe(
      "https://shop.example.com/thanks?order=7&payment=rcv_1&status=succeeded"
    )
  })

  it("navigates only to https, or to localhost over http in test mode", () => {
    expect(returnUrl("http://shop.example.com", "rcv_1", "expired", true)).toBeUndefined()
    expect(returnUrl("http://localhost:3000/back", "rcv_1", "expired", true)).toBe("http://localhost:3000/back?payment=rcv_1&status=expired")
    expect(returnUrl("http://127.0.0.1/back", "rcv_1", "expired", true)).toBeDefined()
    expect(returnUrl("http://localhost:3000/back", "rcv_1", "expired", false)).toBeUndefined()
    expect(returnUrl("javascript:alert(1)", "rcv_1", "expired", true)).toBeUndefined()
    expect(returnUrl("https://user:pw@shop.example.com", "rcv_1", "expired", false)).toBeUndefined()
    expect(returnUrl(undefined, "rcv_1", "expired", false)).toBeUndefined()
  })

  it("goes to successUrl after succeeded and to cancelUrl after expired, cancelled or failed", () => {
    expect(returnTarget("succeeded")).toBe("success")
    for (const s of ["expired", "cancelled", "failed"]) expect(returnTarget(s)).toBe("cancel")
    expect(returnTarget("refunded")).toBeUndefined()
    expect(returnTarget("processing")).toBeUndefined()
  })

  it("words the leave dialog by where the payment is", () => {
    expect(leaveMessage("not_started", { merchantName: "Acme" }).body).toBe("Your payment isn't finished. You'll need to start again from Acme.")
    expect(leaveMessage("deposit", { merchantName: "Acme", amount: "25.25", tokenTicker: "USDC", chainName: "Base" }).body).toMatch(
      /^If you've already sent 25\.25 USDC on Base, stay until it's confirmed\./
    )
    expect(leaveMessage("processing", { merchantName: "Acme" }).body).toMatch(/Acme will still be paid/)
  })
})
