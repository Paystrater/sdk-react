# Changelog

## 1.0.3

### Patch Changes

- 79b7c57: Pay with Paystrater speaks of approving in the app rather than a PIN, since the app also approves with fingerprint and Face ID: "We'll send the request to your app. Approve it there." and "Open the request, check the amount and approve it. This page updates by itself."
  
  README: the Content Security Policy section now lists exactly what the checkout needs and why, with a working policy and a Next.js example, including `style-src-attr 'unsafe-inline'` when the checkout is server-rendered under a nonce-only `style-src`.

## 1.0.2

### Patch Changes

- 90b688d: The AI agent step has a "How to connect your AI agent" section, closed until opened: four short steps, the MCP server URL with a Copy button (the sandbox server on a test key), a note on agent wallets and a link to the full guide. New strings agentConnect*, agentWallet* and agentGuide; new core exports AGENT_MCP_URL, AGENT_GUIDE_URL and agentMcpUrl. The size budget is now 22 KB gzipped.

## 1.0.1

### Patch Changes

- 42bf7cb: The AI agent step says what Continue does before a prompt exists ("Create a one-time prompt for your agent. It will pay within your limits."), and only says "Give this prompt to your agent" once there is one. Choosing no network on Transfer to Pay now says "Select a network to pay on." instead of "Network". New strings: agentStartHint, chooseChainRequired, totalAmount.

## 1.0.0

### Major Changes

- 1e87e53: First stable release.
  
  - The checkout follows the Paystrater design (the sandbox app's): method tiles with icons, pill buttons, 48px fields, the amount in the brand colour, "← <method>" under each step and "Powered by Paystrater" under every screen
  - The default theme is "auto": it follows the device's light or dark setting. In dark mode Paystrater's blue becomes the brand's dark buttons; a merchant's own colorPrimary gets a worked-out hover, button text and readable brand text (WCAG AA)
  - Names are capitalized; amounts show at least two decimals
  - A publishable key is checked by its pk_live_ or pk_test_ prefix only; a key with a space or line break is refused with a clear message
  - Copy names no "shop": messages speak of the business being paid
  - New theme variables: colorSurfaceHover, colorTextSubtle, colorBorderStrong, colorSuccessSoft, colorDangerSoft, borderRadiusButton, borderRadiusCard; appearance.variablesDark for dark-only overrides

Versions and notes are written by Changesets (see PUBLISHING.md).
