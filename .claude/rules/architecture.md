---
paths:
  - "src/app/**/*.{ts,tsx}"
  - "src/containers/**/*.{ts,tsx}"
  - "src/components/**/*.{ts,tsx}"
  - "src/services/**/*.{ts,tsx}"
  - "src/hooks/**/*.{ts,tsx}"
  - "src/lib/**/*.{ts,tsx}"
  - "vite.config.ts"
---

# Architecture rules

Mandatory.

Last reviewed: 2026-10-20

## Current state: sign-in and users on the API, the rest on mock data

Sign-in (with 2FA), sign-out, forgot/reset password and Settings → Users &
Roles call the Accounts API. Every other page still reads from
`src/lib/mock/`, and its actions (issue, record payment, save settings,
export) show a "demo only" toast.

`services/` is the only path to the API: `apiClient` (the one axios
instance — base URL and timeout from `VITE_API_URL` / `VITE_API_TIMEOUT_MS`,
the Bearer token from `services/session.ts`, one refresh-and-retry on a 401,
an interceptor that turns every failure into `ApiError`), the TanStack Query
`queryClient` provided in `app/providers.tsx`, and the endpoints in
`services/auth.ts` and `services/users.ts`. Never create another axios
instance or call `fetch`. When an endpoint arrives, add one typed function
for it in `services/` on `apiClient` (query values in `params`, never
spliced into the URL) that checks the response with the parsers in
`services/parse.ts` (every body is `{ message, data }`; `unwrap` returns
`data`) and throws on failure — never returns `undefined` to mean "it
failed" — call it from the container through `useQuery` / `useMutation` in
place of the mock import, and move sorting/paging from `useClientTable` to
the request.

## This app is static files

A Vite + React Router single-page app. `vite build` writes plain files to
`out/`, which the Accounts API (NestJS) serves from its own origin. There is
no server of our own: everything renders in the browser, and all data comes
from the API.

- **Routes** are declared in `src/app/app.tsx`. Each one also needs an entry
  in `lib/routes.config.ts`: the header reads its title there, and the build
  writes `out/<route>/index.html` for every route listed there
  (`vite.config.ts`). The API serves files only, with no fallback to
  `index.html`, so a route missing from routes.config renders when clicked
  but 404s on refresh or from a bookmark.
- **Roles** for a route go in its `routes.config` entry (`roles`). `RouteGuard`
  (in `AppLayout`), the sidebar and the profile menu all read them through
  `canAccessRoute`; don't check a route's role inside a container.
- **URLs** have a trailing slash, and detail pages are
  `<list>/view/?id=…`, read with `useSearchParams` from `react-router` —
  the shape the per-route `index.html` files and existing links rely on.
- **Navigation** uses `Link` (`to=`) and `useNavigate` from `react-router`.
  HeroUI components given an `href` route through it too (`app/providers.tsx`).
- **Env vars** must be prefixed `VITE_` to reach the code, and every one is
  compiled into the public bundle.

## UI kit and look

HeroUI **v2** (`@heroui/react` 2.x) — NextUI v2 renamed — because mokal-app
is built on NextUI v2 and these screens copy its design. Not HeroUI v3, which
is a different library with a different API and look.

Theme: `hero.mjs` (HeroUI colours) and the `@theme` block in
`src/app/globals.css` (mokal-app's Tailwind colours under the same names).
There is no `tailwind.config.ts` — Tailwind is v4. Note v4's renamed
utilities when copying mokal-app markup: v3 `shadow-sm` is v4 `shadow-xs`,
v3 `shadow` is v4 `shadow-sm`, `bg-gradient-to-*` is `bg-linear-to-*`.

Reuse before writing: `components/common` has mokal-app's building blocks —
BaseButton, BaseTable (+ pager), BaseCardWrapper, InfoStrip, DetailRow,
FilterBar, StatCard, StatusChip and the status chips in `status.tsx`, Money,
PartyAvatar, RowActions, FormModal, SuccessModal, AlertBanner, ErrorState,
AgingTable, charts, and the form fields in `form/`.

## Layers

```
app/                       route table, layouts, providers
    │
    ▼
containers/                page composition and page state
    │
    ├──▶ components/       presentation
    ├──▶ hooks/            reusable client behaviour
    ├──▶ services/         the Accounts API (axios apiClient, queryClient)
    └──▶ lib/mock          data, until each endpoint exists
                              │
                              ▼
                           lib/  constants, enums, interfaces, types, money
```

Dependencies point **downward only**. `components/` never imports from
`containers/` or `app/`; `lib/` imports from none of them. If two modules
need each other, the shared part belongs in `lib/`.

- **`app/`** — the route table (each route renders a container) and the
  layouts around it.
- **`containers/`** — page composition, filters, modals, page state. Shared
  containers take a prop rather than being copied: `InvoiceList` /
  `InvoiceDetail` take `direction`, `PartyList` / `PartyDetail` take `type`.
- **`components/`** — props in, markup out. No data imports, no route
  knowledge beyond links passed in.
- **`lib/`** — no side effects at import time.

## Auth

The API's session is a Bearer token pair held in memory by
`services/session.ts` (security.md). `UserProvider` (`components/providers/
user-provider.tsx`, mounted in `app/providers.tsx`) holds the signed-in user,
also in memory: it starts empty, the login form sets it once sign-in
completes, Sign Out clears it (and calls `signOut()` through the
`endSession` prop, since components/ can't import services/), and so does
`apiClient` when the API refuses a refresh. `AppLayout` sends a signed-out
visitor to `/login/` — including after a page reload. Read the user with
`useUser()`, or `useCurrentUser()` on pages behind `AppLayout`.

Sign-in (`containers/login/`) is one or two steps: `signIn()` either signs
in or returns a challenge — `TWO_FACTOR` (app, recovery or email code) or
`TWO_FACTOR_SETUP` (an Admin without 2FA sets it up first; setting up an app
ends on the one-time recovery codes). The user's role is the API's `Role`
(`Admin`, `Accountant`, `Viewer`).

The session check decides only what renders — the API enforces session and
role on every endpoint. Hiding a menu item or a Settings form by role is
presentation, not access control.

## Money

Amounts are 2-decimal strings beside a currency code. Show them with
`<Money>` / `formatMoney` from `lib/money.ts`, which formats the string
without converting it to a number and always prints the currency.

- Never `parseFloat`, `Number()`, or do arithmetic on an amount. Totals, tax,
  balances and CAD conversions come from the API already calculated. Sort
  money columns with `sortType: "money"` (`compareMoney`), which is exact.
- `formatMoney` returns `null` for a malformed amount; `<Money>` shows a red
  dash. Never fall back to `0.00`.
- Draft and void invoices show "Not issued" / "—" for balance, not `0.00`.
- Chart series are plain numbers for drawing only; never read a displayed
  amount from them.

## Dates

Calendar dates (`2026-10-14`: invoice, due, payment dates) are shown as-is;
timestamps are converted to America/Toronto. Use `formatDate` /
`formatDateTime` from `lib/utils.ts` — formatting a date-only string in
Toronto time shows it a day early.

## Bundle discipline

Large static datasets are fetched, not imported. ApexCharts loads in its own
chunk through `React.lazy` (see `components/common/charts.tsx`).
