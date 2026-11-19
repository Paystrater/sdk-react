# Changelog

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
