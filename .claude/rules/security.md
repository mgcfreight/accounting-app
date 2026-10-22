# Security rules

Mandatory. Background reading is in `.claude/knowledge/`.

Last reviewed: 2026-10-19

## Validate all input at the boundary

Every value from outside is validated where it arrives — form input, URL and
search params, `localStorage`, cookies, and every backend or third-party
response.

- Validate with a schema rather than hand-rolled `if` chains. Note this repo
  has no schema validation library yet — `react-hook-form` handles form state
  only — so introducing zod or similar is a dependency decision. Ask first.
- A backend response is untrusted input. Do not assume an array is non-empty or
  that an optional field is present; a `.map()` over `undefined` is a blank page.
- Client-side validation is UX only. It improves the form experience and
  guarantees nothing — the server validates independently, always.
- Never trust a value the user can edit to make an authorization or pricing
  decision. Cookies and `localStorage` are user-editable.

## Always use parameterized queries

This app is static files with no server of its own, so it has no database
access — all data goes through the Accounts API. The rule is binding on any
query string built for an API: encode values, don't splice them.

## Sanitize output when rendering user-provided content

React escapes by default — that default is the protection, so don't defeat it.

- **`dangerouslySetInnerHTML` requires sanitization** (DOMPurify or equivalent)
  and a comment explaining why raw HTML is necessary. There are currently no
  uses of it in this repo; adding one is a deliberate decision, not a
  convenience.
- Never build DOM from strings, and never pass user content to `eval`,
  `new Function`, or a `javascript:` URL.
- Validate user-supplied URLs before using them in `href` or `src`. Allow
  `http`/`https` only, and add `rel="noopener noreferrer"` on external links.
- User content injected into a `<script>` tag, an inline style, or a JSON blob
  in markup is not escaped by React. Serialize it properly.

## Verify webhook signatures before processing payloads

This app cannot receive webhooks — it is static files. Stripe stays in MGC
Freight, and anything that receives a callback belongs in the Accounts API,
where this rule applies: verify the signature against the raw body before
parsing or acting on it, reject on failure, and be idempotent against replayed
deliveries.

## Sessions and tokens

The Accounts API's session is a Bearer token pair — an access token and a
single-use refresh token — returned in the sign-in response body. (The
team chose this over httpOnly cookies on 2026-10-22, to match the API as
built. The cost: any XSS can read a live token, so the output rules above
matter even more.)

- The tokens live only in memory, in `services/session.ts`. Never put one in
  `localStorage`, `sessionStorage`, a cookie, a URL, a log, or a toast. A
  page reload signs the user out; that is the price of not persisting them.
- Only `services/` touches a token: sign-in stores the pair, `apiClient`
  attaches the access token and rotates the pair, sign-out clears it.
  Containers and components get the user, never a token.
- Refresh through `apiClient` only. It serialises refreshes, because the API
  treats a reused refresh token as theft and signs the user out everywhere.
- The session check in `AppLayout` decides only what to render; the API is
  the authority.

## Run the OWASP checklist before finishing

Before completing work that touches authentication, session handling, routing
guards, payments, or file upload, review the change against
`.claude/knowledge/owasp-top-10.md`.

Pay particular attention to what crosses to the client: `VITE_*` values are
compiled into the bundle and readable by anyone, and any authorization
decision made in the browser is advisory only.

This is a real review step, not a box to tick. Name in your summary what you
checked and anything you were unsure about. If the change introduces a risk you
could not resolve, say so rather than shipping it quietly.
