// Theming in the style of enterprise-grade checkout SDKs: a theme
// plus a short list of variables. The defaults are the Paystrater design from
// the dashboard's src/app/globals.css, the source of truth.

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
  colorSurface: "#F3F4F6",
  colorText: "#111318",
  colorTextBody: "#3A3F4A",
  colorTextMuted: "#636975",
  colorBorder: "#DADCE2",
  colorPrimary: "#285BB6",
  colorPrimaryHover: "#1D4693",
  colorOnPrimary: "#FFFFFF",
  colorPrimaryText: "#285BB6",
  colorPrimarySoft: "#EAF1FC",
  colorSuccess: "#047857",
  colorWarning: "#B45309",
  colorDanger: "#C41E3A",
  ...FONTS
}

export const DARK: ThemeVariables = {
  colorBackground: "#0C0D10",
  colorSurface: "#1B1D23",
  colorText: "#F2F3F5",
  colorTextBody: "#C4C8D0",
  colorTextMuted: "#8E94A0",
  colorBorder: "#2E313A",
  // Filled buttons keep the saturated blue with white text in dark mode too
  colorPrimary: "#285BB6",
  colorPrimaryHover: "#3A6CC4",
  colorOnPrimary: "#FFFFFF",
  colorPrimaryText: "#A2AED1",
  colorPrimarySoft: "#182136",
  colorSuccess: "#4ADEA0",
  colorWarning: "#FBBF24",
  colorDanger: "#F87185",
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
