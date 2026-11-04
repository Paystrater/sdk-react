// The checkout flow, framework-free: the state, the
// actions and the polling. React and React Native render it; Flutter ports it
// to Dart against the same tests. The page never creates a payment and never
// takes an amount from the browser: it reads the payment and starts a method.
import { alwaysActive, type ActivitySource } from "./activity.js"
import { checkEvmAddress } from "./address.js"
import { compareAmounts, isPositiveAmount } from "./amount.js"
import type { CallResult, CheckoutClient, RateLimit } from "./client.js"
import type { PaystraterError } from "./errors.js"
import type { KeyMode } from "./keys.js"
import {
  isFinalStatus,
  type ChainOption,
  type CheckoutPayment,
  type PaymentMethod,
  type TransferToPayStart
} from "./types.js"

export type Stage =
  /** Reading the payment for the first time */
  | "loading"
  /** Choosing how to pay */
  | "methods"
  | "pay_with_paystrater"
  | "transfer_to_pay"
  | "agentic"
  /** Paid, settling on the chain */
  | "processing"
  /** A final status: succeeded, failed, expired, cancelled or refunded */
  | "final"
  /** A status this build does not know yet: shown as "Updating" and read again */
  | "updating"
  /** The payment could not be read at all */
  | "unavailable"

/** One Transfer to Pay deposit, from the start answer or from the payment's transferToPay */
export interface Deposit {
  depositAddress: string
  /** The exact amount to send, fee included */
  amount: string
  fee?: string
  tokenTicker: string
  chainId?: number
  chainName?: string
  expiresAt: string
  tokenAddress?: string
  tokenDecimals?: number
  receivedAmount?: string
  excessRefunded?: string
}

export interface CheckoutState {
  stage: Stage
  payment?: CheckoutPayment
  /** The method the payer picked, until a start call locks it on the server */
  chosen?: PaymentMethod
  deposit?: Deposit
  /** Methods to offer, in the order of 5.1 */
  methods: PaymentMethod[]
  /** Chains Transfer to Pay can use: the payment's, never Solana, narrowed by the merchant */
  chains: ChainOption[]
  /** A start call is in flight */
  busy: boolean
  /** The last action or read that failed, for the payer to see */
  error?: PaystraterError
  mode?: KeyMode
  /** Polling slowed to every 10 seconds because RateLimit-Remaining fell under 50 */
  slowed: boolean
  /** Expired with less than the amount received: the payer gets a return link by email */
  underpaid: boolean
  /** Expired, and the whole amount arrived after the deadline: also returned by email */
  late: boolean
}

export interface CheckoutCallbacks {
  onStatusChange?: (payment: CheckoutPayment) => void
  /** For the payer's experience only: ship goods on the incoming_payment.succeeded webhook */
  onSuccess?: (payment: CheckoutPayment) => void
  onExpired?: (payment: CheckoutPayment) => void
  onCancelled?: (payment: CheckoutPayment) => void
  onError?: (error: PaystraterError) => void
}

export interface CheckoutOptions {
  client: CheckoutClient
  paymentId: string
  /** Only narrows the payment's chains */
  chains?: number[]
  activity?: ActivitySource
  callbacks?: CheckoutCallbacks
  /** Polling interval while visible and focused: 3 to 5 seconds */
  pollMs?: number
}

export interface TransferToPayDetailsInput {
  chainId: number
  payerEmail?: string
  payerName?: string
  refundAddress?: string
}

export type FieldProblem = "email" | "refundAddressFormat" | "refundAddressChecksum" | "payerRequired" | "chain"

export type ActionResult = { ok: true } | { ok: false; field?: FieldProblem; error?: PaystraterError }

const POLL_MS = 4_000
const SLOW_POLL_MS = 10_000
const SLOW_UNDER = 50
const MAX_BACKOFF_MS = 30_000
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Every status but a final one keeps the page reading, unknown ones included */
const isWaiting = (status?: string) => status !== undefined && !isFinalStatus(status)

function isSolana(chain: ChainOption): boolean {
  return /solana/i.test(chain.chainName)
}

/** The Transfer to Pay chains: a fixed chain gives one; Solana is never offered; the prop only narrows */
export function transferChains(payment: CheckoutPayment | undefined, narrow?: number[]): ChainOption[] {
  if (!payment) return []
  let chains = (payment.chains ?? []).filter((c) => !isSolana(c))
  if (payment.chainId) chains = chains.filter((c) => c.chainId === payment.chainId)
  if (chains.length === 0 && payment.chainId && payment.chainName && !/solana/i.test(payment.chainName)) {
    chains = [{ chainId: payment.chainId, chainName: payment.chainName }]
  }
  if (narrow && narrow.length > 0) {
    const narrowed = chains.filter((c) => narrow.includes(c.chainId))
    if (narrowed.length > 0) chains = narrowed
  }
  return chains
}

/** Methods to offer, in the order of 5.1; present only while the payment needs action and has no method */
export function offeredMethods(payment: CheckoutPayment | undefined, chains: ChainOption[]): PaymentMethod[] {
  if (!payment || payment.status !== "requires_action" || payment.method) return []
  const order: PaymentMethod[] = ["pay_with_paystrater", "transfer_to_pay", "agentic"]
  const listed = payment.methods ?? []
  return order.filter((m) => listed.includes(m) && (m !== "transfer_to_pay" || chains.length > 0))
}

/** The deposit to show: the payment's own transferToPay wins, the start answer fills in */
export function depositFrom(payment: CheckoutPayment | undefined, started?: TransferToPayStart): Deposit | undefined {
  const t = payment?.transferToPay
  if (t) {
    return {
      depositAddress: t.depositAddress,
      amount: t.expectedAmount,
      fee: payment?.feeBearer === "customer" ? started?.fee ?? payment?.fee : undefined,
      tokenTicker: payment!.tokenTicker,
      chainId: payment!.chainId ?? started?.chainId,
      chainName: payment!.chainName ?? started?.chainName,
      expiresAt: t.depositExpiresAt,
      tokenAddress: t.tokenAddress ?? started?.tokenAddress,
      tokenDecimals: t.tokenDecimals ?? started?.tokenDecimals,
      receivedAmount: t.receivedAmount,
      excessRefunded: t.excessRefunded
    }
  }
  if (started) {
    return {
      depositAddress: started.depositAddress,
      amount: started.totalAmount,
      fee: payment?.feeBearer === "customer" ? started.fee : undefined,
      tokenTicker: started.tokenTicker,
      chainId: started.chainId,
      chainName: started.chainName,
      expiresAt: started.expiresAt,
      tokenAddress: started.tokenAddress,
      tokenDecimals: started.tokenDecimals
    }
  }
  return undefined
}

/** An expired Transfer to Pay that received money: short (underpaid) or in full after the deadline (late) */
function arrival(payment: CheckoutPayment | undefined): { underpaid: boolean; late: boolean } {
  const t = payment?.transferToPay
  if (payment?.status !== "expired" || !t || !isPositiveAmount(t.receivedAmount)) return { underpaid: false, late: false }
  const full = compareAmounts(t.receivedAmount!, t.expectedAmount)
  return full !== undefined && full >= 0 ? { underpaid: false, late: true } : { underpaid: true, late: false }
}

function stageFor(payment: CheckoutPayment | undefined, chosen: PaymentMethod | undefined, methods: PaymentMethod[]): Stage {
  if (!payment) return "loading"
  if (isFinalStatus(payment.status)) return "final"
  if (payment.status === "processing") return "processing"
  if (payment.status !== "requires_action") return "updating"
  if (payment.method) return payment.method
  if (chosen) return chosen
  if (methods.length === 1) return methods[0]!
  return "methods"
}

export class Checkout {
  private state: CheckoutState
  private readonly listeners = new Set<(state: CheckoutState) => void>()
  private readonly client: CheckoutClient
  private readonly paymentId: string
  private readonly narrow?: number[]
  private readonly activity: ActivitySource
  private readonly callbacks: CheckoutCallbacks
  private readonly pollMs: number
  private started?: TransferToPayStart
  private timer?: ReturnType<typeof setTimeout>
  private inFlight?: AbortController
  private stopActivity?: () => void
  private failures = 0
  private running = false
  private lastStatus?: string

  constructor(options: CheckoutOptions) {
    this.client = options.client
    this.paymentId = options.paymentId
    this.narrow = options.chains
    this.activity = options.activity ?? alwaysActive
    this.callbacks = options.callbacks ?? {}
    this.pollMs = Math.min(5_000, Math.max(3_000, options.pollMs ?? POLL_MS))
    this.state = {
      stage: "loading",
      methods: [],
      chains: [],
      busy: false,
      mode: options.client.mode,
      slowed: false,
      underpaid: false,
      late: false
    }
  }

  getState = (): CheckoutState => this.state

  subscribe = (listener: (state: CheckoutState) => void): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  /** Starts reading and polling; call once, in the browser only (never during server rendering) */
  start(): void {
    if (this.running) return
    this.running = true
    if (this.client.setupProblem) {
      this.set({ stage: "unavailable", error: this.client.setupProblem })
      this.callbacks.onError?.(this.client.setupProblem)
      return
    }
    this.stopActivity = this.activity.subscribe((active) => {
      if (active) {
        // Back on the page: one read straight away, then the normal rhythm
        this.clearTimer()
        void this.read()
      } else if (this.mayRead()) {
        // Visible but unfocused before the payment has loaded: let the first read run or start
        if (!this.inFlight && this.timer === undefined) void this.read()
      } else {
        this.pause()
      }
    })
    if (this.mayRead()) void this.read()
  }

  /** Stops every timer and call; the checkout can be started again */
  stop(): void {
    this.running = false
    this.pause()
    this.stopActivity?.()
    this.stopActivity = undefined
  }

  /** Read the payment again now (after an error, or when a countdown ends) */
  refresh(): void {
    if (!this.running) return
    this.clearTimer()
    void this.read()
  }

  choose(method: PaymentMethod): void {
    if (this.state.payment?.method || !this.state.methods.includes(method)) return
    this.set({ chosen: method, error: undefined })
  }

  /** Back to the method picker, until a start call has locked the method */
  back(): void {
    if (this.state.payment?.method) return
    this.set({ chosen: undefined, error: undefined })
  }

  async startTransferToPay(input: TransferToPayDetailsInput): Promise<ActionResult> {
    const payerEmail = input.payerEmail?.trim() || undefined
    const payerName = input.payerName?.trim() || undefined
    const refundAddress = input.refundAddress?.trim() || undefined
    if (!this.state.chains.some((c) => c.chainId === input.chainId)) return { ok: false, field: "chain" }
    if (payerEmail && !EMAIL.test(payerEmail)) return { ok: false, field: "email" }
    if (refundAddress) {
      const check = checkEvmAddress(refundAddress)
      if (check === "format") return { ok: false, field: "refundAddressFormat" }
      if (check === "checksum") return { ok: false, field: "refundAddressChecksum" }
    }
    const body = { receivePaymentId: this.paymentId, chainId: input.chainId, payerEmail, payerName, refundAddress }
    return this.act(async () => {
      let res = await this.client.startTransferToPay(body)
      // "The deposit address was taken; please try again" (500): the same call once more.
      // Safe: the same chain answers the same deposit
      if (!res.ok && res.error.kind === "api" && res.error.status === 500) res = await this.client.startTransferToPay(body)
      if (res.ok) this.started = res.data
      return res
    })
  }

  async payWithPaystrater(payer: string): Promise<ActionResult> {
    const value = payer.trim()
    if (!value || value.length > 100) return { ok: false, field: "payerRequired" }
    return this.act(() => this.client.payWithPaystrater({ receivePaymentId: this.paymentId, payer: value }))
  }

  async startAgentic(): Promise<ActionResult> {
    return this.act(() => this.client.startAgentic({ receivePaymentId: this.paymentId }))
  }

  // ---- internals ----

  private set(patch: Partial<CheckoutState>) {
    const next = { ...this.state, ...patch }
    const chains = transferChains(next.payment, this.narrow)
    const methods = offeredMethods(next.payment, chains)
    const chosen = next.chosen && methods.includes(next.chosen) ? next.chosen : undefined
    const status = next.payment?.status
    this.state = {
      ...next,
      chains,
      methods,
      chosen,
      // Without a payment the page is loading, or unavailable once a read failed for good
      stage: next.payment ? stageFor(next.payment, chosen, methods) : next.stage === "unavailable" ? "unavailable" : "loading",
      deposit: depositFrom(next.payment, this.started),
      ...arrival(next.payment)
    }
    for (const listener of this.listeners) listener(this.state)
  }

  /** A start call: one at a time; the answer is folded in, then the payment is read again */
  private async act<T>(run: () => Promise<CallResult<T>>): Promise<ActionResult> {
    if (this.state.busy) return { ok: false }
    this.set({ busy: true, error: undefined })
    const res = await run()
    this.noteRate(res.rateLimit)
    if (res.ok) {
      const data = res.data as unknown as CheckoutPayment | TransferToPayStart
      // Pay with Paystrater and agent answer the payment itself; Transfer to Pay answers the deposit
      if (data && typeof data === "object" && "status" in data) this.observe(data)
      this.set({ busy: false })
      this.refresh()
      return { ok: true }
    }
    // Locked to another method, expired or cancelled since the last read: read it again and show its end state
    this.set({ busy: false, error: res.error })
    this.callbacks.onError?.(res.error)
    this.refresh()
    return { ok: false, error: res.error }
  }

  /** Polling needs a visible, focused page; the first read only a visible one, so an embedded checkout loads before the payer clicks into it */
  private mayRead(): boolean {
    return this.activity.isActive() || (!this.state.payment && this.activity.isVisible?.() === true)
  }

  private async read(): Promise<void> {
    if (!this.running || !this.mayRead()) return
    this.inFlight?.abort()
    const controller = new AbortController()
    this.inFlight = controller
    const res = await this.client.getPayment(this.paymentId, controller.signal)
    if (this.inFlight === controller) this.inFlight = undefined
    if (controller.signal.aborted || !this.running) return
    this.noteRate(res.rateLimit)

    if (res.ok) {
      this.failures = 0
      this.observe(res.data)
      if (this.state.error && this.state.error.kind !== "api") this.set({ error: undefined })
      this.schedule(this.state.slowed ? SLOW_POLL_MS : this.pollMs)
      return
    }

    const error = res.error
    if (error.kind === "cancelled") return
    const fatal = error.kind === "setup" || error.kind === "encryption" || (error.kind === "api" && [400, 401, 403, 404].includes(error.status))
    if (fatal) {
      // Nothing to wait for: a wrong key, a payment that does not exist, or encryption that cannot work
      this.set(this.state.payment ? { error } : { error, stage: "unavailable" })
      this.callbacks.onError?.(error)
      return
    }
    this.failures += 1
    this.set({ error })
    // 429: wait Retry-After; network and 5xx: back off, keeping any countdown running
    const wait =
      error.kind === "api" && error.status === 429
        ? Math.max((error.retryAfter ?? 10) * 1000, this.pollMs)
        : Math.min(this.pollMs * 2 ** this.failures, MAX_BACKOFF_MS)
    this.schedule(wait)
  }

  private observe(payment: CheckoutPayment) {
    const changed = payment.status !== this.lastStatus
    this.lastStatus = payment.status
    this.set({ payment })
    if (!changed) return
    this.callbacks.onStatusChange?.(payment)
    if (payment.status === "succeeded") this.callbacks.onSuccess?.(payment)
    else if (payment.status === "expired") this.callbacks.onExpired?.(payment)
    else if (payment.status === "cancelled") this.callbacks.onCancelled?.(payment)
  }

  private noteRate(rate: RateLimit) {
    // Under 50 left: every 10 seconds; back to normal at 50 or more, or when the header is missing
    const slowed = rate.remaining !== undefined && rate.remaining < SLOW_UNDER
    if (slowed !== this.state.slowed) this.set({ slowed })
  }

  private schedule(ms: number) {
    this.clearTimer()
    if (!this.running || !isWaiting(this.state.payment?.status)) return
    this.timer = setTimeout(() => void this.read(), ms)
  }

  private clearTimer() {
    if (this.timer !== undefined) clearTimeout(this.timer)
    this.timer = undefined
  }

  private pause() {
    // Hidden or unfocused: no timer and no call in flight
    this.clearTimer()
    this.inFlight?.abort()
    this.inFlight = undefined
  }
}
