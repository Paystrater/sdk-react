---
"@paystrater/react": patch
---

Pay with Paystrater speaks of approving in the app rather than a PIN, since the app also approves with fingerprint and Face ID: "We'll send the request to your app. Approve it there." and "Open the request, check the amount and approve it. This page updates by itself."

README: the Content Security Policy section now lists exactly what the checkout needs and why, with a working policy and a Next.js example, including `style-src-attr 'unsafe-inline'` when the checkout is server-rendered under a nonce-only `style-src`.
