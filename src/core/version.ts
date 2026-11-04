declare const __SDK_VERSION__: string | undefined

/** The package version, written in at build time */
export const SDK_VERSION: string = typeof __SDK_VERSION__ === "string" ? __SDK_VERSION__ : "0.0.0-dev"
