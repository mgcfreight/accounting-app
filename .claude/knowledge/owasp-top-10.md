# OWASP Top 10 — practical checklist

Reference material, not project rules. Consult when writing or reviewing code
that touches auth, data access, money, or anything reachable from the network.
Mandatory project rules live in `.claude/rules/`.

Based on the OWASP Top 10:2021. Version: see note at the bottom.
Last reviewed: 2026-08-03

---

## A01 — Broken Access Control

The most common real-world breach. Usually not a missing login check, but a
missing *ownership* check.

- Deny by default. Every route makes an explicit decision — guarded or public.
- Authorize the **object**, not just the route. `GET /invoices/:id` with a valid
  token must still confirm the invoice belongs to the caller (IDOR).
- Never trust identity or role from a client-supplied cookie, header, or body
  field. Derive it server-side from the verified token.
- Admin surface gets its own guard, not a role string checked inline.

## A02 — Cryptographic Failures

- TLS everywhere. Cookies: `httpOnly`, `Secure`, `SameSite`.
- Passwords: `bcrypt` or `argon2` with a sane cost. Never MD5/SHA-family.
- Secrets come from the environment or a secret store — never from code,
  config files, or markdown.
- Don't invent crypto, and don't reach for JWTs where a session would do.

## A03 — Injection

- Parameterized queries only. In TypeORM, pass values as parameters
  (`where('x = :v', { v })`) — never interpolate into the string.
- Validate and whitelist input at the boundary with DTOs, not deep in a service.
- Never pass user input into a shell command or a file path.
- XSS: React escapes by default; `dangerouslySetInnerHTML` is the hole. Escape
  anything rendered outside React too (emails, PDFs).

## A04 — Insecure Design

- Threat-model auth flows and money paths *before* writing them.
- Enforce business limits server-side — quantities, prices, currency, discounts.
  A total calculated on the client is an input, not a fact.
- Rate-limit and lock out on authentication endpoints by design, not as a patch.

## A05 — Security Misconfiguration

- CORS: explicit allowlist. Never `*` with credentials.
- Production returns generic errors. No stack traces, no ORM messages, no
  internal paths.
- `helmet` on, security headers set.
- API docs (Swagger) disabled or authenticated in production.
- No default credentials anywhere, including dev tooling.

## A06 — Vulnerable and Outdated Components

- `npm audit` / `yarn audit` in CI; fail on high and critical.
- Enable Dependabot or Renovate; update deliberately, not in a panic.
- Every new dependency is a supply-chain decision. Don't add one for something
  the standard library already does.

## A07 — Identification and Authentication Failures

- Generic messages on login and password reset. "Invalid credentials" — never
  "no such user", which enumerates accounts.
- Throttle and lock out after repeated failures.
- Short-lived access tokens, rotating refresh tokens, invalidated on logout and
  password change.
- MFA on admin accounts.

## A08 — Software and Data Integrity Failures

- Deploy immutable, content-addressed image tags. Never `latest`.
- Never deserialize untrusted data into live objects.
- **Verify webhook signatures.** An unverified payment webhook is an
  unauthenticated endpoint that changes financial state.

## A09 — Security Logging and Monitoring Failures

- Log authentication events, authorization failures, and payment state changes.
- Never log secrets, tokens, full card data, or unnecessary PII.
- A swallowed error is a missing log. `catch { return undefined }` destroys the
  evidence you need after an incident.
- Logs nobody reads aren't monitoring — alert on the ones that matter.

## A10 — Server-Side Request Forgery (SSRF)

- Never let user input choose the host of a server-side request.
- Allowlist outbound destinations for anything driven by user data.
- Set timeouts on every outbound call. A hung dependency is an availability bug.

---

**Version note:** this is the 2021 edition, which remains the most widely
referenced. OWASP has since published a revision that reorders several
categories and adds a supply-chain entry. The guidance above holds either way,
but verify against owasp.org before citing rankings externally.