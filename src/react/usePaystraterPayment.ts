"use client"
// usePaystraterPayment: the checkout flow for merchants who
// build their own UI, and the engine under <PaystraterCheckout>. Same polling
// rules: the first read once visible, then polling only while visible and
// focused, 3 to 5 seconds, stop at a final status.
// On the server it renders the loading state and starts nothing.
import { useEffect, useMemo, useRef, useSyncExternalStore } from "react"
import { browserActivity } from "../core/activity.js"
import { Checkout, type ActionResult, type CheckoutCallbacks, type CheckoutState } from "../core/checkout.js"
import { createClient } from "../core/client.js"
import { checkEncryptionOptions, type EncryptionOptions } from "../core/encryptionConfig.js"
import { encryptorFor } from "../core/encryptor.js"
import type { PaymentMethod, PaymentStatus } from "../core/types.js"

export interface PaystraterPaymentOptions extends CheckoutCallbacks {
  /** Your publishable key, pk_live_… or pk_test_…. Never a secret key */
  publishableKey: string
  /** Your encryption key ID and public key from the dashboard, both or neither */
  encryption?: EncryptionOptions
  /** Only narrows the payment's chains */
  chains?: number[]
  /** Overrides the API host the key picks */
  apiBaseUrl?: string
  /** Set when another hook instance drives the same payment, so this one starts nothing */
  disabled?: boolean
}

export interface PayerDetails {
  email?: string
  name?: string
  /** An EVM address on the chosen chain for any refund; without it refunds go to the sending address */
  refundAddress?: string
}

export interface PaystraterPayment extends CheckoutState {
  /** The payment's status, the same as payment.status */
  status: PaymentStatus | undefined
  choose(method: PaymentMethod): void
  back(): void
  /** Starts a Transfer to Pay deposit on a chain from `chains` (POST /v1/checkout/transfer-to-pay) */
  startDeposit(chainId: number, payer?: PayerDetails): Promise<ActionResult>
  payWithPaystrater(payer: string): Promise<ActionResult>
  startAgentic(): Promise<ActionResult>
  /** Reads the payment again now */
  refresh(): void
}

const SERVER_STATE: CheckoutState = {
  stage: "loading",
  methods: [],
  chains: [],
  busy: false,
  slowed: false,
  underpaid: false,
  late: false
}

export function usePaystraterPayment(paymentId: string, options: PaystraterPaymentOptions): PaystraterPayment {
  const { publishableKey, apiBaseUrl, disabled } = options
  const keyId = options.encryption?.keyId
  const publicKey = options.encryption?.publicKey
  const chainsKey = options.chains?.join(",") ?? ""

  // The latest callbacks, without restarting the checkout when they change
  const callbacks = useRef<CheckoutCallbacks>(options)
  useEffect(() => {
    callbacks.current = options
  })

  const checkout = useMemo(() => {
    const enc = checkEncryptionOptions(keyId || publicKey ? { keyId, publicKey } : null)
    const encryption = enc.ok ? enc.options : null
    const client = createClient({
      publishableKey,
      apiBaseUrl,
      setupProblem: enc.ok ? undefined : enc.message,
      // The curve code is a separate chunk that only loads when encryption is asked for
      encryptor: encryption ? encryptorFor(encryption) : undefined
    })
    return new Checkout({
      client,
      paymentId,
      chains: chainsKey ? chainsKey.split(",").map(Number) : undefined,
      activity: browserActivity(),
      callbacks: {
        onStatusChange: (p) => callbacks.current.onStatusChange?.(p),
        onSuccess: (p) => callbacks.current.onSuccess?.(p),
        onExpired: (p) => callbacks.current.onExpired?.(p),
        onCancelled: (p) => callbacks.current.onCancelled?.(p),
        onError: (e) => callbacks.current.onError?.(e)
      }
    })
  }, [paymentId, publishableKey, apiBaseUrl, keyId, publicKey, chainsKey])

  useEffect(() => {
    if (disabled) return
    checkout.start()
    return () => checkout.stop()
  }, [checkout, disabled])

  const state = useSyncExternalStore(checkout.subscribe, checkout.getState, () => SERVER_STATE)

  return useMemo(
    () => ({
      ...state,
      status: state.payment?.status,
      choose: (method: PaymentMethod) => checkout.choose(method),
      back: () => checkout.back(),
      startDeposit: (chainId: number, payer?: PayerDetails) =>
        checkout.startTransferToPay({ chainId, payerEmail: payer?.email, payerName: payer?.name, refundAddress: payer?.refundAddress }),
      payWithPaystrater: (payer: string) => checkout.payWithPaystrater(payer),
      startAgentic: () => checkout.startAgentic(),
      refresh: () => checkout.refresh()
    }),
    [state, checkout]
  )
}
