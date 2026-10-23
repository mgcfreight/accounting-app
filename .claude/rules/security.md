# Security rules

Mandatory. Background reading is in `.claude/knowledge/`.

Last reviewed: 2026-10-19

## Validate all input at the boundary

Every value from outside is validated where it arrives — form input, URL and
search params, `localStorage`, cookies, and every backend or third-party
response.

- Validate with a schema rather than hand-rolled `if` chains. API responses
  are checked with zod (`services/schemas.ts`, through `parseBody`);
  `react-hook-form` handles form state only.
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

The session is an httpOnly cookie set by the Accounts API. Never read, store,
or attach a token in JavaScript, and never put one in `localStorage`,
`sessionStorage`, or a non-httpOnly cookie. The session check in
`AppLayout` decides only what to render; the API is the authority.

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
