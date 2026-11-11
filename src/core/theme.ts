// Theming in the style of enterprise-grade checkout SDKs: a theme
// plus a short list of variables. The defaults follow the Paystrater mobile app
// (mobile/paystrater src/utils/colors.ts), the brand theme source for every
// Paystrater surface: the checkout card is the app's sub-surface (white, or
// #24272F in dark), wells are the app surface, #285BB6 in light mode and
// #A2AED1 with dark text in dark mode. See .agents/rules/DESIGN.md.

export type ThemeName = "light" | "dark" | "auto"

export interface ThemeVariables {
  colorBackground: string
  /** Muted surfaces: method cards, the address well */
  colorSurface: string
  colorText: string
  colorTextBody: string
  colorTextMuted: string
  colorBorder: string
  /** Solid buttons */
  colorPrimary: string
  colorPrimaryHover: string
  /** Text on a solid button */
  colorOnPrimary: string
  /** Links and focus rings */
  colorPrimaryText: string
  colorPrimarySoft: string
  colorSuccess: string
  colorWarning: string
  colorDanger: string
  fontFamily: string
  /** Amounts and addresses */
  fontFamilyMono: string
  /** Controls: buttons, inputs */
  borderRadius: string
  /** Surfaces: the checkout card, method cards */
  borderRadiusSurface: string
}

export interface Appearance {
  theme?: ThemeName
  variables?: Partial<ThemeVariables>
}

const FONTS = {
  // The SDK never loads fonts: a merchant that does not load Sora gets the system stack
  fontFamily: 'Sora, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  fontFamilyMono: '"Geist Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
  borderRadius: "8px",
  borderRadiusSurface: "12px"
}

export const LIGHT: ThemeVariables = {
  colorBackground: "#FFFFFF",
  colorSurface: "#ECF0F3",
  colorText: "#1B1B1F",
  colorTextBody: "#3A3F4A",
  colorTextMuted: "#636975",
  colorBorder: "#D4DAE6",
  colorPrimary: "#285BB6",
  colorPrimaryHover: "#1D4693",
  colorOnPrimary: "#FFFFFF",
  colorPrimaryText: "#285BB6",
  colorPrimarySoft: "#E2E9F5",
  colorSuccess: "#047857",
  colorWarning: "#B45309",
  colorDanger: "#BA1A1A",
  ...FONTS
}

export const DARK: ThemeVariables = {
  colorBackground: "#24272F",
  colorSurface: "#2C303A",
  colorText: "#E3E2E6",
  colorTextBody: "#D4D7E0",
  colorTextMuted: "#A4A9B8",
  colorBorder: "#343844",
  // Filled buttons are periwinkle with dark text, as in the mobile app
  colorPrimary: "#A2AED1",
  colorPrimaryHover: "#B8C3E0",
  colorOnPrimary: "#131519",
  colorPrimaryText: "#A2AED1",
  colorPrimarySoft: "#353A48",
  colorSuccess: "#4ADEA0",
  colorWarning: "#FBBF24",
  colorDanger: "#FFB4AB",
  ...FONTS
}

/** The variables for a theme; "auto" follows prefers-color-scheme */
export function resolveTheme(appearance: Appearance | undefined, prefersDark: boolean): ThemeVariables {
  const theme = appearance?.theme ?? "light"
  const base = theme === "dark" || (theme === "auto" && prefersDark) ? DARK : LIGHT
  const variables: Partial<ThemeVariables> = {}
  for (const [key, value] of Object.entries(appearance?.variables ?? {})) {
    // A value is only ever a CSS value; anything that could close the declaration is dropped
    if (typeof value === "string" && value.trim() && !/[;{}<>]/.test(value)) {
      variables[key as keyof ThemeVariables] = value.trim()
    }
  }
  return { ...base, ...variables }
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
