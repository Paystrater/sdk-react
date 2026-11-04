// When the checkout may call the API: polling only while
// the page is visible and focused (Page Visibility plus focus and blur on the
// web, AppState in React Native). The first read needs only a visible page, so
// a checkout in an iframe loads before the payer clicks into it (Mike, 2 Nov).
// No calls at all otherwise.

export interface ActivitySource {
  /** Visible and focused: polling may run */
  isActive(): boolean
  /** Visible, focused or not: enough for the first read. Without it, the first read waits for isActive */
  isVisible?(): boolean
  /** Calls back with isActive() whenever visibility or focus changes; returns the unsubscribe */
  subscribe(listener: (active: boolean) => void): () => void
}

/** Always active: for tests and for hosts that manage pausing themselves */
export const alwaysActive: ActivitySource = {
  isActive: () => true,
  subscribe: () => () => {}
}

/** The browser: visible and focused */
export function browserActivity(): ActivitySource {
  if (typeof document === "undefined" || typeof window === "undefined") return alwaysActive
  const isVisible = () => document.visibilityState === "visible"
  const isActive = () => isVisible() && document.hasFocus()
  return {
    isActive,
    isVisible,
    subscribe(listener) {
      let last = [isVisible(), isActive()]
      const check = () => {
        const now = [isVisible(), isActive()]
        if (now[0] !== last[0] || now[1] !== last[1]) {
          last = now
          listener(now[1]!)
        }
      }
      document.addEventListener("visibilitychange", check)
      window.addEventListener("focus", check)
      window.addEventListener("blur", check)
      return () => {
        document.removeEventListener("visibilitychange", check)
        window.removeEventListener("focus", check)
        window.removeEventListener("blur", check)
      }
    }
  }
}
