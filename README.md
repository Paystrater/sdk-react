# @paystrater/react

[![npm](https://img.shields.io/npm/v/@paystrater/react)](https://www.npmjs.com/package/@paystrater/react)
[![license](https://img.shields.io/npm/l/@paystrater/react)](https://github.com/Paystrater/sdk-react/blob/main/LICENSE)

The Paystrater checkout for React. Drop one component into your page, or build your own with one hook. Accept stablecoin and crypto payments, including USDC, USDT, ETH, BNB and SOL. Your payment settings decide which tokens and networks a payment accepts. Your server creates the payment with its secret key; the checkout only needs your publishable key.

## Features

- **Pay with Paystrater:** the customer enters their Paystrater ID and approves in the Paystrater app.
- **Transfer to Pay:** the customer sends from any wallet, with a QR code, copy buttons and the exact amount.
- **AI agent payments:** the customer gets a prompt to hand to their own AI agent, which pays within the limits they set.
- **Hosted page:** the same checkout on app.paystrater.com, for a link instead of an embed.
- **Light and dark themes** that follow the device, with your own colours and fonts.
- **Accessible:** labelled controls, announced status changes, keyboard and focus support, reduced motion.
- **Optional encrypted calls** to your encryption key, on top of TLS.
- **No dependencies** beyond React; works with Next.js server rendering and strict Content Security Policies.

## Requirements

- React and React DOM 18 or later (peer dependencies).
- A Paystrater business account, with a secret key on your server and a publishable key for the browser, from the [dashboard](https://dashboard.paystrater.com).
- Your site's origin on the publishable key's sites in the dashboard.

## Install

```bash
npm install @paystrater/react
```

## Quick start

1. On your server, create the payment with your **secret key** and pass its `rcv_` ID to the page. See [Create the payment on your server](https://docs.paystrater.com/docs/sdks/react#create-the-payment-on-your-server) for examples in every server language.

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

3. **Fulfil the order on the `incoming_payment.succeeded` webhook**, or after your server reads `GET /v1/transactions/{id}`. `onSuccess` is for the payer's experience only: anything in a browser can be faked, so never fulfil on it.

## Payment methods

The payment's own settings decide which methods the customer sees.

- **Pay with Paystrater:** the customer types their Paystrater ID or username and approves the request in the Paystrater app with their PIN. The checkout follows the payment and shows the result.
- **Transfer to Pay:** the customer picks a network; email, name and a refund address are optional. The checkout shows the exact amount, the deposit address with a QR code and copy buttons, and a countdown. A transfer that is short or late is handled for them: they get an email with a link to get their funds back.
- **AI agent payments:** the checkout gives the customer a prompt for their AI agent. The agent pays through Paystrater within the limits the customer set, and the checkout shows the result.

Which tokens a customer can pay in comes from your payment settings in the dashboard: stablecoins (USDC, USDT, USDT0, PYUSD, EURC, USDG, cNGN) and coins (ETH, BNB, SOL, HYPE, WETH), each on the networks that carry it. Transfer to Pay is not available on Solana yet, so SOL and Solana tokens are paid with Pay with Paystrater.

## The component

| Prop | |
| --- | --- |
| `paymentId` | The `rcv_` ID your server created. The checkout never takes an amount from the page |
| `publishableKey` | `pk_live_…` or `pk_test_…`. A secret key is refused before any call |
| `chains` | Chain IDs that narrow the payment's networks for Transfer to Pay. It can only narrow |
| `appearance` | Theme and variables (see Appearance) |
| `encryption` | `{ keyId, publicKey }` from the dashboard (see Encryption) |
| `onSuccess`, `onExpired`, `onCancelled`, `onStatusChange`, `onError` | Callbacks for the payer's experience |
| `onStartAgain` | Shows "Start again" on an expired payment: create a new payment and show it |
| `locale`, `strings` | English today; replace any wording through `strings` |
| `nonce` | Your CSP nonce for the component's one `<style>` tag |
| `headerAction` | Rendered beside the merchant's name, such as a back link |
| `endFooter` | Rendered under the end screen |
| `warnOnLeave` | Ask before the tab closes while a deposit is expected (default `true`) |
| `checkout` | Drive the component from your own `usePaystraterPayment` |
| `apiBaseUrl` | Overrides the API host the key picks |
| `className` | A class for the checkout's root |

The checkout reads the payment as soon as the page is visible. After that it reads every 4 seconds while the page is visible and focused, makes no calls while it is hidden, and reads once straight away when the customer comes back. It slows down when the rate limit runs low, waits for `Retry-After` on a 429, and stops at a final status.

## Your own UI

```tsx
import { usePaystraterPayment } from "@paystrater/react"

const { stage, payment, methods, chains, deposit, error, choose, back, startDeposit, payWithPaystrater, startAgentic, refresh } =
  usePaystraterPayment(paymentId, { publishableKey: "pk_live_…" })

// Transfer to Pay: email, name and refund address are all optional
await startDeposit(8453, { email: "ada@example.com" })
```

`stage` is `loading`, `methods`, `pay_with_paystrater`, `transfer_to_pay`, `agentic`, `processing`, `final`, `updating` or `unavailable`. The polling rules are the same as the component's.

## Appearance

```tsx
<PaystraterCheckout
  appearance={{
    theme: "auto", // the default: follows the device; or "light" | "dark"
    variables: { colorPrimary: "#0F766E" },
    variablesDark: { colorPrimary: "#5EEAD4" }
  }}
  …
/>
```

- `variables` apply in both themes; `variablesDark` apply on top of them in dark mode only.
- A value equal to a Paystrater default, such as `colorPrimary: "#285BB6"`, follows the theme, so dark mode keeps Paystrater's dark buttons.
- With `colorPrimary` alone, the hover colour, the button text and the brand text are worked out from it so they stay readable (WCAG AA).
- If your site switches themes with a class (for example next-themes), pass your resolved theme: `theme: resolvedTheme === "dark" ? "dark" : "light"`.

| Variable | Light | Dark |
| --- | --- | --- |
| `colorBackground` (the checkout card) | `#FFFFFF` | `#24272F` |
| `colorSurface` (wells: the address, the QR) | `#F5F7FA` | `#1E2128` |
| `colorSurfaceHover` (hover fills) | `#E4E9EF` | `#2C303A` |
| `colorText`, `colorTextBody`, `colorTextMuted` | `#1B1B1F`, `#3A3F4A`, `#636975` | `#E3E2E6`, `#D4D7E0`, `#A4A9B8` |
| `colorTextSubtle` (placeholders) | `#8E939D` | `#707584` |
| `colorBorder` (the card line), `colorBorderStrong` | `#D4DAE6`, `#C5C6D0` | `rgba(162, 174, 209, 0.18)`, `#44464F` |
| `colorPrimary`, `colorPrimaryHover` (buttons) | `#285BB6`, `#1D4693` | `#A2AED1`, `#B8C3E0` |
| `colorOnPrimary` (text on buttons) | `#FFFFFF` | `#131519` |
| `colorPrimaryText` (links, focus, the amount) | `#285BB6` | `#A2AED1` |
| `colorPrimarySoft` (tinted fills) | `#E2E9F5` | `#353A48` |
| `colorSuccess`, `colorWarning`, `colorDanger` | `#047857`, `#B45309`, `#BA1A1A` | `#4ADEA0`, `#FBBF24`, `#FFB4AB` |
| `colorSuccessSoft`, `colorDangerSoft` | 12% and 10% tints | 12% tints |
| `fontFamily`, `fontFamilyMono` | Sora, then system fonts; Geist Mono, then system monospace | Same |
| `borderRadius` (inputs), `borderRadiusSurface` (tiles, wells) | `14px`, `14px` | Same |
| `borderRadiusButton` (pills), `borderRadiusCard` (the checkout) | `24px`, `18px` | Same |

Each variable is also a CSS variable on `.ps-checkout`, named with the `--ps-` prefix (`colorPrimaryText` is `--ps-color-primary-text`). The SDK never loads a font. Every class starts with `ps-` under one `.ps-checkout` root, so your CSS does not reach in and the checkout's does not leak out. Merchant and payer names are shown capitalized. Every screen ends with "Powered by Paystrater", which links to paystrater.com.

## Accessibility

Controls are labelled, steps and status changes are announced to screen readers, focus moves to each new step, and animations stop when the device asks for reduced motion. With a test key, colours under WCAG AA contrast are named in the console. The theme cannot turn these off.

## Hosted checkout

To send customers to a page instead of embedding the component, create the payment with `checkoutPage: true`. The response's `checkoutUrl` opens the same checkout on app.paystrater.com. Optional `successUrl` and `cancelUrl` send the customer back to you afterwards; their origin must be on one of your publishable keys' sites. This needs a publishable key with the `receive-crypto:create` scope, and no code in your page.

## Encryption (optional)

If you turned on an encryption key in the dashboard (Developers → Encryption), pass its key ID and public key. Both are public values:

```tsx
<PaystraterCheckout encryption={{ keyId: "AbCdEf0123456789", publicKey: "04…" }} … />
```

Every call is then encrypted to your key (secp256k1, HKDF-SHA256, AES-256-GCM, a new one-time key per call) and every response decrypted. The code for it is a separate chunk that only loads when you pass `encryption`. Pass both values or neither: half a setup, or a malformed key, stops the checkout instead of falling back to plain JSON.

## Test mode

Test keys (`pk_test_…`) use the sandbox at `https://staging-api.paystrater.com` and show a Test mode chip. To pay a test payment:

- **Pay with Paystrater:** approve it in the [sandbox app](https://sandbox.paystrater.com) with a sandbox account.
- **Transfer to Pay:** send test USDC from any wallet on a test network. [Circle's faucet](https://faucet.circle.com) gives it out free.

See the [sandbox guide](https://docs.paystrater.com/docs/sandbox).

## Errors and troubleshooting

Errors come back as a `PaystraterError` (`kind`, `status`, `message`) through `onError` and the hook's `error`. `kind` is `api`, `network`, `timeout`, `setup`, `encryption` or `cancelled`; the message is the API's own words.

- **"This website is not on the API Key's domain allowlist." (403):** add your site's origin to the publishable key's sites in the dashboard. In test mode the checkout names the origin to add.
- **"A publishable key starts with pk_live_ or pk_test_":** pass the publishable key, not the secret key or a key with spaces.
- **The payment does not load:** check that `paymentId` is the `rcv_` ID your server created with the same mode (live or test) as the key.

More in the [errors reference](https://docs.paystrater.com/docs/errors).

## Security

- The publishable key is public: it can read a payment and start a deposit, never move money. Restrict it to your sites in the dashboard.
- The secret key stays on your server. The checkout refuses a secret key before making any call.
- Fulfil orders on the webhook or a server-side read, never on a browser callback.

## Content Security Policy

The component works under a strict policy: no `eval`, no inline scripts, no remote scripts, no iframes.

```
connect-src https://api.paystrater.com https://staging-api.paystrater.com
img-src https:            (the merchant logo; or the logo's host)
style-src 'nonce-…'       (pass the same nonce as the `nonce` prop; the theme also uses inline style attributes)
```

## Server rendering

On the server the component renders a placeholder and calls nothing; work starts in the browser. It is marked `"use client"` for React Server Components.

## Size

Under 20 KB gzipped for the whole checkout, with the encryption code (about 4 KB) in its own chunk. Checked in CI.

## Links

- Docs: https://docs.paystrater.com/docs/sdks/react
- Dashboard: https://dashboard.paystrater.com
- Changelog: [CHANGELOG.md](https://github.com/Paystrater/sdk-react/blob/main/CHANGELOG.md)

## License

MIT. See [LICENSE](https://github.com/Paystrater/sdk-react/blob/main/LICENSE).
