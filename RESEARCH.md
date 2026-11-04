# Design decisions: what we took from enterprise-grade payment SDKs, and what we do differently

Reviewed in November 2026 against the published documentation and repositories of enterprise-grade payment SDKs for the web, React Native and Flutter.

## What enterprise-grade payment SDKs do

**Security.** The browser only ever holds a publishable key. Card fields are cross-origin iframes served from the provider's own domain, so card data never touches the merchant's page, and the provider's script must be loaded from that domain rather than bundled or self-hosted (a PCI requirement). The Content Security Policy a merchant needs is published.

**Size and dependencies.** The React package has few runtime dependencies and peers on `react` and `react-dom`. A small loader inserts the script tag, and nothing loads until it is called. On the server the loader does nothing.

**Theming.** A theme, a set of variables (colours, font, spacing, corner radius, plus many finer ones) and often per-part CSS rules.

**Errors.** One error object with a type, a code and a `message` written for people, shown as it is.

**Versioning and release.** Package majors are pinned to named releases of the hosted script, yet the script itself updates at runtime: the package version mostly changes the loader and the types. Releases go out from CI. React Native SDKs wrap the native iOS and Android SDKs, need a recent React Native, and ship an Expo config plugin.

## What we copy

- **Publishable keys only.** We refuse an `sk_` key before any call and say why. Live or test comes from the key prefix, with a visible Test mode ribbon.
- **The server creates the payment.** The component takes a `rcv_` ID and never an amount.
- **A small theme API.** `appearance={{ theme, variables }}` with the familiar variable names (`colorPrimary`, `colorBackground`, `colorText`, `colorDanger`, `fontFamily`, `borderRadius`), defaulting to the Paystrater design from the dashboard's `globals.css`.
- **Peer dependencies, not bundled copies,** of `react` and `react-dom`.
- **Server rendering renders a placeholder** and starts work only in the browser.
- **One error shape** whose `message` is the server's own words, shown unchanged.
- **Fulfilment on webhooks.** Merchants should not ship on the client's callback, and every README and example says so.
- **A published CSP list** in the README, so merchants with a strict policy know exactly what to allow.
- **Releases from CI** with provenance.

## What we deliberately do differently, and why

| Enterprise-grade norm | Paystrater | Why |
| --- | --- | --- |
| Loads a hosted script; card fields live in iframes | Ships as one npm package with nothing loaded from elsewhere, and no iframes | Our checkout never collects a card number, a password or a seed phrase: the payer approves in the Paystrater app, sends from their own wallet, or gives a prompt to their agent. With no secret entered on the page there is nothing for an iframe to isolate, and a remote script would be a supply-chain risk and a CSP exception for every merchant. Merchants allow one host, `connect-src https://api.paystrater.com` |
| A few runtime dependencies and a peer on the loader | `dependencies` is empty; the one library we need, `@noble/secp256k1`, is bundled into our own output and loaded only when encryption is passed | The merchant installs one package and cannot get a different copy of our crypto code |
| Rich theming (CSS rules per part, dozens of variables) | Themes plus 17 variables, no rules | Rules would turn our class names into a public API we could never change. A short list covers brand matching; contrast under WCAG AA is checked and named in test mode, and focus rings, live regions and 44-point targets cannot be themed away |
| Named themes chosen by the merchant | `light`, `dark`, `auto` | `auto` follows `prefers-color-scheme` without the merchant writing code |
| The hosted script updates itself at runtime, whatever the package version | The code is exactly the version installed | Merchants review what they ship; a change reaches them through a semver release and a changelog, never silently. The checkout's routes are versioned by the API and the spec, which the SDK's types are generated from |
| React Native SDKs wrap native SDKs and need native modules and an Expo config plugin | Plain JavaScript on `fetch`, `Linking` and `Share`; no native modules; works in Expo with no plugin | Our flows need no native capability: Pay with Paystrater opens our own app by link, and Transfer to Pay needs copy and share. No native code means no build step for merchants and none of the native-crypto bugs common in React Native |
| Flutter support through wrappers around the native SDKs | Our own `paystrater_flutter`, Dart only, with a few lines of method channel to open the app | Same reason, and it keeps us out of `url_launcher` and `package:http` |
| Card data protected by iframes and PCI scope | Optional app-layer encryption of the checkout calls to the merchant's own key (React and hosted page only) | Some merchants want the request and the answer opaque beyond TLS; mobile SDKs skip it in v1 because Hermes and Dart lack the primitives without native code |
| Polling and retries are internal to the hosted script | Polling rules are explicit and tested: the first read once the page is visible, then every 4 s only while visible and focused, one read on return, every 10 s when `RateLimit-Remaining` is under 50, `Retry-After` respected, stop at a final status | Checkout calls share a 120-a-minute limit per key and payer IP |
