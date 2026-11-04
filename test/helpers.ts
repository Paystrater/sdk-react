import type { CheckoutPayment, TransferToPayStart } from "../src/core/types.js"

export const PK_TEST = "pk_test_abc123"
export const PK_LIVE = "pk_live_abc123"
export const ID = "rcv_test0001"

/** A payment as the checkout route answers it, waiting for the payer with no method chosen */
export function payment(overrides: Partial<CheckoutPayment> = {}): CheckoutPayment {
  return {
    id: ID,
    transactionType: "incoming_payment",
    status: "requires_action",
    merchantName: "Acme Shoes",
    amount: "25.00",
    tokenTicker: "USDC",
    feeBearer: "customer",
    chains: [
      { chainId: 8453, chainName: "Base" },
      { chainId: 137, chainName: "Polygon" },
      { chainId: 101, chainName: "Solana" }
    ],
    methods: ["agentic", "transfer_to_pay", "pay_with_paystrater"],
    expiresAt: new Date(Date.now() + 3600_000).toISOString(),
    createdAt: new Date().toISOString(),
    livemode: false,
    ...overrides
  }
}

export function deposit(overrides: Partial<TransferToPayStart> = {}): TransferToPayStart {
  return {
    receivePaymentId: ID,
    depositAddress: "0xdbF03B407c01E7cD3CBea99509d93f8DDDC8C6FB",
    chainId: 8453,
    chainName: "Base",
    tokenTicker: "USDC",
    amount: "25.00",
    fee: "0.25",
    totalAmount: "25.25",
    expiresAt: new Date(Date.now() + 20 * 60_000).toISOString(),
    tokenAddress: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    tokenDecimals: 6,
    ...overrides
  }
}

type Route = (req: { method: string; url: string; headers: Record<string, string>; body: unknown }) => Response | Promise<Response>

export interface Recorded {
  method: string
  url: string
  headers: Record<string, string>
  body: unknown
}

/** A fake fetch that answers with `route` and records every call */
export function fakeFetch(route: Route) {
  const calls: Recorded[] = []
  const fn = async (input: RequestInfo | URL, init?: RequestInit) => {
    if (init?.signal?.aborted) throw new DOMException("aborted", "AbortError")
    const headers = { ...(init?.headers as Record<string, string>) }
    const body = typeof init?.body === "string" ? JSON.parse(init.body) : undefined
    const rec = { method: init?.method ?? "GET", url: String(input), headers, body }
    calls.push(rec)
    return route(rec)
  }
  return { fetch: fn as typeof fetch, calls }
}

export function ok(response: unknown, init: { status?: number; headers?: Record<string, string>; message?: string } = {}) {
  return new Response(JSON.stringify({ status: init.status ?? 200, message: init.message ?? "ok", response }), {
    status: init.status ?? 200,
    headers: { "Content-Type": "application/json", ...init.headers }
  })
}

export function fail(status: number, message: string, headers: Record<string, string> = {}) {
  const body = status === 429 ? { error: { type: "rate_limit_error", message } } : { isError: true, error: { status, message, type: "BadRequestError" } }
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...headers } })
}
