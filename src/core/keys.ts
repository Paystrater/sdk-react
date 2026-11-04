// Publishable keys only. A key in a browser or an app bundle
// is public, so the SDK refuses a secret key outright and says why.

export type KeyMode = "live" | "test"

export type KeyCheck = { ok: true; mode: KeyMode } | { ok: false; message: string }

const PUBLISHABLE = /^pk_(live|test)_[A-Za-z0-9]+$/

export function checkPublishableKey(key: unknown): KeyCheck {
  if (typeof key !== "string" || key.trim() === "") {
    return { ok: false, message: "Pass your publishable key (pk_live_… or pk_test_…) from the Paystrater dashboard." }
  }
  if (key.startsWith("sk_")) {
    return {
      ok: false,
      message:
        "This is a secret key. Never put a secret key in a browser or an app: anyone can read it there. Use your publishable key (pk_live_… or pk_test_…); create payments with the secret key on your server."
    }
  }
  const match = PUBLISHABLE.exec(key)
  if (!match) return { ok: false, message: "A publishable key starts with pk_live_ or pk_test_." }
  return { ok: true, mode: match[1] as KeyMode }
}

/** The API host for a key's mode: live keys on production, test keys on the sandbox */
export function apiBaseFor(mode: KeyMode): string {
  return mode === "live" ? "https://api.paystrater.com" : "https://staging-api.paystrater.com"
}

/** A receive payment ID, checked before any call; it is never URL-encoded */
export const PAYMENT_ID = /^rcv_[A-Za-z0-9_-]{1,64}$/

export function isPaymentId(id: unknown): id is string {
  return typeof id === "string" && PAYMENT_ID.test(id)
}
