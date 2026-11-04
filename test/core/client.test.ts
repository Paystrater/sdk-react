import { describe, expect, it, vi } from "vitest"
import vector from "../vectors/encryption.json"
import { createClient } from "../../src/core/client.js"
import { createEncryptor, encryptWith, exchangeWith, hexToBytes, parseMerchantKey } from "../../src/core/encryption.js"
import { fail, fakeFetch, ID, ok, payment, PK_LIVE, PK_TEST } from "../helpers.js"

describe("the client", () => {
  it("calls the sandbox host for a test key with the key header and no cookies", async () => {
    const { fetch, calls } = fakeFetch(() => ok(payment()))
    const client = createClient({ publishableKey: PK_TEST, fetch })
    const res = await client.getPayment(ID)
    expect(res.ok).toBe(true)
    expect(calls[0]!.url).toBe(`https://staging-api.paystrater.com/v1/checkout/payments/${ID}`)
    expect(calls[0]!.headers["x-paystrater-api-key"]).toBe(PK_TEST)
    expect(calls[0]!.headers["Content-Type"]).toBeUndefined()
  })

  it("calls production for a live key", async () => {
    const { fetch, calls } = fakeFetch(() => ok(payment()))
    await createClient({ publishableKey: PK_LIVE, fetch }).getPayment(ID)
    expect(calls[0]!.url.startsWith("https://api.paystrater.com/")).toBe(true)
  })

  it("never sends a call with a secret key", async () => {
    const { fetch, calls } = fakeFetch(() => ok(payment()))
    const client = createClient({ publishableKey: "sk_live_x", fetch })
    const res = await client.getPayment(ID)
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error.kind).toBe("setup")
    expect(calls).toHaveLength(0)
  })

  it("checks the payment ID and never URL-encodes it", async () => {
    const { fetch, calls } = fakeFetch(() => ok(payment()))
    const res = await createClient({ publishableKey: PK_TEST, fetch }).getPayment("rcv_../x")
    expect(res.ok).toBe(false)
    expect(calls).toHaveLength(0)
  })

  it("sends plain JSON bodies and leaves out optional fields", async () => {
    const { fetch, calls } = fakeFetch(() => ok({}))
    await createClient({ publishableKey: PK_TEST, fetch }).startTransferToPay({ receivePaymentId: ID, chainId: 8453, payerEmail: undefined })
    expect(calls[0]!.headers["Content-Type"]).toBe("application/json")
    expect(calls[0]!.body).toEqual({ receivePaymentId: ID, chainId: 8453 })
  })

  it("returns funds to a typed address or to the saved one", async () => {
    const { fetch, calls } = fakeFetch(() => ok({}))
    const client = createClient({ publishableKey: PK_TEST, fetch })
    await client.setRefundAddress(ID, { address: "0x1F2e3D4c5B6a7F8e9D0c1B2a3F4e5D6c7B8a9F0e", token: "t" })
    await client.setRefundAddress(ID, { useSavedAddress: true, token: "t" })
    expect(calls.map((c) => [c.method, c.url.endsWith(`/v1/checkout/payments/${ID}/refund-address`), c.body])).toEqual([
      ["POST", true, { address: "0x1F2e3D4c5B6a7F8e9D0c1B2a3F4e5D6c7B8a9F0e", token: "t" }],
      ["POST", true, { useSavedAddress: true, token: "t" }]
    ])
  })

  it("passes the server's error.message through unchanged", async () => {
    const { fetch } = fakeFetch(() => fail(400, "This payment must be paid on Base"))
    const res = await createClient({ publishableKey: PK_TEST, fetch }).startTransferToPay({ receivePaymentId: ID, chainId: 137 })
    expect(res).toMatchObject({ ok: false, error: { kind: "api", status: 400, message: "This payment must be paid on Base" } })
  })

  it("reads the rate limit headers", async () => {
    const { fetch } = fakeFetch(() => ok(payment(), { headers: { "RateLimit-Limit": "120", "RateLimit-Remaining": "42", "RateLimit-Reset": "31" } }))
    const res = await createClient({ publishableKey: PK_TEST, fetch }).getPayment(ID)
    expect(res.rateLimit).toEqual({ limit: 120, remaining: 42, reset: 31 })
  })

  it("retries a read once after a 429, waiting for Retry-After", async () => {
    vi.useFakeTimers()
    let n = 0
    const { fetch, calls } = fakeFetch(() => (n++ === 0 ? fail(429, "Too many requests.", { "Retry-After": "2" }) : ok(payment())))
    const pending = createClient({ publishableKey: PK_TEST, fetch }).getPayment(ID)
    await vi.advanceTimersByTimeAsync(1900)
    expect(calls).toHaveLength(1)
    await vi.advanceTimersByTimeAsync(200)
    expect((await pending).ok).toBe(true)
    expect(calls).toHaveLength(2)
    vi.useRealTimers()
  })

  it("does not retry a read when Retry-After is long; the checkout waits instead", async () => {
    const { fetch, calls } = fakeFetch(() => fail(429, "Too many requests.", { "Retry-After": "60" }))
    const res = await createClient({ publishableKey: PK_TEST, fetch }).getPayment(ID)
    expect(calls).toHaveLength(1)
    expect(res).toMatchObject({ ok: false, error: { status: 429, retryAfter: 60 } })
  })

  it("never retries a start call, and never retries other 4xx", async () => {
    const { fetch, calls } = fakeFetch(() => fail(502, "The request could not be completed."))
    await createClient({ publishableKey: PK_TEST, fetch }).payWithPaystrater({ receivePaymentId: ID, payer: "ada" })
    expect(calls).toHaveLength(1)
    const four = fakeFetch(() => fail(404, "Payment not found"))
    await createClient({ publishableKey: PK_TEST, fetch: four.fetch }).getPayment(ID)
    expect(four.calls).toHaveLength(1)
  })

  it("answers a timeout as an error, never a throw", async () => {
    vi.useFakeTimers()
    const hang = ((_: RequestInfo | URL, init?: RequestInit) =>
      new Promise((_, reject) => init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError"))))) as typeof fetch
    const pending = createClient({ publishableKey: PK_TEST, fetch: hang, timeoutMs: 1000 }).startAgentic({ receivePaymentId: ID })
    await vi.advanceTimersByTimeAsync(1000)
    expect(await pending).toMatchObject({ ok: false, error: { kind: "timeout" } })
    vi.useRealTimers()
  })

  it("answers a network failure as an error", async () => {
    const down = (async () => {
      throw new TypeError("Failed to fetch")
    }) as typeof fetch
    expect(await createClient({ publishableKey: PK_TEST, fetch: down }).startAgentic({ receivePaymentId: ID })).toMatchObject({ ok: false, error: { kind: "network" } })
  })

  it("stops when the caller cancels", async () => {
    const controller = new AbortController()
    controller.abort()
    const { fetch, calls } = fakeFetch(() => ok(payment()))
    expect(await createClient({ publishableKey: PK_TEST, fetch }).getPayment(ID, controller.signal)).toMatchObject({ ok: false, error: { kind: "cancelled" } })
    expect(calls).toHaveLength(0)
  })
})

describe("the client with encryption", () => {
  const options = { keyId: vector.keyId, publicKey: vector.merchantPublicKey }

  /** A fake server that opens the request with the merchant's private key and encrypts its answer */
  async function serverAnswer(body: { ephemeralPublicKey: string }, plaintext: string) {
    const { getSharedSecret } = await import("@noble/secp256k1")
    // The server's side of ECDH: the merchant's private key with the client's one-time key
    const shared = getSharedSecret(hexToBytes(vector.merchantSecretKey), hexToBytes(body.ephemeralPublicKey), true).slice(1)
    const material = await crypto.subtle.importKey("raw", shared, "HKDF", false, ["deriveKey"])
    const key = await crypto.subtle.deriveKey(
      { name: "HKDF", hash: "SHA-256", salt: new Uint8Array(0), info: new TextEncoder().encode("paystrater-v1-response-body") },
      material,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt"]
    )
    return encryptWith(key, crypto.getRandomValues(new Uint8Array(12)), plaintext)
  }

  it("encrypts a body, marks the call encrypted and decrypts the answer", async () => {
    const { fetch, calls } = fakeFetch(async (req) => {
      const envelope = await serverAnswer(req.body as { ephemeralPublicKey: string }, JSON.stringify({ status: 200, message: "ok", response: payment({ payer: { name: "Ada" } }) }))
      return new Response(JSON.stringify(envelope), { status: 200, headers: { "X-Paystrater-Encrypted": "true" } })
    })
    const client = createClient({ publishableKey: PK_TEST, fetch, encryptor: async () => createEncryptor(options) })
    const res = await client.payWithPaystrater({ receivePaymentId: ID, payer: "ada" })
    expect(calls[0]!.headers["X-Paystrater-Encrypted"]).toBe("true")
    expect(Object.keys(calls[0]!.body as object).sort()).toEqual(["authTag", "ciphertext", "ephemeralPublicKey", "iv", "keyId"])
    expect(res.ok && res.data.payer?.name).toBe("Ada")
  })

  it("sends the key headers on the payment GET and keeps the path ID plain", async () => {
    const { fetch, calls } = fakeFetch(async (req) => {
      const envelope = await serverAnswer({ ephemeralPublicKey: req.headers["X-Paystrater-Ephemeral-Key"]! }, JSON.stringify({ status: 200, message: "ok", response: payment() }))
      return new Response(JSON.stringify(envelope), { status: 200, headers: { "X-Paystrater-Encrypted": "true" } })
    })
    const res = await createClient({ publishableKey: PK_TEST, fetch, encryptor: async () => createEncryptor(options) }).getPayment(ID)
    expect(res.ok).toBe(true)
    expect(calls[0]!.url.endsWith(`/v1/checkout/payments/${ID}`)).toBe(true)
    expect(calls[0]!.headers["X-Paystrater-Key-Id"]).toBe(vector.keyId)
  })

  it("reads plain errors without decrypting them", async () => {
    const { fetch } = fakeFetch(() => fail(400, `keyId "${vector.keyId}" was rotated more than 24 hours ago. Encrypt to the active key shown in the dashboard.`))
    const res = await createClient({ publishableKey: PK_TEST, fetch, encryptor: async () => createEncryptor(options) }).startAgentic({ receivePaymentId: ID })
    expect(res).toMatchObject({ ok: false, error: { kind: "api", status: 400 } })
    if (!res.ok) expect(res.error.message).toMatch(/rotated more than 24 hours ago/)
  })

  it("fails closed: nothing is sent when encryption cannot be set up", async () => {
    const { fetch, calls } = fakeFetch(() => ok(payment()))
    const res = await createClient({
      publishableKey: PK_TEST,
      fetch,
      encryptor: async () => createEncryptor({ keyId: vector.keyId, publicKey: "04" + "00".repeat(64) })
    }).getPayment(ID)
    expect(res).toMatchObject({ ok: false, error: { kind: "encryption" } })
    expect(calls).toHaveLength(0)
  })

  it("refuses a plain answer to an encrypted call", async () => {
    const { fetch } = fakeFetch(() => ok(payment()))
    const res = await createClient({ publishableKey: PK_TEST, fetch, encryptor: async () => createEncryptor(options) }).getPayment(ID)
    expect(res).toMatchObject({ ok: false, error: { kind: "encryption" } })
  })

  it("refuses an answer it cannot decrypt", async () => {
    const exchange = await exchangeWith(hexToBytes("11".repeat(32)), parseMerchantKey(vector.merchantPublicKey))
    const wrong = await encryptWith(exchange.requestKey, new Uint8Array(12), "{}")
    const { fetch } = fakeFetch(() => new Response(JSON.stringify(wrong), { status: 200, headers: { "X-Paystrater-Encrypted": "true" } }))
    const res = await createClient({ publishableKey: PK_TEST, fetch, encryptor: async () => createEncryptor(options) }).getPayment(ID)
    expect(res).toMatchObject({ ok: false, error: { kind: "encryption" } })
  })

  it("carries a set-up problem found before the client was made", async () => {
    const { fetch, calls } = fakeFetch(() => ok(payment()))
    const res = await createClient({ publishableKey: PK_TEST, fetch, setupProblem: "Pass both" }).getPayment(ID)
    expect(res).toMatchObject({ ok: false, error: { kind: "setup", message: "Pass both" } })
    expect(calls).toHaveLength(0)
  })
})
