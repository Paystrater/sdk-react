// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest"
import { browserActivity } from "../../src/core/activity.js"

/** Sets what the page reports, then fires the event the browser would */
function page(visibility: "visible" | "hidden", focused: boolean, event: "visibilitychange" | "focus" | "blur") {
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => visibility })
  vi.spyOn(document, "hasFocus").mockReturnValue(focused)
  if (event === "visibilitychange") document.dispatchEvent(new Event(event))
  else window.dispatchEvent(new Event(event))
}

afterEach(() => {
  Reflect.deleteProperty(document, "visibilityState")
})

describe("browser activity (first read once visible)", () => {
  it("reports visible and focused separately, and calls back on either change", () => {
    page("hidden", false, "visibilitychange")
    const activity = browserActivity()
    const calls: boolean[] = []
    const stop = activity.subscribe((active) => calls.push(active))
    expect([activity.isVisible?.(), activity.isActive()]).toEqual([false, false])

    // The tab is shown, but the iframe holding the checkout has no focus
    page("visible", false, "visibilitychange")
    expect([activity.isVisible?.(), activity.isActive()]).toEqual([true, false])
    expect(calls).toEqual([false])

    page("visible", true, "focus")
    expect(calls).toEqual([false, true])
    page("visible", true, "focus")
    expect(calls).toEqual([false, true])

    stop()
    page("hidden", false, "visibilitychange")
    expect(calls).toEqual([false, true])
  })
})
