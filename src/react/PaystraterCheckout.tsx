"use client"
// <PaystraterCheckout>: the whole checkout on a
// publishable key. Load, choose a method (Pay with Paystrater, Transfer to Pay,
// an agent), follow the payment, and show its end state. The hosted page is
// built from this same component, so the two never drift.
import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react"
import { walletLink, formatAmount, isPositiveAmount } from "../core/amount.js"
import type { Deposit, FieldProblem } from "../core/checkout.js"
import type { EncryptionOptions } from "../core/encryptionConfig.js"
import { errorForPayer, type PaystraterError } from "../core/errors.js"
import { fill, stringsFor, type Locale, type Strings } from "../core/strings.js"
import { contrastWarnings, resolveTheme, toCssVariables, type Appearance } from "../core/theme.js"
import type { CheckoutPayment, PaymentMethod } from "../core/types.js"
import { qrMatrix, qrPath } from "./qr.js"
import { CSS } from "./styles.js"
import { usePaystraterPayment, type PaystraterPayment, type PaystraterPaymentOptions } from "./usePaystraterPayment.js"

export interface PaystraterCheckoutProps extends Omit<PaystraterPaymentOptions, "disabled"> {
  /** The rcv_ ID your server created with your secret key. The checkout never takes an amount from the page */
  paymentId: string
  /** Theme and variables, as in enterprise-grade checkout SDKs */
  appearance?: Appearance
  locale?: Locale
  /** Replace any of the checkout's words */
  strings?: Partial<Strings>
  /** The nonce for the one style tag, under a strict Content Security Policy */
  nonce?: string
  /** Shown on the expired screen as "Start again": create a new payment and show it */
  onStartAgain?: () => void
  /** Drive the component from your own usePaystraterPayment instead of its own */
  checkout?: PaystraterPayment
  /** Rendered beside the merchant's name, such as a back link */
  headerAction?: ReactNode
  /** Rendered under the end screen */
  endFooter?: ReactNode
  /** Ask before the tab closes while a deposit is expected (default true); turn off once the payer chose to leave */
  warnOnLeave?: boolean
  className?: string
}

const APP_LINK = "https://app.paystrater.com/pay?id="

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("")
}

function formatDuration(seconds: number): string {
  if (seconds >= 3600) {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    return `${h} h ${m} min`
  }
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${String(s).padStart(2, "0")}`
}

function useCountdown(expiresAt: string | undefined, onEnd: () => void): number | undefined {
  const end = expiresAt ? Date.parse(expiresAt) : NaN
  const [left, setLeft] = useState<number | undefined>(undefined)
  const onEndRef = useRef(onEnd)
  useEffect(() => {
    onEndRef.current = onEnd
  })
  useEffect(() => {
    if (Number.isNaN(end)) return setLeft(undefined)
    let ended = false
    const tick = () => {
      const s = Math.max(0, Math.ceil((end - Date.now()) / 1000))
      setLeft(s)
      // Read the payment once at the end: the server expires it on that read
      if (s === 0 && !ended) {
        ended = true
        onEndRef.current()
      }
    }
    tick()
    const timer = setInterval(tick, 1000)
    return () => clearInterval(timer)
  }, [end])
  return left
}

function usePhone(): boolean {
  const [phone, setPhone] = useState(false)
  useEffect(() => {
    const ua = navigator.userAgent
    setPhone(/Android|iPhone|iPad|iPod/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1))
  }, [])
  return phone
}

function usePrefersDark(enabled: boolean): boolean {
  const [dark, setDark] = useState(false)
  useEffect(() => {
    if (!enabled || typeof matchMedia === "undefined") return
    const query = matchMedia("(prefers-color-scheme: dark)")
    setDark(query.matches)
    const on = (e: MediaQueryListEvent) => setDark(e.matches)
    query.addEventListener("change", on)
    return () => query.removeEventListener("change", on)
  }, [enabled])
  return dark
}

function CopyButton({ value, label, copied }: { value: string; label: string; copied: string }) {
  const [done, setDone] = useState(false)
  useEffect(() => {
    if (!done) return
    const t = setTimeout(() => setDone(false), 1500)
    return () => clearTimeout(t)
  }, [done])
  return (
    <button
      type="button"
      className="ps-btn ps-secondary"
      onClick={() => {
        navigator.clipboard?.writeText(value).then(() => setDone(true), () => setDone(false))
      }}
    >
      {done ? copied : label}
    </button>
  )
}

function Qr({ text, label }: { text: string; label: string }) {
  const modules = useMemo(() => qrMatrix(text), [text])
  if (!modules) return null
  const size = modules.length
  return (
    <svg viewBox={`-2 -2 ${size + 4} ${size + 4}`} role="img" aria-label={label} shapeRendering="crispEdges">
      <path d={qrPath(modules)} fill="#000" />
    </svg>
  )
}

function Field(props: {
  label: string
  optional?: string
  help?: string
  error?: string
  children: (ids: { id: string; describedBy: string | undefined }) => ReactNode
}) {
  const id = useId()
  const helpId = props.help ? `${id}-help` : undefined
  const errorId = props.error ? `${id}-error` : undefined
  const describedBy = [helpId, errorId].filter(Boolean).join(" ") || undefined
  return (
    <div className="ps-field">
      <label htmlFor={id}>
        {props.label} {props.optional && <small>({props.optional})</small>}
      </label>
      {props.children({ id, describedBy })}
      {props.help && (
        <p id={helpId} className="ps-help">
          {props.help}
        </p>
      )}
      {props.error && (
        <p id={errorId} className="ps-error">
          {props.error}
        </p>
      )}
    </div>
  )
}

export function PaystraterCheckout(props: PaystraterCheckoutProps) {
  const own = usePaystraterPayment(props.paymentId, { ...props, disabled: Boolean(props.checkout) })
  const c = props.checkout ?? own
  const t = useMemo(() => stringsFor(props.locale, props.strings), [props.locale, props.strings])
  const prefersDark = usePrefersDark(props.appearance?.theme === "auto")
  const theme = useMemo(() => resolveTheme(props.appearance, prefersDark), [props.appearance, prefersDark])
  const testMode = c.mode === "test"

  // Accessibility is not themeable away: colours under WCAG AA are named in test mode
  useEffect(() => {
    if (!testMode) return
    for (const warning of contrastWarnings(theme)) console.warn(`[Paystrater] ${warning}`)
  }, [testMode, theme])

  // Warn before closing the tab while a deposit is expected
  const expectingDeposit = props.warnOnLeave !== false && c.stage === "transfer_to_pay" && Boolean(c.deposit) && c.status === "requires_action"
  useEffect(() => {
    if (!expectingDeposit) return
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ""
    }
    window.addEventListener("beforeunload", warn)
    return () => window.removeEventListener("beforeunload", warn)
  }, [expectingDeposit])

  // Move focus to the new step's heading after the payer acts, never on first load
  const headingRef = useRef<HTMLHeadingElement>(null)
  const firstStage = useRef(true)
  useEffect(() => {
    if (firstStage.current) {
      if (c.stage !== "loading") firstStage.current = false
      return
    }
    headingRef.current?.focus()
  }, [c.stage])

  const p = c.payment
  const merchant = p?.merchantName || "the shop"
  const origin = typeof location !== "undefined" ? location.origin : undefined
  const errorText = (e?: PaystraterError) => (e ? errorForPayer(e, c.mode, origin) : undefined)

  return (
    <section
      className={props.className ? `ps-checkout ${props.className}` : "ps-checkout"}
      style={toCssVariables(theme) as React.CSSProperties}
      aria-label={p ? fill(t.payTo, { merchant }) : t.loading}
      aria-busy={c.stage === "loading" && !c.error}
    >
      <style nonce={props.nonce}>{CSS}</style>
      {testMode && <div className="ps-ribbon" title={t.testModeHint}>{t.testMode}</div>}
      <p className="ps-sr" role="status" aria-live="polite">
        {liveText(c, t)}
      </p>
      {p ? <Header payment={p} action={props.headerAction} t={t} /> : c.stage === "loading" && !c.error ? <Skeleton /> : null}
      <Body c={c} t={t} headingRef={headingRef} errorText={errorText} merchant={merchant} onStartAgain={props.onStartAgain} />
      {c.stage === "final" && props.endFooter}
    </section>
  )
}

function liveText(c: PaystraterPayment, t: Strings): string {
  switch (c.stage) {
    case "processing":
      return t.statusProcessing
    case "final":
      return c.status === "succeeded" ? t.statusSucceeded : c.underpaid ? t.statusUnderpaid : c.late ? t.statusLate : c.status === "expired" ? t.statusExpired : c.status === "cancelled" ? t.statusCancelled : t.statusFailed
    case "transfer_to_pay":
      return c.deposit ? t.waitingForDeposit : ""
    case "updating":
      return t.statusUnknown
    default:
      return ""
  }
}

function Skeleton() {
  return (
    <div className="ps-stack" aria-hidden="true">
      <div className="ps-skeleton" style={{ width: "40%" }} />
      <div className="ps-skeleton" style={{ width: "70%", height: 28 }} />
      <div className="ps-skeleton" style={{ width: "100%", height: 56 }} />
      <div className="ps-skeleton" style={{ width: "100%", height: 56 }} />
    </div>
  )
}

function Header({ payment, action, t }: { payment: CheckoutPayment; action?: ReactNode; t: Strings }) {
  const [logoFailed, setLogoFailed] = useState(false)
  const name = payment.merchantName || ""
  return (
    <div className="ps-stack" style={{ gap: 4, marginBottom: 20 }}>
      <div className="ps-head" style={{ marginBottom: 8 }}>
        {payment.merchantLogoUrl && !logoFailed ? (
          <img className="ps-logo" src={payment.merchantLogoUrl} alt="" referrerPolicy="no-referrer" onError={() => setLogoFailed(true)} />
        ) : (
          <span className="ps-logo" aria-hidden="true">
            {initials(name) || "₱"}
          </span>
        )}
        <div className="ps-merchant">
          <div className="ps-merchant-name">{name}</div>
          {payment.description && <div className="ps-desc">{payment.description}</div>}
        </div>
        {action}
      </div>
      <span className="ps-label">{t.amountDue}</span>
      <div className="ps-amount">
        {formatAmount(payment.amount)}
        <span className="ps-token">
          {payment.tokenTicker}
          {payment.chainName ? ` · ${payment.chainName}` : ""}
        </span>
      </div>
    </div>
  )
}

interface BodyProps {
  c: PaystraterPayment
  t: Strings
  headingRef: React.RefObject<HTMLHeadingElement | null>
  errorText: (e?: PaystraterError) => string | undefined
  merchant: string
  onStartAgain?: () => void
}

function Body({ c, t, headingRef, errorText, merchant, onStartAgain }: BodyProps) {
  const title = (text: string) => (
    <h2 ref={headingRef} tabIndex={-1} className="ps-title">
      {text}
    </h2>
  )
  const actionError = c.error && <div className="ps-alert" role="alert">{errorText(c.error)}</div>
  const back = c.methods.length > 1 && !c.payment?.method && (
    <button type="button" className="ps-link" onClick={c.back}>
      {t.back}
    </button>
  )

  const problem = (
    <div className="ps-stack">
      {title(t.errorTitle)}
      <div className="ps-alert" role="alert">{errorText(c.error)}</div>
      {c.error && (c.error.kind === "network" || c.error.kind === "timeout" || c.error.status >= 500) && (
        <button type="button" className="ps-btn ps-secondary" onClick={c.refresh}>
          {t.tryAgain}
        </button>
      )}
    </div>
  )

  switch (c.stage) {
    case "loading":
      // The first read failed: say so, and keep trying behind the message
      return c.error ? problem : <p className="ps-sr">{t.loading}</p>
    case "unavailable":
      return problem
    case "methods":
      return (
        <div className="ps-stack">
          {title(t.chooseMethod)}
          <ul className="ps-methods">
            {c.methods.map((m) => (
              <li key={m}>
                <button type="button" className="ps-method" onClick={() => c.choose(m)}>
                  <strong>{methodTitle(m, t)}</strong>
                  <span>{methodHint(m, t, c.chains.map((x) => x.chainName).join(", "))}</span>
                </button>
              </li>
            ))}
          </ul>
          {actionError}
        </div>
      )
    case "pay_with_paystrater":
      return <PayWithPaystrater c={c} t={t} title={title} actionError={actionError} back={back} />
    case "transfer_to_pay":
      return c.deposit ? (
        <DepositView c={c} deposit={c.deposit} t={t} title={title} actionError={actionError} />
      ) : (
        <TransferForm c={c} t={t} title={title} actionError={actionError} back={back} />
      )
    case "agentic":
      return <Agent c={c} t={t} title={title} actionError={actionError} back={back} />
    case "processing":
      return (
        <div className="ps-result">
          <div className="ps-spinner" aria-hidden="true" />
          {title(t.statusProcessing)}
          <p className="ps-muted">{t.statusProcessingHint}</p>
        </div>
      )
    case "updating":
      return (
        <div className="ps-result">
          <div className="ps-spinner" aria-hidden="true" />
          {title(t.statusUnknown)}
        </div>
      )
    case "final":
      return <Result c={c} t={t} title={title} merchant={merchant} onStartAgain={onStartAgain} />
  }
}

function methodTitle(m: PaymentMethod, t: Strings) {
  return m === "pay_with_paystrater" ? t.methodPayWithPaystrater : m === "transfer_to_pay" ? t.methodTransferToPay : t.methodAgentic
}

function methodHint(m: PaymentMethod, t: Strings, chains: string) {
  return m === "pay_with_paystrater" ? t.methodPayWithPaystraterHint : m === "transfer_to_pay" ? fill(t.methodTransferToPayHint, { chains }) : t.methodAgenticHint
}

interface StepProps {
  c: PaystraterPayment
  t: Strings
  title: (text: string) => ReactNode
  actionError: ReactNode
  back?: ReactNode
}

function PayWithPaystrater({ c, t, title, actionError, back }: StepProps) {
  const [payer, setPayer] = useState("")
  const [problem, setProblem] = useState<FieldProblem>()
  const phone = usePhone()
  const left = useCountdown(c.payment?.payer ? c.payment.expiresAt : undefined, c.refresh)
  const sent = c.payment?.payer

  if (sent) {
    return (
      <div className="ps-stack">
        {title(t.approveInApp)}
        {sent.name && <p className="ps-note">{fill(t.sentTo, { name: sent.name })}</p>}
        <p className="ps-muted">{t.approveInAppHint}</p>
        {phone && c.payment && (
          <a className="ps-btn ps-primary" href={APP_LINK + c.payment.id}>
            {t.openApp}
          </a>
        )}
        {left !== undefined && <p className="ps-muted">{left > 0 ? fill(t.expiresIn, { time: formatDuration(left) }) : t.expired}</p>}
        <p className="ps-muted">{t.wrongAccount}</p>
        {actionError}
      </div>
    )
  }
  return (
    <form
      className="ps-stack"
      noValidate
      onSubmit={async (e) => {
        e.preventDefault()
        const res = await c.payWithPaystrater(payer)
        setProblem(!res.ok ? res.field : undefined)
      }}
    >
      {title(t.methodPayWithPaystrater)}
      <Field label={t.payerLabel} help={t.payerHelp} error={problem === "payerRequired" ? t.payerRequired : undefined}>
        {({ id, describedBy }) => (
          <input
            id={id}
            className="ps-input"
            value={payer}
            maxLength={100}
            autoComplete="username"
            aria-describedby={describedBy}
            aria-invalid={problem === "payerRequired"}
            onChange={(e) => setPayer(e.target.value)}
          />
        )}
      </Field>
      {actionError}
      <button type="submit" className="ps-btn ps-primary" disabled={c.busy}>
        {t.sendRequest}
      </button>
      {back}
    </form>
  )
}

function TransferForm({ c, t, title, actionError, back }: StepProps) {
  const [chainId, setChainId] = useState<number | undefined>(c.chains.length === 1 ? c.chains[0]!.chainId : undefined)
  const [email, setEmail] = useState("")
  const [name, setName] = useState("")
  const [refund, setRefund] = useState("")
  const [problem, setProblem] = useState<FieldProblem>()
  const chosen = chainId ?? (c.chains.length === 1 ? c.chains[0]!.chainId : undefined)
  const groupId = useId()

  return (
    <form
      className="ps-stack"
      noValidate
      onSubmit={async (e) => {
        e.preventDefault()
        if (chosen === undefined) return setProblem("chain")
        const res = await c.startDeposit(chosen, { email, name, refundAddress: refund })
        setProblem(!res.ok ? res.field : undefined)
      }}
    >
      {title(t.methodTransferToPay)}
      {c.chains.length > 1 && (
        <div className="ps-field">
          <span id={groupId} className="ps-label">
            {t.chooseChain}
          </span>
          <div className="ps-chains" role="radiogroup" aria-labelledby={groupId}>
            {c.chains.map((ch) => (
              <button
                key={ch.chainId}
                type="button"
                role="radio"
                aria-checked={chosen === ch.chainId}
                className="ps-chain"
                onClick={() => setChainId(ch.chainId)}
              >
                {ch.chainName}
              </button>
            ))}
          </div>
          {problem === "chain" && <p className="ps-error">{t.chooseChain}</p>}
        </div>
      )}
      <Field label={t.emailLabel} optional={t.optional} help={t.emailHelp} error={problem === "email" ? t.emailFormat : undefined}>
        {({ id, describedBy }) => (
          <input id={id} className="ps-input" type="email" inputMode="email" autoComplete="email" maxLength={120} value={email} aria-describedby={describedBy} aria-invalid={problem === "email"} onChange={(e) => setEmail(e.target.value)} />
        )}
      </Field>
      <Field label={t.nameLabel} optional={t.optional}>
        {({ id }) => <input id={id} className="ps-input" autoComplete="name" maxLength={120} value={name} onChange={(e) => setName(e.target.value)} />}
      </Field>
      <Field
        label={t.refundAddressLabel}
        optional={t.optional}
        help={t.refundAddressHelp}
        error={problem === "refundAddressFormat" ? t.refundAddressFormat : problem === "refundAddressChecksum" ? t.refundAddressChecksum : undefined}
      >
        {({ id, describedBy }) => (
          <input
            id={id}
            className="ps-input"
            spellCheck={false}
            autoCapitalize="off"
            autoComplete="off"
            maxLength={64}
            placeholder="0x…"
            value={refund}
            aria-describedby={describedBy}
            aria-invalid={problem === "refundAddressFormat" || problem === "refundAddressChecksum"}
            onChange={(e) => setRefund(e.target.value)}
          />
        )}
      </Field>
      {actionError}
      <button type="submit" className="ps-btn ps-primary" disabled={c.busy}>
        {t.getAddress}
      </button>
      {back}
    </form>
  )
}

function DepositView({ c, deposit, t, title, actionError }: Omit<StepProps, "back"> & { deposit: Deposit }) {
  const phone = usePhone()
  const left = useCountdown(deposit.expiresAt, c.refresh)
  const chain = deposit.chainName ?? ""
  const link = deposit.chainId
    ? walletLink({ tokenAddress: deposit.tokenAddress, tokenDecimals: deposit.tokenDecimals, chainId: deposit.chainId, depositAddress: deposit.depositAddress, amount: deposit.amount })
    : undefined

  return (
    <div className="ps-stack">
      {title(fill(t.sendExactly, { amount: formatAmount(deposit.amount), token: deposit.tokenTicker, chain }))}
      {deposit.fee && isPositiveAmount(deposit.fee) && <p className="ps-muted">{fill(t.fee, { fee: formatAmount(deposit.fee), token: deposit.tokenTicker })}</p>}
      <div className="ps-well ps-stack">
        <div className="ps-qr">
          <Qr text={deposit.depositAddress} label={t.qrLabel} />
        </div>
        <span className="ps-label">{t.depositAddress}</span>
        <span className="ps-mono">{deposit.depositAddress}</span>
        <div className="ps-row">
          <CopyButton value={deposit.depositAddress} label={t.copyAddress} copied={t.copied} />
          <CopyButton value={deposit.amount} label={t.copyAmount} copied={t.copied} />
        </div>
      </div>
      {phone && link && (
        <a className="ps-btn ps-primary" href={link}>
          {t.openInWallet}
        </a>
      )}
      <p className="ps-note">{fill(t.depositNotice, { token: deposit.tokenTicker, chain })}</p>
      {isPositiveAmount(deposit.receivedAmount) && (
        <p className="ps-muted">{fill(t.received, { amount: formatAmount(deposit.receivedAmount!), token: deposit.tokenTicker })}</p>
      )}
      <div className="ps-row">
        <span className="ps-row" style={{ justifyContent: "flex-start" }}>
          <span className="ps-spinner" aria-hidden="true" />
          <span className="ps-muted">{t.waitingForDeposit}</span>
        </span>
        {left !== undefined && <span className="ps-muted">{left > 0 ? fill(t.expiresIn, { time: formatDuration(left) }) : t.expired}</span>}
      </div>
      <details className="ps-details">
        <summary>{t.paymentDetails}</summary>
        <dl>
          {deposit.tokenAddress && (
            <>
              <dt>{t.tokenContract}</dt>
              <dd className="ps-mono">{deposit.tokenAddress}</dd>
            </>
          )}
          <dt>{t.network}</dt>
          <dd>{chain}</dd>
          {deposit.chainId !== undefined && (
            <>
              <dt>{t.chainId}</dt>
              <dd>{deposit.chainId}</dd>
            </>
          )}
        </dl>
        {deposit.tokenAddress && <CopyButton value={deposit.tokenAddress} label={t.copyContract} copied={t.copied} />}
      </details>
      {actionError}
    </div>
  )
}

function Agent({ c, t, title, actionError, back }: StepProps) {
  const prompt = c.payment?.agentPrompt
  if (prompt) {
    return (
      <div className="ps-stack">
        {title(t.agentTitle)}
        <p className="ps-muted">{t.agentHint}</p>
        <pre className="ps-well ps-mono" style={{ whiteSpace: "pre-wrap", margin: 0 }}>
          {prompt}
        </pre>
        <CopyButton value={prompt} label={t.copyPrompt} copied={t.copied} />
        {actionError}
      </div>
    )
  }
  return (
    <div className="ps-stack">
      {title(t.agentTitle)}
      <p className="ps-muted">{t.agentHint}</p>
      {actionError}
      <button type="button" className="ps-btn ps-primary" disabled={c.busy} onClick={() => void c.startAgentic()}>
        {t.continue}
      </button>
      {back}
    </div>
  )
}

function Result({ c, t, title, merchant, onStartAgain }: Omit<StepProps, "actionError" | "back"> & { merchant: string; onStartAgain?: () => void }) {
  const p = c.payment!
  const excess = p.transferToPay?.excessRefunded
  let mark = "!"
  let tone = "ps-neutral"
  let heading: string = t.statusFailed
  let hint: string | undefined = p.failureReason
  if (p.status === "succeeded") {
    mark = "✓"
    tone = "ps-ok"
    heading = t.statusSucceeded
    hint = isPositiveAmount(excess) ? fill(t.excessRefunded, { amount: formatAmount(excess!), token: p.tokenTicker }) : fill(t.statusSucceededHint, { merchant })
  } else if (c.underpaid) {
    tone = "ps-bad"
    heading = t.statusUnderpaid
    hint = t.statusUnderpaidHint
  } else if (c.late) {
    heading = t.statusLate
    hint = t.statusLateHint
  } else if (p.status === "expired") {
    heading = t.statusExpired
    hint = fill(t.statusExpiredHint, { merchant })
  } else if (p.status === "cancelled") {
    heading = t.statusCancelled
    hint = fill(t.statusCancelledHint, { merchant })
  } else if (p.status === "refunded") {
    heading = t.statusRefunded
    hint = undefined
  } else {
    tone = "ps-bad"
  }
  return (
    <div className="ps-result">
      <span className={`ps-badge ${tone}`} aria-hidden="true">
        {mark}
      </span>
      {title(heading)}
      {hint && <p className="ps-muted">{hint}</p>}
      {p.status === "expired" && !c.underpaid && !c.late && onStartAgain && (
        <button type="button" className="ps-btn ps-secondary" onClick={onStartAgain}>
          {t.startAgain}
        </button>
      )}
    </div>
  )
}
