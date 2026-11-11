# Paystrater SDK Design Rules

## 0. Brand theme source (rule)

The brand theme follows the **Paystrater mobile app**, not the other way round. Its palette lives in the mobile repo (`PayStrater/mobile/paystrater`) in `src/utils/colors.ts` and `src/components/reusables/useSurfaces.tsx`. Internal control (`frontend/internal-control/.agents/rules/DESIGN.md`) holds the reference mapping. When the app's colours change, update the default theme in `src/core/theme.ts` (the React Native SDK copies it with `scripts/sync-core.mjs`) to match, keep the mapping below, and change every Paystrater frontend together (app, landing page, dashboard, developer docs, internal control and the React, React Native and Flutter SDKs).

| App value | Theme variable |
| :-- | :-- |
| light `plainWhite` / dark `subSurface` 36 39 47 (#24272F) | `colorBackground` (the checkout card) |
| light `background` 236 240 243 (#ECF0F3) / dark 44 48 58 (#2C303A, a well on the sub-surface) | `colorSurface` (method cards, the address well) |
| `onBackground` #1B1B1F / #E3E2E6 | `colorText` |
| body #3A3F4A / #D4D7E0, `onSurfaceVariant` #636975 / #A4A9B8 (dark text lifted for the web, see below) | `colorTextBody`, `colorTextMuted` |
| `cardLine` #D4DAE6 / #343844 | `colorBorder` |
| `primary` #285BB6 / #A2AED1, hover #1D4693 / #B8C3E0 | `colorPrimary`, `colorPrimaryHover`, `colorPrimaryText` |
| `onPrimary` #FFFFFF / #131519 | `colorOnPrimary` |
| `tint` #E2E9F5 / #353A48 | `colorPrimarySoft` |
| success #047857 / #4ADEA0, warning #B45309 / #FBBF24, `error` #BA1A1A / #FFB4AB | `colorSuccess`, `colorWarning`, `colorDanger` |

The light surface and sub-surface pair (cool grey-blue under white cards) is the look Mike chose; do not drift back to a warm or neutral grey.

**Dark text on the web (Mike, 2026-11-11):** the SDKs, like the web surfaces, lift the app's dark text for long-form reading on large screens: `colorTextBody` 212 215 224 (#D4D7E0) instead of the app's 200 203 214, and `colorTextMuted` 164 169 184 (#A4A9B8) instead of 150 155 170. This is deliberate; do not set them back to the app values. Light mode follows the app exactly. In dark mode filled buttons are periwinkle `#A2AED1` with dark text `#131519`; that is intentional.

The defaults must pass the SDK's own WCAG AA contrast check (`contrastWarnings` returns nothing for both themes). When the defaults change, update the theme tests and the variables table in the developer docs (`developer-docs/src/app/(docs)/docs/sdks/react/page.mdx`).
