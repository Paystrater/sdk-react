# @paystrater/react

The Paystrater checkout for React: one component and one hook. Customers pay with **Pay with Paystrater** (they approve in the Paystrater app), **Transfer to Pay** (they send from any wallet) or **an AI agent**.

```bash
npm install @paystrater/react
```

That is the only install. `react` and `react-dom` 18 or later are peers you already have; the package has no other dependencies.

## Quick start

1. On your server, create the payment with your **secret key** and pass its `rcv_` ID to the page:

```js
// Server only: the secret key never reaches a browser
const res = await fetch("https://api.paystrater.com/v1/receive-payments", {
  method: "POST",
  headers: {
    "x-paystrater-api-key": process.env.PAYSTRATER_SECRET_KEY,
    "Content-Type": "application/json",
    "Idempotency-Key": order.id
  },
  body: JSON.stringify({ amount: "25.00", tokenTicker: "USDC", reference: order.id })
})
const { response: payment } = await res.json() // payment.id is rcv_…
```

2. In the browser, show the checkout with your **publishable key**:

```tsx
import { PaystraterCheckout } from "@paystrater/react"

export function Pay({ paymentId }: { paymentId: string }) {
  return (
    <PaystraterCheckout
      paymentId={paymentId}
      publishableKey="pk_live_…"
      onSuccess={() => router.push("/thanks")}
    />
  )
}
```

3. **Ship the order on the `incoming_payment.succeeded` webhook**, or after your server reads `GET /v1/transactions/{id}`. `onSuccess` is for the payer's experience only: anything in a browser can be faked, so never fulfil on it.

Test keys (`pk_test_…`) use the sandbox at `https://staging-api.paystrater.com` and show a Test mode ribbon. Your site's origin must be on the publishable key's site list in the dashboard; in test mode the checkout tells you if it is not.

## The component

| Prop | |
| --- | --- |
| `paymentId` | The `rcv_` ID your server created. The checkout never takes an amount from the page |
| `publishableKey` | `pk_live_…` or `pk_test_…`. A secret key is refused before any call |
| `chains` | Chain IDs that narrow the payment's chains for Transfer to Pay. It can only narrow |
| `appearance` | Theme and variables (below) |
| `encryption` | `{ keyId, publicKey }` from the dashboard (below) |
| `onSuccess`, `onExpired`, `onCancelled`, `onStatusChange`, `onError` | Callbacks for the payer's experience |
| `onStartAgain` | Shows "Start again" on an expired payment: create a new payment and show it |
| `nonce` | Your CSP nonce for the component's one `<style>` tag |
| `locale`, `strings` | English today; override any wording through `strings` |

The checkout reads the payment as soon as the page is visible, so a checkout in an iframe loads before the payer clicks into it. After that it reads every 4 seconds while the page is visible and focused, and makes no calls at all while it is hidden or another window has focus; it reads once straight away when the payer comes back. It slows to every 10 seconds when the rate limit runs low, waits for `Retry-After` on a 429, and stops at a final status. In an iframe, "focused" means the frame has focus.

## Your own UI

```tsx
import { usePaystraterPayment } from "@paystrater/react"

const { stage, payment, methods, chains, deposit, error, choose, startDeposit, payWithPaystrater, startAgentic } =
  usePaystraterPayment(paymentId, { publishableKey: "pk_live_…" })

// Transfer to Pay: email, name and refund address are all optional
await startDeposit(8453, { email: "ada@example.com" })
```

Same polling rules. `stage` is `loading`, `methods`, `pay_with_paystrater`, `transfer_to_pay`, `agentic`, `processing`, `final`, `updating` or `unavailable`.

## Appearance

```tsx
<PaystraterCheckout
  appearance={{
    theme: "auto", // "light" | "dark" | "auto" (follows prefers-color-scheme)
    variables: { colorPrimary: "#285BB6", borderRadius: "8px", fontFamily: "inherit" }
  }}
/>
```

Variables: `colorBackground`, `colorSurface`, `colorText`, `colorTextBody`, `colorTextMuted`, `colorBorder`, `colorPrimary`, `colorPrimaryHover`, `colorOnPrimary`, `colorPrimaryText`, `colorPrimarySoft`, `colorSuccess`, `colorWarning`, `colorDanger`, `fontFamily`, `fontFamilyMono`, `borderRadius`, `borderRadiusSurface`. The defaults are the Paystrater design. The SDK names Sora and Geist Mono first and never loads a font, so without them it uses the system fonts.

Every class starts `ps-` under one `.ps-checkout` root, so your CSS does not reach in and ours does not leak out. In test mode, colours under WCAG AA contrast are named in the console. Focus rings, screen-reader announcements, 44-point touch targets and reduced motion are always on.

## Encryption (optional)

If you turned on an encryption key in the dashboard, pass its key ID and public key. Both are public values:

```tsx
<PaystraterCheckout encryption={{ keyId: "AbCdEf0123456789", publicKey: "04…" }} … />
```

Every call is then encrypted to your key (secp256k1, HKDF-SHA256, AES-256-GCM, a new one-time key per call) and every answer decrypted. The code for it is a separate chunk that only loads when you pass `encryption`. Pass both values or neither: half a setup, or a malformed key, stops the checkout instead of falling back to plain JSON. A rotated key keeps working for 24 hours.

## Content Security Policy

The component works under a strict policy: no `eval`, no inline scripts, no remote scripts, no iframes.

```
connect-src https://api.paystrater.com https://staging-api.paystrater.com
img-src https:            (the merchant logo; or the logo's host)
style-src 'nonce-…'       (pass the same nonce as the `nonce` prop; the theme also uses inline style attributes)
```

## Server rendering

On the server the component renders a placeholder and calls nothing. Work starts in the browser. It is marked `"use client"` for React Server Components.

## Size

Under 20 KB gzipped for the whole checkout, with the encryption code (about 4 KB) in its own chunk. Checked in CI.

## Support

Docs: https://docs.paystrater.com/docs/sdks/react · Errors are the API's own words: see https://docs.paystrater.com/docs/errors
