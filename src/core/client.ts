// The one network wrapper of the SDK. It owns the
// headers, encryption, the timeout and retries, reads the rate limit
// headers, and never throws: every call answers a CallResult with the
// server's error.message unchanged. Nothing here logs a body, a key or an
// address. Checkout routes use a publishable key only.
import { apiBaseFor, checkPublishableKey, isPaymentId, type KeyMode } from "./keys.js"
import { setupError, type PaystraterError } from "./errors.js"
import type { Encryptor } from "./encryptionTypes.js"
import type {
  AgenticInput,
  CheckoutPayment,
  EncryptedResponse,
  PayWithPaystraterInput,
  RefundAddressInput,
  TransferToPayInput,
  TransferToPayStart
} from "./types.js"

export interface RateLimit {
  limit?: number
  remaining?: number
  /** Seconds until the window resets */
  reset?: number
}

export type CallResult<T> =
  | { ok: true; data: T; message: string; status: number; rateLimit: RateLimit }
  | { ok: false; error: PaystraterError; rateLimit: RateLimit }

export interface ClientConfig {
  publishableKey: string
  /** Overrides the host the key's mode picks (https://api.paystrater.com or the sandbox) */
  apiBaseUrl?: string
  /** Present only when the merchant asked for encryption; loads the curve code on first use */
  encryptor?: () => Promise<Encryptor>
  /** A set-up problem found before the client was made (bad encryption options): every call answers it */
  setupProblem?: string
  /** The platform's fetch; tests pass their own */
  fetch?: typeof fetch
  timeoutMs?: number
}

export interface CheckoutClient {
  readonly mode: KeyMode | undefined
  /** Set when the key or options are wrong: every call then answers it */
  readonly setupProblem: PaystraterError | undefined
  getPayment(id: string, signal?: AbortSignal): Promise<CallResult<CheckoutPayment>>
  startTransferToPay(input: TransferToPayInput, signal?: AbortSignal): Promise<CallResult<TransferToPayStart>>
  payWithPaystrater(input: PayWithPaystraterInput, signal?: AbortSignal): Promise<CallResult<CheckoutPayment>>
  startAgentic(input: AgenticInput, signal?: AbortSignal): Promise<CallResult<CheckoutPayment>>
  setRefundAddress(id: string, input: RefundAddressInput, signal?: AbortSignal): Promise<CallResult<CheckoutPayment>>
}

const DEFAULT_TIMEOUT_MS = 30_000
const MAX_RETRY_WAIT_S = 10
const RETRYABLE = new Set([429, 502, 503])

const noRate: RateLimit = {}

function readNumber(value: string | null): number | undefined {
  if (value === null || value.trim() === "") return undefined
  const n = Number(value)
  return Number.isFinite(n) ? n : undefined
}

/** Retry-After in seconds: a number, or an HTTP date */
export function readRetryAfter(value: string | null): number | undefined {
  if (!value) return undefined
  const seconds = Number(value)
  if (Number.isFinite(seconds) && seconds >= 0) return seconds
  const at = Date.parse(value)
  return Number.isNaN(at) ? undefined : Math.max(0, Math.ceil((at - Date.now()) / 1000))
}

function readRateLimit(headers: Headers): RateLimit {
  return {
    limit: readNumber(headers.get("RateLimit-Limit")),
    remaining: readNumber(headers.get("RateLimit-Remaining")),
    reset: readNumber(headers.get("RateLimit-Reset"))
  }
}

/** A 403 with no Paystrater error body came from in front of the API (a per-IP block), so it will pass */
const BLOCKED_MESSAGE = "Too many requests from your network. Wait a moment, then try again."

function fallbackMessage(status: number): string {
  if (status === 429) return "Too many requests. Wait a moment, then try again."
  if (status >= 500) return "Something went wrong at Paystrater. Try again in a moment."
  return "The request could not be completed."
}

const isEnvelope = (v: unknown): v is EncryptedResponse =>
  typeof v === "object" &&
  v !== null &&
  typeof (v as EncryptedResponse).iv === "string" &&
  typeof (v as EncryptedResponse).authTag === "string" &&
  typeof (v as EncryptedResponse).ciphertext === "string"

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve) => {
    const timer = setTimeout(done, ms)
    function done() {
      clearTimeout(timer)
      signal?.removeEventListener("abort", done)
      resolve()
    }
    signal?.addEventListener("abort", done, { once: true })
  })

interface Request {
  method: "GET" | "POST"
  path: string
  body?: unknown
}

export function createClient(config: ClientConfig): CheckoutClient {
  const key = checkPublishableKey(config.publishableKey)
  const mode = key.ok ? key.mode : undefined
  const setupProblem = !key.ok ? setupError(key.message) : config.setupProblem ? setupError(config.setupProblem) : undefined
  const base = (config.apiBaseUrl ?? (mode ? apiBaseFor(mode) : "")).replace(/\/$/, "")
  const timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const doFetch = config.fetch ?? ((input: RequestInfo | URL, init?: RequestInit) => fetch(input, init))

  let encryptor: Promise<Encryptor> | undefined
  const getEncryptor = () => {
    // A failed load is not kept, so the next call tries again
    encryptor ??= config.encryptor!().catch((err: unknown) => {
      encryptor = undefined
      throw err
    })
    return encryptor
  }

  async function once<T>(req: Request, signal?: AbortSignal): Promise<CallResult<T>> {
    if (setupProblem) return { ok: false, error: setupProblem, rateLimit: noRate }
    if (signal?.aborted) return { ok: false, error: { kind: "cancelled", status: 0, message: "Cancelled." }, rateLimit: noRate }

    const headers: Record<string, string> = { "x-paystrater-api-key": config.publishableKey }
    let payload: string | undefined
    let responseKey: CryptoKey | undefined

    // Encryption first: if it was asked for and cannot be done, nothing is sent
    if (config.encryptor) {
      try {
        const enc = await getEncryptor()
        if (req.body !== undefined) {
          const sealed = await enc.encryptBody(JSON.stringify(req.body))
          headers["X-Paystrater-Encrypted"] = "true"
          payload = JSON.stringify(sealed.body)
          responseKey = sealed.responseKey
        } else {
          const bodyless = await enc.bodylessHeaders()
          Object.assign(headers, bodyless.headers)
          responseKey = bodyless.responseKey
        }
      } catch {
        return {
          ok: false,
          error: { kind: "encryption", status: 0, message: "The checkout could not encrypt this call, so it was not sent. Check the encryption key ID and public key." },
          rateLimit: noRate
        }
      }
    } else if (req.body !== undefined) {
      payload = JSON.stringify(req.body)
    }
    if (payload !== undefined) headers["Content-Type"] = "application/json"

    const controller = new AbortController()
    let timedOut = false
    const timer = setTimeout(() => {
      timedOut = true
      controller.abort()
    }, timeoutMs)
    const onAbort = () => controller.abort()
    signal?.addEventListener("abort", onAbort, { once: true })

    let res: Response
    try {
      res = await doFetch(base + req.path, {
        method: req.method,
        headers,
        body: payload,
        signal: controller.signal,
        credentials: "omit",
        cache: "no-store",
        referrerPolicy: "no-referrer"
      })
    } catch {
      if (signal?.aborted) return { ok: false, error: { kind: "cancelled", status: 0, message: "Cancelled." }, rateLimit: noRate }
      return {
        ok: false,
        error: timedOut
          ? { kind: "timeout", status: 0, message: "Paystrater took too long to answer. Check your connection and try again." }
          : { kind: "network", status: 0, message: "We couldn't reach Paystrater. Check your connection and try again." },
        rateLimit: noRate
      }
    } finally {
      clearTimeout(timer)
      signal?.removeEventListener("abort", onAbort)
    }

    const rateLimit = readRateLimit(res.headers)
    let json: unknown = null
    try {
      json = JSON.parse(await res.text())
    } catch {}

    // Errors come back plain: read the status before decrypting
    if (!res.ok || (json as { isError?: unknown } | null)?.isError === true) {
      const err = ((json as { error?: Record<string, unknown> } | null)?.error ?? {}) as Record<string, unknown>
      if (res.status === 403 && typeof err.message !== "string") {
        return { ok: false, error: { kind: "network", status: 403, message: BLOCKED_MESSAGE }, rateLimit }
      }
      return {
        ok: false,
        error: {
          kind: "api",
          status: res.status,
          message: typeof err.message === "string" && err.message ? err.message : fallbackMessage(res.status),
          type: typeof err.type === "string" ? err.type : undefined,
          retryAfter: readRetryAfter(res.headers.get("Retry-After"))
        },
        rateLimit
      }
    }

    if (responseKey) {
      // An encrypted call's 2xx answer is always encrypted; a plain one is refused (fail closed)
      if (!isEnvelope(json)) {
        return { ok: false, error: { kind: "encryption", status: res.status, message: "Paystrater's answer was not encrypted as expected." }, rateLimit }
      }
      try {
        const enc = await getEncryptor()
        json = JSON.parse(await enc.decrypt(responseKey, json))
      } catch {
        return { ok: false, error: { kind: "encryption", status: res.status, message: "Paystrater's answer could not be decrypted with this encryption key." }, rateLimit }
      }
    }

    const envelope = (json ?? {}) as { response?: unknown; message?: unknown }
    return {
      ok: true,
      data: envelope.response as T,
      message: typeof envelope.message === "string" ? envelope.message : "",
      status: res.status,
      rateLimit
    }
  }

  // Reads retry once on a network error, 429 (after Retry-After, if short), 502
  // or 503. Starts never retry here: the checkout reads the payment again instead
  async function call<T>(req: Request, signal?: AbortSignal): Promise<CallResult<T>> {
    const first = await once<T>(req, signal)
    if (first.ok || req.method !== "GET") return first
    const { kind, status, retryAfter } = first.error
    const retryable = kind === "network" || kind === "timeout" || (kind === "api" && RETRYABLE.has(status))
    if (!retryable || (retryAfter !== undefined && retryAfter > MAX_RETRY_WAIT_S)) return first
    await sleep(kind === "api" ? (retryAfter ?? 2) * 1000 : 800, signal)
    if (signal?.aborted) return first
    return once<T>(req, signal)
  }

  const badId = (): CallResult<never> => ({
    ok: false,
    error: setupError("This payment link is incomplete. The payment ID must look like rcv_…"),
    rateLimit: noRate
  })

  return {
    mode,
    setupProblem,
    // The path ID is checked and never URL-encoded: a path with % or /. is refused
    getPayment: (id, signal) => (isPaymentId(id) ? call({ method: "GET", path: `/v1/checkout/payments/${id}` }, signal) : Promise.resolve(badId())),
    startTransferToPay: (input, signal) => call({ method: "POST", path: "/v1/checkout/transfer-to-pay", body: input }, signal),
    payWithPaystrater: (input, signal) => call({ method: "POST", path: "/v1/checkout/pay-with-paystrater", body: input }, signal),
    startAgentic: (input, signal) => call({ method: "POST", path: "/v1/checkout/agentic", body: input }, signal),
    setRefundAddress: (id, input, signal) =>
      isPaymentId(id) ? call({ method: "POST", path: `/v1/checkout/payments/${id}/refund-address`, body: input }, signal) : Promise.resolve(badId())
  }
}
