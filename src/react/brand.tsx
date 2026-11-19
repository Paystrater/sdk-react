// The Paystrater mark and wordmark, inline so the checkout never fetches an
// image (strict Content Security Policies stay happy) and takes the theme's
// colour through currentColor, so one graphic serves light and dark. Traced
// from the app's icon (sandbox-app public/images/icon.png) and wordmark
// (app public/images/text-icon.png); swap WORDMARK_PATH (and MARK_VIEWBOX) for
// the official vector when there is one.
// The mark is the wordmark's first glyph: its own bounds as the viewBox show only
// it, and centre it in whatever box holds it
const MARK_VIEWBOX = "0 8 92 104"

const WORDMARK_PATH =
  "M312 0 312 18 302 18 302 28 302 30 310 30 312 32 312 64 314 74 320 80 326 82 344 82 346 82 346 72 345 68 330 68 328 66 326 58 326 32 328 30 346 30 346 18 326 18 327 0ZM480 0 480 18 470 18 470 28 470 30 480 31 480 66 482 73 489 80 494 82 512 82 515 80 514 72 513 68 500 68 496 66 495 58 495 34 496 30 514 30 514 20 514 18 496 18 496 0ZM6 8 2 10 0 16 0 112 6 100 10 96 18 92 28 90 58 90 62 88 72 86 80 80 86 72 90 64 92 56 92 44 90 35 86 26 74 14 60 8ZM266 16 255 18 246 24 242 30 242 43 247 50 254 54 260 56 273 56 278 58 282 62 282 66 278 70 268 72 258 70 252 63 242 63 240 66 242 73 246 78 253 82 266 84 276 84 283 82 290 78 296 69 296 64 294 54 288 48 280 44 260 42 256 38 256 34 260 30 266 29 276 30 282 37 292 37 294 36 292 26 288 22 280 18ZM552 16 543 18 536 22 530 28 526 35 524 42 524 56 528 69 536 78 542 82 550 84 564 84 571 82 582 74 586 66 586 62 580 62 572 62 568 68 560 70 548 70 542 64 540 60 540 54 588 54 588 44 586 36 580 26 569 18 561 16ZM114 18 114 32 142 32 146 35 148 40 148 42 146 42 132 42 120 44 112 48 108 54 106 64 108 74 118 82 130 84 141 82 150 73 150 82 162 82 163 78 163 44 162 32 157 24 151 20 145 18ZM172 18 172 22 192 80 202 80 202 82 202 86 197 92 178 93 178 106 200 106 208 102 214 94 222 68 234 24 234 18 220 18 218 20 208 64 204 68 202 66 188 19ZM362 18 360 19 360 22 360 82 376 82 376 48 378 40 383 34 388 32 398 32 398 18 388 18 384 20 378 24 374 32 373 30 373 20 372 18ZM412 18 411 22 412 32 440 32 444 36 444 42 428 43 413 46 406 52 404 56 404 70 406 74 415 82 428 84 438 82 442 80 446 73 448 73 448 82 460 82 460 33 458 28 452 22 442 18ZM602 18 601 22 601 78 602 82 616 82 618 80 618 46 618 40 624 34 628 32 640 32 640 18 630 18 624 20 618 26 614 33 614 19ZM52 26 14 48 14 58 36 58 36 72 38 71 74 52 78 48 78 40 56 40 56 26ZM550 30 542 36 540 44 562 44 572 44 570 36 562 30ZM130 52 124 56 122 60 122 65 124 68 129 72 139 72 146 66 148 61 148 54 146 52ZM428 52 424 54 420 58 420 66 423 70 426 72 436 72 440 70 444 66 444 52Z"

export function PaystraterMark({ size = 16 }: { size?: number }) {
  return (
    <svg className="ps-mark" width={size} height={size} viewBox={MARK_VIEWBOX} aria-hidden="true" focusable="false">
      <path fill="currentColor" fillRule="evenodd" d={WORDMARK_PATH} />
    </svg>
  )
}

const PAYSTRATER_SITE = "https://paystrater.com"

/** The Paystrater wordmark (mark and name as one graphic), height px tall */
export function PaystraterWordmark({ height = 15 }: { height?: number }) {
  return (
    <svg className="ps-wordmark" height={height} width={(height * 640) / 112} viewBox="0 0 640 112" aria-hidden="true" focusable="false">
      <path fill="currentColor" fillRule="evenodd" d={WORDMARK_PATH} />
    </svg>
  )
}

/** "Powered by" and the wordmark under every screen of the checkout; it opens paystrater.com */
export function PoweredBy({ label }: { label: string }) {
  return (
    <footer className="ps-footer">
      <a className="ps-powered" href={PAYSTRATER_SITE} target="_blank" rel="noopener noreferrer" aria-label={`${label} Paystrater`}>
        <span>{label}</span>
        <PaystraterWordmark />
      </a>
    </footer>
  )
}

/** Icons for the payment method tiles: 20px, drawn with the text colour */
export function MethodIcon({ method }: { method: "pay_with_paystrater" | "transfer_to_pay" | "agentic" }) {
  if (method === "pay_with_paystrater") return <PaystraterMark size={20} />
  const common = { width: 20, height: 20, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true, focusable: false }
  if (method === "transfer_to_pay") {
    // A wallet with an arrow leaving it
    return (
      <svg {...common}>
        <path d="M19 7V5.5A1.5 1.5 0 0 0 17.5 4h-12A1.5 1.5 0 0 0 4 5.5v13A1.5 1.5 0 0 0 5.5 20h12a1.5 1.5 0 0 0 1.5-1.5V17" />
        <path d="M21 9.5h-5a2.5 2.5 0 0 0 0 5h5z" />
        <path d="M16.5 12h.01" />
      </svg>
    )
  }
  // An agent: a sparkle
  return (
    <svg {...common}>
      <path d="M12 3.5 13.8 9a1.8 1.8 0 0 0 1.2 1.2l5.5 1.8-5.5 1.8a1.8 1.8 0 0 0-1.2 1.2L12 20.5 10.2 15a1.8 1.8 0 0 0-1.2-1.2L3.5 12 9 10.2A1.8 1.8 0 0 0 10.2 9z" />
      <path d="M19 3v3M17.5 4.5h3" />
    </svg>
  )
}

/** The back arrow, as sandbox-app's page headers show it (lucide ArrowLeft) */
export function ArrowLeft({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="m12 19-7-7 7-7" />
      <path d="M19 12H5" />
    </svg>
  )
}
