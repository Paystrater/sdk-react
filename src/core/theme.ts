// Theming in the style of enterprise-grade checkout SDKs: a theme
// plus a short list of variables. The defaults follow the Paystrater mobile app
// (mobile/paystrater src/utils/colors.ts), the brand theme source for every
// Paystrater surface, as the web sandbox app (sandbox-app src/app/globals.css)
// draws it: the checkout card is the sub-surface (white, or #24272F in dark)
// edged by the card line, wells inside it are sunken, buttons are pills,
// #285BB6 in light mode and #A2AED1 with dark text in dark mode.
// See .agents/rules/DESIGN.md.

export type ThemeName = "light" | "dark" | "auto"

export interface ThemeVariables {
  /** The checkout card */
  colorBackground: string
  /** Wells inside the card: the address box, the QR */
  colorSurface: string
  /** Hover fills: method cards, chain chips, outline buttons; the skeleton */
  colorSurfaceHover: string
  colorText: string
  colorTextBody: string
  colorTextMuted: string
  /** Placeholders and small meta text */
  colorTextSubtle: string
  /** The card line: the card, method cards, wells */
  colorBorder: string
  /** Input outlines on hover, outline buttons */
  colorBorderStrong: string
  /** Solid buttons */
  colorPrimary: string
  colorPrimaryHover: string
  /** Text on a solid button */
  colorOnPrimary: string
  /** Links and focus rings */
  colorPrimaryText: string
  /** Tinted fills: notes, tonal buttons, the selected chain, initials */
  colorPrimarySoft: string
  colorSuccess: string
  /** The success badge's fill */
  colorSuccessSoft: string
  colorWarning: string
  colorDanger: string
  /** Error alerts and the failure badge's fill */
  colorDangerSoft: string
  fontFamily: string
  /** Amounts and addresses */
  fontFamilyMono: string
  /** Inputs and chain chips */
  borderRadius: string
  /** Surfaces inside the card: method cards, wells, notes */
  borderRadiusSurface: string
  /** Buttons: full pills */
  borderRadiusButton: string
  /** The checkout card itself */
  borderRadiusCard: string
}

export interface Appearance {
  /** "auto" (the default) follows the device's light or dark setting */
  theme?: ThemeName
  /** Overrides for both themes. A value equal to a Paystrater light default follows the theme instead */
  variables?: Partial<ThemeVariables>
  /** Overrides for the dark theme only, on top of variables */
  variablesDark?: Partial<ThemeVariables>
}

const SHAPE = {
  // The SDK never loads fonts: a merchant that does not load Sora gets the system stack
  fontFamily: 'Sora, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  fontFamilyMono: '"Geist Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
  // The sandbox app's radii: fields and surfaces 14px, pills 24px, cards 18px
  borderRadius: "14px",
  borderRadiusSurface: "14px",
  borderRadiusButton: "24px",
  borderRadiusCard: "18px"
}

export const LIGHT: ThemeVariables = {
  colorBackground: "#FFFFFF",
  colorSurface: "#F5F7FA",
  colorSurfaceHover: "#E4E9EF",
  colorText: "#1B1B1F",
  colorTextBody: "#3A3F4A",
  colorTextMuted: "#636975",
  colorTextSubtle: "#8E939D",
  colorBorder: "#D4DAE6",
  colorBorderStrong: "#C5C6D0",
  colorPrimary: "#285BB6",
  colorPrimaryHover: "#1D4693",
  colorOnPrimary: "#FFFFFF",
  colorPrimaryText: "#285BB6",
  colorPrimarySoft: "#E2E9F5",
  colorSuccess: "#047857",
  colorSuccessSoft: "rgba(4, 120, 87, 0.12)",
  colorWarning: "#B45309",
  colorDanger: "#BA1A1A",
  colorDangerSoft: "rgba(186, 26, 26, 0.1)",
  ...SHAPE
}

export const DARK: ThemeVariables = {
  colorBackground: "#24272F",
  colorSurface: "#1E2128",
  colorSurfaceHover: "#2C303A",
  colorText: "#E3E2E6",
  colorTextBody: "#D4D7E0",
  colorTextMuted: "#A4A9B8",
  colorTextSubtle: "#707584",
  // The periwinkle card line at 18%, as in the app
  colorBorder: "rgba(162, 174, 209, 0.18)",
  colorBorderStrong: "#44464F",
  // Filled buttons are periwinkle with dark text, as in the mobile app
  colorPrimary: "#A2AED1",
  colorPrimaryHover: "#B8C3E0",
  colorOnPrimary: "#131519",
  colorPrimaryText: "#A2AED1",
  colorPrimarySoft: "#353A48",
  colorSuccess: "#4ADEA0",
  colorSuccessSoft: "rgba(74, 222, 160, 0.12)",
  colorWarning: "#FBBF24",
  colorDanger: "#FFB4AB",
  colorDangerSoft: "rgba(255, 180, 171, 0.12)",
  ...SHAPE
}

/** The variables for a theme; "auto", the default, follows prefers-color-scheme */
export function resolveTheme(appearance: Appearance | undefined, prefersDark: boolean): ThemeVariables {
  const theme = appearance?.theme ?? "auto"
  const dark = theme === "dark" || (theme === "auto" && prefersDark)
  const base = dark ? DARK : LIGHT
  const variables: Partial<ThemeVariables> = {}
  const take = (source: Partial<ThemeVariables> | undefined, followTheme: boolean) => {
    for (const [key, value] of Object.entries(source ?? {})) {
      // A value is only ever a CSS value; anything that could close the declaration is dropped
      if (typeof value !== "string" || !value.trim() || /[;{}<>]/.test(value)) continue
      const name = key as keyof ThemeVariables
      // Paystrater's own light colour (as setup code writes colorPrimary "#285BB6") is
      // the brand, not a choice: in dark mode the brand's dark colour applies
      if (followTheme && dark && value.trim().toLowerCase() === LIGHT[name]?.toLowerCase()) continue
      variables[name] = value.trim()
    }
  }
  take(appearance?.variables, true)
  if (dark) take(appearance?.variablesDark, false)
  return { ...base, ...primaryCompanions(variables, dark, variables.colorBackground ?? base.colorBackground), ...variables }
}

const INK = { light: "#FFFFFF", dark: "#131519" }

/**
 * A merchant's colorPrimary without its hover or text colour: work them out
 * from it, so the button never shows the theme's own hover colour (periwinkle
 * in dark mode) or text that is unreadable on the merchant's colour. Values
 * the merchant gives win; this only fills the gaps.
 */
function primaryCompanions(variables: Partial<ThemeVariables>, dark: boolean, background: string): Partial<ThemeVariables> {
  const primary = variables.colorPrimary
  if (!primary) return {}
  const companions: Partial<ThemeVariables> = {
    // Darker on hover in light mode, lighter in dark mode, as the defaults do
    colorPrimaryHover: `color-mix(in srgb, ${primary} 85%, ${dark ? "#FFFFFF" : "#000000"})`
  }
  const onLight = contrastRatio(INK.light, primary)
  const onDark = contrastRatio(INK.dark, primary)
  if (onLight !== undefined && onDark !== undefined) companions.colorOnPrimary = onLight >= onDark ? INK.light : INK.dark
  // Links, focus rings and the amount in the merchant's colour, shaded until it reads (AA) on the card
  const text = readableOn(primary, background, dark)
  if (text) companions.colorPrimaryText = text
  return companions
}

/**
 * color itself when it passes WCAG AA (4.5:1) on background, else the first
 * shade of it, darker in light mode or lighter in dark mode, that does.
 * Undefined when either colour cannot be read (named colours, CSS variables).
 */
export function readableOn(color: string, background: string, dark: boolean): string | undefined {
  const rgb = parseColor(color)
  if (!rgb || !parseColor(background)) return undefined
  const toward = dark ? 255 : 0
  for (let step = 0; step <= 20; step++) {
    const mix = rgb.map((c) => Math.round(c + ((toward - c) * step) / 20)) as [number, number, number]
    const hex = `#${mix.map((c) => c.toString(16).padStart(2, "0")).join("").toUpperCase()}`
    if ((contrastRatio(hex, background) ?? 0) >= 4.5) return step === 0 ? color : hex
  }
  return dark ? "#FFFFFF" : "#000000"
}

/** colorPrimaryText -> --ps-color-primary-text */
export function cssVariableName(key: keyof ThemeVariables): string {
  return `--ps-${key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`
}

export function toCssVariables(variables: ThemeVariables): Record<string, string> {
  const out: Record<string, string> = {}
  for (const key of Object.keys(variables) as (keyof ThemeVariables)[]) out[cssVariableName(key)] = variables[key]
  return out
}

// ---- Contrast (accessibility is not themeable away) ----

/** #rgb, #rrggbb, rgb(r g b) or rgb(r, g, b); undefined for anything else (named colours, CSS variables) */
export function parseColor(value: string): [number, number, number] | undefined {
  const v = value.trim()
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(v)
  if (hex) {
    const h = hex[1]!
    const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h
    return [parseInt(full.slice(0, 2), 16), parseInt(full.slice(2, 4), 16), parseInt(full.slice(4, 6), 16)]
  }
  const rgb = /^rgba?\(\s*(\d{1,3})[\s,]+(\d{1,3})[\s,]+(\d{1,3})/i.exec(v)
  if (rgb) return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])]
  return undefined
}

function luminance([r, g, b]: [number, number, number]) {
  const channel = (c: number) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

/** WCAG contrast ratio, or undefined when either colour cannot be read */
export function contrastRatio(a: string, b: string): number | undefined {
  const x = parseColor(a)
  const y = parseColor(b)
  if (!x || !y) return undefined
  const [hi, lo] = [luminance(x), luminance(y)].sort((p, q) => q - p) as [number, number]
  return (hi + 0.05) / (lo + 0.05)
}

/** Pairs under WCAG AA (4.5:1 for text). The SDK warns about them in test mode */
export function contrastWarnings(v: ThemeVariables): string[] {
  const pairs: [string, keyof ThemeVariables, keyof ThemeVariables][] = [
    ["Text", "colorText", "colorBackground"],
    ["Body text", "colorTextBody", "colorBackground"],
    ["Muted text", "colorTextMuted", "colorBackground"],
    ["Button text", "colorOnPrimary", "colorPrimary"],
    ["Links", "colorPrimaryText", "colorBackground"],
    ["Error text", "colorDanger", "colorBackground"]
  ]
  const warnings: string[] = []
  for (const [label, fg, bg] of pairs) {
    const ratio = contrastRatio(v[fg], v[bg])
    if (ratio !== undefined && ratio < 4.5) {
      warnings.push(`${label} (${fg} on ${bg}) has a contrast of ${ratio.toFixed(2)}:1, under WCAG AA (4.5:1).`)
    }
  }
  return warnings
}
