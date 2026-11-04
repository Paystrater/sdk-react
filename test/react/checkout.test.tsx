// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { renderToString } from "react-dom/server"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { PaystraterCheckout } from "../../src/react/index.js"
import type { CheckoutPayment } from "../../src/core/types.js"
import { deposit, fail, fakeFetch, ID, ok, payment, PK_LIVE, PK_TEST, type Recorded } from "../helpers.js"

const DESKTOP = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15"
const PHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148"

function serve(route: (req: Recorded) => Response | Promise<Response>) {
  const net = fakeFetch(route)
  vi.stubGlobal("fetch", net.fetch)
  return net
}

function userAgent(ua: string) {
  vi.spyOn(navigator, "userAgent", "get").mockReturnValue(ua)
}

beforeEach(() => {
  vi.spyOn(document, "hasFocus").mockReturnValue(true)
  userAgent(DESKTOP)
})
afterEach(() => vi.unstubAllGlobals())

const lockedTtp = (extra: Partial<CheckoutPayment> = {}) =>
  payment({
    method: "transfer_to_pay",
    methods: undefined,
    chainId: 8453,
    chainName: "Base",
    transferToPay: {
      depositAddress: deposit().depositAddress,
      expectedAmount: "25.25",
      depositExpiresAt: deposit().expiresAt,
      tokenAddress: deposit().tokenAddress,
      tokenDecimals: 6
    },
    ...extra
  })

describe("<PaystraterCheckout>", () => {
  it("renders a skeleton on the server and calls nothing", () => {
    const net = serve(() => ok(payment()))
    const html = renderToString(<PaystraterCheckout paymentId={ID} publishableKey={PK_TEST} />)
    expect(html).toContain('aria-busy="true"')
    expect(net.calls).toHaveLength(0)
  })

  it("shows the merchant, the exact amount and a Test mode ribbon on a test key", async () => {
    serve(() => ok(payment({ amount: "1234.567891" })))
    render(<PaystraterCheckout paymentId={ID} publishableKey={PK_TEST} />)
    expect(await screen.findByText("Acme Shoes")).toBeTruthy()
    expect(screen.getByText("1,234.567891")).toBeTruthy()
    expect(screen.getByText("Test mode")).toBeTruthy()
  })

  it("has no Test mode ribbon on a live key", async () => {
    serve(() => ok(payment({ livemode: true })))
    render(<PaystraterCheckout paymentId={ID} publishableKey={PK_LIVE} />)
    await screen.findByText("Acme Shoes")
    expect(screen.queryByText("Test mode")).toBeNull()
  })

  it("lists the methods in order, each a button", async () => {
    serve(() => ok(payment()))
    render(<PaystraterCheckout paymentId={ID} publishableKey={PK_TEST} />)
    const list = await screen.findByRole("list")
    const names = within(list).getAllByRole("button").map((b) => b.querySelector("strong")!.textContent)
    expect(names).toEqual(["Pay with Paystrater", "Transfer to Pay", "Pay with an AI agent"])
  })

  it("runs Transfer to Pay: chain, optional fields, then the deposit with QR, copy and details", async () => {
    let started = false
    const net = serve((req) => {
      if (req.method === "POST") {
        started = true
        return ok(deposit())
      }
      return ok(started ? lockedTtp() : payment())
    })
    render(<PaystraterCheckout paymentId={ID} publishableKey={PK_TEST} />)
    fireEvent.click(await screen.findByText("Transfer to Pay"))
    fireEvent.click(screen.getByRole("radio", { name: "Polygon" }))
    fireEvent.click(screen.getByRole("radio", { name: "Base" }))
    fireEvent.change(screen.getByLabelText(/Email/), { target: { value: "ada@example.com" } })
    fireEvent.click(screen.getByRole("button", { name: "Show the deposit address" }))

    expect(await screen.findByRole("heading", { name: "Send exactly 25.25 USDC on Base" })).toBeTruthy()
    expect(net.calls.find((c) => c.method === "POST")!.body).toEqual({ receivePaymentId: ID, chainId: 8453, payerEmail: "ada@example.com" })
    expect(screen.getByRole("img", { name: "QR code of the deposit address" })).toBeTruthy()
    expect(screen.getAllByText(deposit().depositAddress).length).toBeGreaterThan(0)
    expect(screen.getByRole("button", { name: "Copy address" })).toBeTruthy()
    expect(screen.getByRole("button", { name: "Copy amount" })).toBeTruthy()
    expect(screen.getByText("Includes a 0.25 USDC network fee")).toBeTruthy()
    // The token contract, network and chain ID sit in a closed accordion
    const details = screen.getByText("Payment details").closest("details")!
    expect(details.open).toBe(false)
    // No wallet link on a computer
    expect(screen.queryByText("Open in wallet")).toBeNull()
  })

  it("refuses a mistyped refund address before sending", async () => {
    const net = serve(() => ok(payment()))
    render(<PaystraterCheckout paymentId={ID} publishableKey={PK_TEST} />)
    fireEvent.click(await screen.findByText("Transfer to Pay"))
    fireEvent.click(screen.getByRole("radio", { name: "Base" }))
    fireEvent.change(screen.getByLabelText(/Refund address/), { target: { value: "0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAeD" } })
    fireEvent.click(screen.getByRole("button", { name: "Show the deposit address" }))
    expect(await screen.findByText(/capital letters don't match/)).toBeTruthy()
    expect(net.calls.filter((c) => c.method === "POST")).toHaveLength(0)
  })

  it("offers Open in wallet on a phone with an EIP-681 link in base units", async () => {
    userAgent(PHONE)
    serve(() => ok(lockedTtp()))
    render(<PaystraterCheckout paymentId={ID} publishableKey={PK_TEST} />)
    const link = (await screen.findByText("Open in wallet")).closest("a")!
    expect(link.getAttribute("href")).toBe(
      `ethereum:${deposit().tokenAddress}@8453/transfer?address=${deposit().depositAddress}&uint256=25250000`
    )
  })

  it("hides the wallet link for a native coin (no token address)", async () => {
    userAgent(PHONE)
    serve(() => ok(lockedTtp({ transferToPay: { ...lockedTtp().transferToPay!, tokenAddress: undefined, tokenDecimals: undefined } })))
    render(<PaystraterCheckout paymentId={ID} publishableKey={PK_TEST} />)
    await screen.findByText(/Send exactly/)
    expect(screen.queryByText("Open in wallet")).toBeNull()
  })

  it("warns before the tab closes while a deposit is expected", async () => {
    const add = vi.spyOn(window, "addEventListener")
    serve(() => ok(lockedTtp()))
    render(<PaystraterCheckout paymentId={ID} publishableKey={PK_TEST} />)
    await screen.findByText(/Send exactly/)
    expect(add.mock.calls.some(([type]) => type === "beforeunload")).toBe(true)
  })

  it("runs Pay with Paystrater and shows who it was sent to, with the app link on a phone", async () => {
    userAgent(PHONE)
    let sent = false
    serve((req) => {
      if (req.method === "POST") sent = true
      return ok(sent ? payment({ method: "pay_with_paystrater", payer: { name: "Ada Lovelace" } }) : payment())
    })
    render(<PaystraterCheckout paymentId={ID} publishableKey={PK_TEST} />)
    fireEvent.click(await screen.findByText("Pay with Paystrater"))
    fireEvent.change(screen.getByLabelText("Paystrater ID or username"), { target: { value: "ada" } })
    fireEvent.click(screen.getByRole("button", { name: "Send to my app" }))
    expect(await screen.findByText("Sent to Ada Lovelace")).toBeTruthy()
    expect(screen.getByText("Open the Paystrater app").closest("a")!.getAttribute("href")).toBe(`https://app.paystrater.com/pay?id=${ID}`)
  })

  it("asks for the payer before sending", async () => {
    const net = serve(() => ok(payment()))
    render(<PaystraterCheckout paymentId={ID} publishableKey={PK_TEST} />)
    fireEvent.click(await screen.findByText("Pay with Paystrater"))
    fireEvent.click(screen.getByRole("button", { name: "Send to my app" }))
    expect(await screen.findByText("Enter your Paystrater ID or username.")).toBeTruthy()
    expect(net.calls.filter((c) => c.method === "POST")).toHaveLength(0)
  })

  it("shows the agent prompt with a copy button", async () => {
    let started = false
    serve((req) => {
      if (req.method === "POST") started = true
      return ok(payment(started ? { method: "agentic", agentPrompt: "Pay rcv_test0001 for Acme", methods: undefined } : { methods: ["agentic"] }))
    })
    render(<PaystraterCheckout paymentId={ID} publishableKey={PK_TEST} />)
    fireEvent.click(await screen.findByRole("button", { name: "Continue" }))
    expect(await screen.findByText("Pay rcv_test0001 for Acme")).toBeTruthy()
    expect(screen.getByRole("button", { name: "Copy prompt" })).toBeTruthy()
  })

  it.each([
    [lockedTtp({ status: "succeeded", transferToPay: { ...lockedTtp().transferToPay!, excessRefunded: "0.75" } }), "Paid", /the extra 0.75 USDC was returned/],
    [lockedTtp({ status: "expired", transferToPay: { ...lockedTtp().transferToPay!, receivedAmount: "10" } }), "You sent less than the amount", /emailed you a link/],
    [lockedTtp({ status: "expired", transferToPay: { ...lockedTtp().transferToPay!, receivedAmount: "25.25" } }), "Your transfer arrived after the payment expired", /emailed you a link/],
    [lockedTtp({ status: "expired" }), "This payment expired", /Nothing arrived in time/],
    [payment({ status: "cancelled" }), "This payment was cancelled", /Acme Shoes cancelled it/],
    [payment({ status: "processing" }), "Payment received, confirming", /under a minute/],
    [payment({ status: "failed", failureReason: "The transfer reverted" }), "This payment didn't go through", /The transfer reverted/]
  ])("shows the end state for %#", async (p, heading, hint) => {
    serve(() => ok(p))
    render(<PaystraterCheckout paymentId={ID} publishableKey={PK_TEST} />)
    expect(await screen.findByRole("heading", { name: heading })).toBeTruthy()
    expect(screen.getByText(hint)).toBeTruthy()
  })

  it("calls onSuccess once, for the payer's experience", async () => {
    const onSuccess = vi.fn()
    serve(() => ok(payment({ status: "succeeded" })))
    render(<PaystraterCheckout paymentId={ID} publishableKey={PK_TEST} onSuccess={onSuccess} />)
    await screen.findByRole("heading", { name: "Paid" })
    expect(onSuccess).toHaveBeenCalledTimes(1)
  })

  it("offers Start again on an expired payment when the merchant handles it", async () => {
    const onStartAgain = vi.fn()
    serve(() => ok(payment({ status: "expired" })))
    render(<PaystraterCheckout paymentId={ID} publishableKey={PK_TEST} onStartAgain={onStartAgain} />)
    fireEvent.click(await screen.findByRole("button", { name: "Start again" }))
    expect(onStartAgain).toHaveBeenCalled()
  })

  it("refuses a secret key without calling the API", async () => {
    const net = serve(() => ok(payment()))
    render(<PaystraterCheckout paymentId={ID} publishableKey="sk_live_oops" />)
    expect(await screen.findByRole("alert")).toHaveProperty("textContent", expect.stringMatching(/secret key/))
    expect(net.calls).toHaveLength(0)
  })

  it("fails closed on half an encryption setup: a clear message in test mode, a generic one live", async () => {
    const net = serve(() => ok(payment()))
    const { unmount } = render(<PaystraterCheckout paymentId={ID} publishableKey={PK_TEST} encryption={{ keyId: "AbCdEf0123456789", publicKey: "" }} />)
    expect((await screen.findByRole("alert")).textContent).toMatch(/Pass both encryption.keyId and encryption.publicKey/)
    unmount()
    render(<PaystraterCheckout paymentId={ID} publishableKey={PK_LIVE} encryption={{ keyId: "AbCdEf0123456789", publicKey: "" }} />)
    expect((await screen.findByRole("alert")).textContent).toBe("This checkout is not set up correctly. Ask the shop for a new link.")
    expect(net.calls).toHaveLength(0)
  })

  it("turns the site allowlist 403 into a set-up message in test mode", async () => {
    serve(() => fail(403, "This website is not on the API Key's domain allowlist."))
    render(<PaystraterCheckout paymentId={ID} publishableKey={PK_TEST} />)
    expect((await screen.findByRole("alert")).textContent).toMatch(/Add http:\/\/localhost.* to this publishable key's sites/)
  })

  it("announces status changes in a live region and moves focus to the new step", async () => {
    serve(() => ok(payment()))
    render(<PaystraterCheckout paymentId={ID} publishableKey={PK_TEST} />)
    fireEvent.click(await screen.findByText("Transfer to Pay"))
    await waitFor(() => expect(document.activeElement?.textContent).toBe("Transfer to Pay"))
    expect(screen.getByRole("status")).toBeTruthy()
  })

  it("puts the theme on CSS variables and the nonce on its one style tag", async () => {
    serve(() => ok(payment()))
    const { container } = render(
      <PaystraterCheckout paymentId={ID} publishableKey={PK_TEST} nonce="abc123" appearance={{ variables: { colorPrimary: "#123456" } }} />
    )
    await screen.findByText("Acme Shoes")
    const root = container.querySelector(".ps-checkout") as HTMLElement
    expect(root.style.getPropertyValue("--ps-color-primary")).toBe("#123456")
    expect(container.querySelectorAll("style")).toHaveLength(1)
    expect(container.querySelector("style")!.getAttribute("nonce")).toBe("abc123")
  })

  it("stops polling when unmounted", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const net = serve(() => ok(payment()))
    const { unmount } = render(<PaystraterCheckout paymentId={ID} publishableKey={PK_TEST} />)
    await act(() => vi.advanceTimersByTimeAsync(10))
    unmount()
    const before = net.calls.length
    await act(() => vi.advanceTimersByTimeAsync(30_000))
    expect(net.calls.length).toBe(before)
    vi.useRealTimers()
  })
})
