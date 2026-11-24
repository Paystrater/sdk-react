---
"@paystrater/react": patch
---

An expired Transfer to Pay tells the customer not to send money to the address any more, and no longer says a late transfer is returned by email. New string: statusExpiredTransferHint. `late`, `statusLate` and `statusLateHint` are removed: the checkout only shows what the server reports, and an expired payment that received money is underpaid.

Server rendering on React 18: the checkout's CSS is no longer HTML-escaped, which broke some of its rules and hydration.

README: the Content Security Policy section names the API hosts and allows a logo on any `https` host, and its Next.js example now sets the policy on the request too.
