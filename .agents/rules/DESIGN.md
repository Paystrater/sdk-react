# Paystrater SDK Design Rules

## 0. Brand theme source (rule)

The brand theme follows the **Paystrater mobile app**, not the other way round. Its palette lives in the mobile repo (`PayStrater/mobile/paystrater`) in `src/utils/colors.ts` and `src/components/reusables/useSurfaces.tsx`. Internal control (`frontend/internal-control/.agents/rules/DESIGN.md`) holds the reference mapping. When the app's colours change, update the default theme in `src/core/theme.ts` (the React Native SDK copies it with `scripts/sync-core.mjs`) to match, keep the mapping below, and change every Paystrater frontend together (app, landing page, dashboard, developer docs, internal control and the React, React Native and Flutter SDKs).

| App value | Theme variable |
| :-- | :-- |
| light `plainWhite` / dark `subSurface` 36 39 47 (#24272F) | `colorBackground` (the checkout card) |
| sandbox-app `surface-sunken` #F5F7FA / #1E2128 (a well inside a card) | `colorSurface` (the address well, the QR) |
| sandbox-app `surface-muted` #E4E9EF / #2C303A | `colorSurfaceHover` (hover fills, the skeleton) |
| `onBackground` #1B1B1F / #E3E2E6 | `colorText` |
| body #3A3F4A / #D4D7E0, `onSurfaceVariant` #636975 / #A4A9B8 (dark text lifted for the web, see below) | `colorTextBody`, `colorTextMuted` |
| sandbox-app `text-subtle` #8E939D / #707584 | `colorTextSubtle` (placeholders) |
| `cardLine` #D4DAE6 / `subSurfaceLine` periwinkle at 18%, rgba(162, 174, 209, 0.18) | `colorBorder` |
| `outlineVariant` #C5C6D0 / #44464F | `colorBorderStrong` (input hover, outline buttons) |
| `primary` #285BB6 / #A2AED1, hover #1D4693 / #B8C3E0 | `colorPrimary`, `colorPrimaryHover`, `colorPrimaryText` |
| `onPrimary` #FFFFFF / #131519 | `colorOnPrimary` |
| `tint` #E2E9F5 / #353A48 | `colorPrimarySoft` |
| success #047857 / #4ADEA0, warning #B45309 / #FBBF24, `error` #BA1A1A / #FFB4AB | `colorSuccess`, `colorWarning`, `colorDanger` |
| sandbox-app `success-tint`, `error-tint` | `colorSuccessSoft`, `colorDangerSoft` |

The light surface and sub-surface pair (cool grey-blue under white cards) is the look Mike chose; do not drift back to a warm or neutral grey.

## 1. Shape, type and case (Mike, 2026-11-18)

The checkout's look follows the web sandbox app (`frontend/sandbox-app`, `src/app/globals.css` and `src/components/ui`), so the SDK reads as the same product:

- **Radii:** buttons and chain chips are full pills (`borderRadiusButton` 24px), inputs and inner surfaces 14px (`borderRadius`, `borderRadiusSurface`), the checkout card 18px (`borderRadiusCard`), notes and the QR tile 13px, chips 11px.
- **Depth:** surfaces are set apart by tone and the hairline card line, never by a shadow.
- **Controls:** the main button is 48px, 14px medium text, with a 3px focus ring at 30% of the brand colour; inputs are 48px with a brand border on focus and no ring.
- **Type:** Sora (never loaded by the SDK), Geist Mono for amounts and addresses. Body 15/22, titles 18, the amount 26.
- **Dark mode:** the default theme is `auto`, following `prefers-color-scheme`; `light` and `dark` force one. In dark mode the buttons are always the brand's dark colours (periwinkle `#A2AED1`, hover `#B8C3E0`, text `#131519`) unless the merchant sets their own colour: a variable equal to a Paystrater light default (setup code's `colorPrimary: "#285BB6"`) follows the theme, `variablesDark` overrides dark only, and a merchant `colorPrimary` alone gets a derived hover and readable text colour.
- **Brand:** every screen ends with "Powered by" and the Paystrater wordmark, linking to paystrater.com. The mark and wordmark are inline SVG (`src/react/brand.tsx`) in `currentColor`; the method tile's mark uses its own bounds as the viewBox so it sits centred.
- **Case:** names (the business, the payer) are capitalized with `text-transform: capitalize` (`.ps-merchant-name`, `.ps-name`), whatever case the data has, as sandbox-app does. A name inside a sentence sits in its own span so only the name changes. Screen-reader labels and the React Native and Flutter SDKs use `capitalizeWords` from core instead. Headings, labels and buttons keep their sentence case. Amounts, tickers, addresses, IDs, emails, URLs and codes are never transformed.

**Dark text on the web (Mike, 2026-11-11):** the SDKs, like the web surfaces, lift the app's dark text for long-form reading on large screens: `colorTextBody` 212 215 224 (#D4D7E0) instead of the app's 200 203 214, and `colorTextMuted` 164 169 184 (#A4A9B8) instead of 150 155 170. This is deliberate; do not set them back to the app values. Light mode follows the app exactly. In dark mode filled buttons are periwinkle `#A2AED1` with dark text `#131519`; that is intentional.

The defaults must pass the SDK's own WCAG AA contrast check (`contrastWarnings` returns nothing for both themes). When the defaults change, update the theme tests and the variables table in the developer docs (`developer-docs/src/app/(docs)/docs/sdks/react/page.mdx`).
