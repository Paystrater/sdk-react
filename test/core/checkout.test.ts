import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { ActivitySource } from "../../src/core/activity.js"
import { Checkout, type CheckoutState } from "../../src/core/checkout.js"
import { createClient } from "../../src/core/client.js"
import type { CheckoutPayment } from "../../src/core/types.js"
import { deposit, fail, fakeFetch, ID, ok, payment, PK_TEST, type Recorded } from "../helpers.js"

/** A page whose visibility and focus the test controls */
function page(active = true, visible = active) {
  let listener: ((a: boolean) => void) | undefined
  const source: ActivitySource = {
    isActive: () => active,
    isVisible: () => visible,
    subscribe(l) {
      listener = l
      return () => (listener = undefined)
    }
  }
  return {
    source,
    /** Visible and focused, or hidden */
    set(next: boolean) {
      active = next
      visible = next
      listener?.(next)
    },
    /** Visible but unfocused, as a checkout in an iframe the payer has not clicked into */
    unfocused() {
      active = false
      visible = true
      listener?.(false)
    }
  }
}

type Handler = (req: Recorded) => Response | Promise<Response>

function setup(route: Handler, options: { active?: boolean; visible?: boolean; chains?: number[] } = {}) {
  const net = fakeFetch(route)
  const view = page(options.active ?? true, options.visible)
  const events: string[] = []
  const checkout = new Checkout({
    client: createClient({ publishableKey: PK_TEST, fetch: net.fetch }),
    paymentId: ID,
    chains: options.chains,
    activity: view.source,
    callbacks: {
      onSuccess: () => events.push("success"),
      onExpired: () => events.push("expired"),
      onCancelled: () => events.push("cancelled"),
      onError: (e) => events.push(`error:${e.status}`)
    }
  })
  const reads = () => net.calls.filter((c) => c.method === "GET").length
  return { checkout, net, view, events, reads, state: (): CheckoutState => checkout.getState() }
}

const settle = () => vi.advanceTimersByTimeAsync(0)

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe("loading and choosing a method", () => {
  it("offers the methods in the documented order whatever order the server lists them", async () => {
    const t = setup(() => ok(payment()))
    t.checkout.start()
    await settle()
    expect(t.state().stage).toBe("methods")
    expect(t.state().methods).toEqual(["pay_with_paystrater", "transfer_to_pay", "agentic"])
  })

  it("never offers Solana for Transfer to Pay, and drops Transfer to Pay when only Solana is left", async () => {
    const t = setup(() => ok(payment()))
    t.checkout.start()
    await settle()
    expect(t.state().chains.map((c) => c.chainName)).toEqual(["Base", "Polygon"])
    const s = setup(() => ok(payment({ chains: [{ chainId: 101, chainName: "Solana" }] })))
    s.checkout.start()
    await settle()
    expect(s.state().methods).toEqual(["pay_with_paystrater", "agentic"])
  })

  it("lets the merchant's chains prop narrow, never widen", async () => {
    const t = setup(() => ok(payment()), { chains: [137, 999] })
    t.checkout.start()
    await settle()
    expect(t.state().chains.map((c) => c.chainId)).toEqual([137])
  })

  it("uses only the fixed chain when the merchant fixed one", async () => {
    const t = setup(() => ok(payment({ chainId: 8453, chainName: "Base" })))
    t.checkout.start()
    await settle()
    expect(t.state().chains).toEqual([{ chainId: 8453, chainName: "Base" }])
  })

  it("skips the picker when the merchant fixed the method", async () => {
    const t = setup(() => ok(payment({ method: "transfer_to_pay", methods: undefined })))
    t.checkout.start()
    await settle()
    expect(t.state().stage).toBe("transfer_to_pay")
  })

  it("goes straight to the only method offered", async () => {
    const t = setup(() => ok(payment({ methods: ["agentic"] })))
    t.checkout.start()
    await settle()
    expect(t.state().stage).toBe("agentic")
  })

  it("lets the payer go back to the picker until a start call locks the method", async () => {
    const t = setup(() => ok(payment()))
    t.checkout.start()
    await settle()
    t.checkout.choose("transfer_to_pay")
    expect(t.state().stage).toBe("transfer_to_pay")
    t.checkout.back()
    expect(t.state().stage).toBe("methods")
  })

  it("shows the unavailable screen when the payment does not exist", async () => {
    const t = setup(() => fail(404, "Payment not found"))
    t.checkout.start()
    await settle()
    expect(t.state()).toMatchObject({ stage: "unavailable", error: { status: 404, message: "Payment not found" } })
    expect(t.events).toContain("error:404")
  })
})

describe("Transfer to Pay", () => {
  const started = deposit()

  function ttp(after: () => CheckoutPayment) {
    let begun = false
    return setup((req) => {
      if (req.method === "POST") {
        begun = true
        return ok(started)
      }
      return ok(begun ? after() : payment())
    })
  }

  const locked = (extra: Partial<CheckoutPayment> = {}) =>
    payment({
      method: "transfer_to_pay",
      methods: undefined,
      chains: undefined,
      chainId: 8453,
      chainName: "Base",
      transferToPay: {
        depositAddress: started.depositAddress,
        expectedAmount: "25.25",
        depositExpiresAt: started.expiresAt,
        tokenAddress: started.tokenAddress,
        tokenDecimals: 6
      },
      ...extra
    })

  it("sends email, name and refund address only when given; all are optional", async () => {
    const t = ttp(() => locked())
    t.checkout.start()
    await settle()
    t.checkout.choose("transfer_to_pay")
    expect(await t.checkout.startTransferToPay({ chainId: 8453 })).toEqual({ ok: true })
    const post = t.net.calls.find((c) => c.method === "POST")!
    expect(post.body).toEqual({ receivePaymentId: ID, chainId: 8453 })
  })

  it("checks the refund address (format, then EIP-55) before sending", async () => {
    const t = ttp(() => locked())
    t.checkout.start()
    await settle()
    t.checkout.choose("transfer_to_pay")
    expect(await t.checkout.startTransferToPay({ chainId: 8453, refundAddress: "0x123" })).toEqual({ ok: false, field: "refundAddressFormat" })
    expect(await t.checkout.startTransferToPay({ chainId: 8453, refundAddress: "0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAeD" })).toEqual({
      ok: false,
      field: "refundAddressChecksum"
    })
    expect(await t.checkout.startTransferToPay({ chainId: 8453, payerEmail: "not-an-email" })).toEqual({ ok: false, field: "email" })
    expect(await t.checkout.startTransferToPay({ chainId: 101 })).toEqual({ ok: false, field: "chain" })
    expect(t.net.calls.filter((c) => c.method === "POST")).toHaveLength(0)
  })

  it("shows the deposit with the exact amount, the fee the customer bears and the token details", async () => {
    const t = ttp(() => locked())
    t.checkout.start()
    await settle()
    t.checkout.choose("transfer_to_pay")
    await t.checkout.startTransferToPay({ chainId: 8453, payerEmail: "ada@example.com" })
    await settle()
    expect(t.state().stage).toBe("transfer_to_pay")
    expect(t.state().deposit).toMatchObject({ depositAddress: started.depositAddress, amount: "25.25", fee: "0.25", tokenDecimals: 6, chainId: 8453 })
  })

  it("resumes from transferToPay after a reload, without a new start call", async () => {
    const t = setup(() => ok(locked({ transferToPay: { ...locked().transferToPay!, receivedAmount: "10" } })))
    t.checkout.start()
    await settle()
    expect(t.state().stage).toBe("transfer_to_pay")
    expect(t.state().deposit).toMatchObject({ depositAddress: started.depositAddress, amount: "25.25", receivedAmount: "10" })
    expect(t.net.calls.filter((c) => c.method === "POST")).toHaveLength(0)
  })

  it("retries the start once when the deposit address was taken (500)", async () => {
    let posts = 0
    const t = setup((req) => (req.method === "POST" ? (posts++ === 0 ? fail(500, "The deposit address was taken; please try again") : ok(started)) : ok(payment())))
    t.checkout.start()
    await settle()
    t.checkout.choose("transfer_to_pay")
    expect(await t.checkout.startTransferToPay({ chainId: 8453 })).toEqual({ ok: true })
    expect(posts).toBe(2)
  })

  it("reads the payment again when a start is refused, and shows its end state", async () => {
    let posted = false
    const t = setup((req) => {
      if (req.method === "POST") {
        posted = true
        return fail(400, "This payment can no longer be paid")
      }
      return ok(posted ? payment({ status: "expired" }) : payment())
    })
    t.checkout.start()
    await settle()
    t.checkout.choose("transfer_to_pay")
    const res = await t.checkout.startTransferToPay({ chainId: 8453 })
    expect(res.ok).toBe(false)
    await settle()
    expect(t.state().stage).toBe("final")
    expect(t.events).toContain("expired")
  })

  it("passes through the refusal of another chain or method", async () => {
    const t = setup((req) => (req.method === "POST" ? fail(400, "This payment is already being paid on Base") : ok(payment())))
    t.checkout.start()
    await settle()
    t.checkout.choose("transfer_to_pay")
    await t.checkout.startTransferToPay({ chainId: 137 })
    expect(t.state().error?.message).toBe("This payment is already being paid on Base")
  })

  it("ends paid, and notes an overpayment returned to the payer", async () => {
    const t = setup(() => ok(locked({ status: "succeeded", transferToPay: { ...locked().transferToPay!, receivedAmount: "26", excessRefunded: "0.75" } })))
    t.checkout.start()
    await settle()
    expect(t.state().stage).toBe("final")
    expect(t.state().payment?.transferToPay?.excessRefunded).toBe("0.75")
    expect(t.events).toEqual(["success"])
  })

  it("tells an underpaid expiry from a late one and from an empty one", async () => {
    const short = setup(() => ok(locked({ status: "expired", transferToPay: { ...locked().transferToPay!, receivedAmount: "10" } })))
    short.checkout.start()
    await settle()
    expect(short.state()).toMatchObject({ stage: "final", underpaid: true, late: false })

    const late = setup(() => ok(locked({ status: "expired", transferToPay: { ...locked().transferToPay!, receivedAmount: "25.25" } })))
    late.checkout.start()
    await settle()
    expect(late.state()).toMatchObject({ underpaid: false, late: true })

    const none = setup(() => ok(locked({ status: "expired" })))
    none.checkout.start()
    await settle()
    expect(none.state()).toMatchObject({ underpaid: false, late: false })
  })
})

describe("Pay with Paystrater and agent", () => {
  it("needs a payer and shows who the request was sent to", async () => {
    let sent = false
    const t = setup((req) => {
      if (req.method === "POST") {
        sent = true
        return ok(payment({ method: "pay_with_paystrater", payer: { name: "Ada Lovelace" } }), { message: "Approve the payment in your Paystrater app" })
      }
      return ok(sent ? payment({ method: "pay_with_paystrater", payer: { name: "Ada Lovelace" } }) : payment())
    })
    t.checkout.start()
    await settle()
    t.checkout.choose("pay_with_paystrater")
    expect(await t.checkout.payWithPaystrater("  ")).toEqual({ ok: false, field: "payerRequired" })
    expect(await t.checkout.payWithPaystrater("ada")).toEqual({ ok: true })
    expect(t.net.calls.find((c) => c.method === "POST")!.body).toEqual({ receivePaymentId: ID, payer: "ada" })
    expect(t.state().payment?.payer?.name).toBe("Ada Lovelace")
  })

  it("ends cancelled when the payer declines in the app", async () => {
    const t = setup(() => ok(payment({ method: "pay_with_paystrater", status: "cancelled", payer: { name: "Ada" } })))
    t.checkout.start()
    await settle()
    expect(t.state().stage).toBe("final")
    expect(t.events).toEqual(["cancelled"])
  })

  it("shows the agent prompt once started", async () => {
    const t = setup((req) => ok(payment(req.method === "POST" ? { method: "agentic", agentPrompt: "Pay rcv_test0001", methods: undefined } : {})))
    t.checkout.start()
    await settle()
    t.checkout.choose("agentic")
    await t.checkout.startAgentic()
    expect(t.state().payment?.agentPrompt).toBe("Pay rcv_test0001")
  })

  it("passes through 'Agentic payments are not available yet'", async () => {
    const t = setup((req) => (req.method === "POST" ? fail(400, "Agentic payments are not available yet") : ok(payment())))
    t.checkout.start()
    await settle()
    t.checkout.choose("agentic")
    await t.checkout.startAgentic()
    expect(t.state().error?.message).toBe("Agentic payments are not available yet")
  })
})

describe("polling", () => {
  it("reads every 4 seconds while visible and focused, and stops at a final status", async () => {
    let n = 0
    const t = setup(() => ok(payment({ status: ++n >= 3 ? "succeeded" : "requires_action" })))
    t.checkout.start()
    await settle()
    expect(t.reads()).toBe(1)
    await vi.advanceTimersByTimeAsync(4000)
    expect(t.reads()).toBe(2)
    await vi.advanceTimersByTimeAsync(4000)
    expect(t.reads()).toBe(3)
    expect(t.state().stage).toBe("final")
    await vi.advanceTimersByTimeAsync(20_000)
    expect(t.reads()).toBe(3)
  })

  it("makes no calls at all while hidden or unfocused, then reads once at once on return", async () => {
    const t = setup(() => ok(payment()))
    t.checkout.start()
    await settle()
    t.view.set(false)
    await vi.advanceTimersByTimeAsync(60_000)
    expect(t.reads()).toBe(1)
    t.view.set(true)
    await settle()
    expect(t.reads()).toBe(2)
    await vi.advanceTimersByTimeAsync(4000)
    expect(t.reads()).toBe(3)
  })

  it("reads once on a visible but unfocused page (an iframe), then polls only once focused", async () => {
    const t = setup(() => ok(payment()), { active: false, visible: true })
    t.checkout.start()
    await settle()
    expect(t.reads()).toBe(1)
    expect(t.state().stage).toBe("methods")
    await vi.advanceTimersByTimeAsync(60_000)
    expect(t.reads()).toBe(1)
    t.view.set(true)
    await settle()
    expect(t.reads()).toBe(2)
    await vi.advanceTimersByTimeAsync(4000)
    expect(t.reads()).toBe(3)
    t.view.unfocused()
    await vi.advanceTimersByTimeAsync(60_000)
    expect(t.reads()).toBe(3)
  })

  it("makes the first read when a hidden page becomes visible, focused or not", async () => {
    const t = setup(() => ok(payment()), { active: false })
    t.checkout.start()
    await vi.advanceTimersByTimeAsync(10_000)
    expect(t.reads()).toBe(0)
    t.view.unfocused()
    await settle()
    expect(t.reads()).toBe(1)
    await vi.advanceTimersByTimeAsync(30_000)
    expect(t.reads()).toBe(1)
  })

  it("keeps retrying the first read on a visible, unfocused page after a network error", async () => {
    let n = 0
    const t = setup(() => (n++ === 0 ? Promise.reject(new TypeError("Failed to fetch")) : ok(payment())), { active: false, visible: true })
    t.checkout.start()
    await settle()
    expect(t.reads()).toBe(1)
    expect(t.state().payment).toBeUndefined()
    await vi.advanceTimersByTimeAsync(30_000)
    expect(t.reads()).toBe(2)
    expect(t.state().stage).toBe("methods")
    await vi.advanceTimersByTimeAsync(60_000)
    expect(t.reads()).toBe(2)
  })

  it("does not read at all when the page starts hidden", async () => {
    const t = setup(() => ok(payment()), { active: false })
    t.checkout.start()
    await vi.advanceTimersByTimeAsync(30_000)
    expect(t.reads()).toBe(0)
  })

  it("slows to every 10 seconds while RateLimit-Remaining is under 50, and back at 50", async () => {
    let remaining = "49"
    const t = setup(() => ok(payment(), { headers: { "RateLimit-Remaining": remaining } }))
    t.checkout.start()
    await settle()
    expect(t.state().slowed).toBe(true)
    await vi.advanceTimersByTimeAsync(9_000)
    expect(t.reads()).toBe(1)
    remaining = "50"
    await vi.advanceTimersByTimeAsync(1_000)
    expect(t.reads()).toBe(2)
    expect(t.state().slowed).toBe(false)
    await vi.advanceTimersByTimeAsync(4_000)
    expect(t.reads()).toBe(3)
  })

  it("waits for Retry-After on a 429 and keeps the payment on screen", async () => {
    let n = 0
    const t = setup(() => (n++ === 1 ? fail(429, "Too many requests.", { "Retry-After": "30" }) : ok(payment())))
    t.checkout.start()
    await settle()
    await vi.advanceTimersByTimeAsync(4000)
    expect(t.reads()).toBe(2)
    expect(t.state().stage).toBe("methods")
    await vi.advanceTimersByTimeAsync(29_000)
    expect(t.reads()).toBe(2)
    await vi.advanceTimersByTimeAsync(1_000)
    expect(t.reads()).toBe(3)
  })

  it("keeps reading a status this build does not know, shown as Updating", async () => {
    const t = setup(() => ok(payment({ status: "on_hold" as CheckoutPayment["status"] })))
    t.checkout.start()
    await settle()
    expect(t.state().stage).toBe("updating")
    await vi.advanceTimersByTimeAsync(4000)
    expect(t.reads()).toBe(2)
  })

  it("stops every timer when stopped", async () => {
    const t = setup(() => ok(payment()))
    t.checkout.start()
    await settle()
    t.checkout.stop()
    await vi.advanceTimersByTimeAsync(60_000)
    expect(t.reads()).toBe(1)
  })

  it("reports a wrong key without calling the API", async () => {
    const net = fakeFetch(() => ok(payment()))
    const checkout = new Checkout({ client: createClient({ publishableKey: "sk_test_x", fetch: net.fetch }), paymentId: ID })
    checkout.start()
    await settle()
    expect(checkout.getState()).toMatchObject({ stage: "unavailable", error: { kind: "setup" } })
    expect(net.calls).toHaveLength(0)
  })
})
