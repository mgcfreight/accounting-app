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

## Current state: partly on the API

Sign-in (with 2FA and password reset), My Account, Users, Roles &
Permissions, Sessions, the Audit Report, Settings (company, notifications,
tax rates, charge types), Shippers and Carriers (with agreements),
Shipments, Shipper and Carrier Invoices (with versions), Payments (record,
allocate, reverse), the Dashboard, Statements (with their PDF and Excel
downloads, via `getFile` and `useFileDownload`), Reminders (send now,
skip), Disputes (Needs Review, and "Flag as disputed" on an invoice) and
Reports (with the API's Excel and PDF of each) run on the Accounts API.
Installment plans, Needs Review's MGC changes (they come with the TMS sync)
and Sync Status still read from `src/lib/mock/`, and their actions (new
plan, the accountant export) show a "demo only" toast.

The API sends party ids, not names, on shipments and carrier invoices:
look them up with `usePartyNames` (`containers/parties`), and show the id
until the name arrives. A customer invoice carries its `billTo.name`.

`services/` is the only path to the API: `apiClient` (the one axios
instance — base URL and timeout from `VITE_API_URL` / `VITE_API_TIMEOUT_MS`,
cookie session via `withCredentials`, one single-flight refresh and retry on
a 401, and an interceptor that turns every failure into `ApiError`) and the
TanStack Query `queryClient` provided in `app/providers.tsx`. Never create
another axios instance or call `fetch`. For each endpoint, add one typed
function in `services/` on `apiClient` (query values in `params`, never
spliced into the URL) that checks the response with a zod schema from
`services/schemas.ts` through `parseBody` and throws on failure — never
returns `undefined` to mean "it failed" — call it from the container through
`useQuery` / `useMutation` in place of the mock import, and page on the
server with `useServerPaging` instead of `useClientTable`.

## This app is static files

A Vite + React Router single-page app. `vite build` writes plain files to
`out/`, which the Accounts API (NestJS) serves from its own origin. There is
no server of our own: everything renders in the browser, and all data comes
from the API.

- **Routes** are declared in `src/app/routes.tsx`. Each one also needs an entry
  in `lib/routes.config.ts`: the header reads its title there, and the build
  writes `out/<route>/index.html` for every route listed there
  (`vite.config.ts`). The API serves files only, with no fallback to
  `index.html`, so a route missing from routes.config renders when clicked
  but 404s on refresh or from a bookmark.
- **Access** for a route goes in its `routes.config` entry (`access`:
  `anyUser`, `adminOnly`, `allOf` or `anyOf` permissions). `RouteGuard` (in
  `AppLayout`), the sidebar and the profile menu all read it through
  `canAccessRoute`; don't check a page's access inside a container. Buttons
  use `useCan()` (`lib/access.ts`), and roles are checked by `SystemRoleId`
  or `me.isAdmin`, never by name — custom role names are free text.
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

Spacing is one scale everywhere. A page's root is `flex flex-col gap-6`
(24px between its sections — filters, banners, cards, tabs); cards pad
`p-4`; groups inside a card are `gap-4`, lines in a list `gap-2`. Kit
components carry no outer margin (FilterBar, AlertBanner, cards), so the
parent's gap spaces them — don't add `mt-*`/`mb-*` to a page section, and
don't add bottom padding to a page: the layout's padding already ends it.

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

The API owns the session as two httpOnly cookies: `mgc_at` (access, 15 min)
and `mgc_rt` (refresh, path `/v1/auth/tokens`). No code here reads, stores
or attaches a token. On a 401, `apiClient` calls `POST /auth/tokens` once —
shared by every waiting request, because the refresh token is single use —
and repeats the request; if that fails it tells `onSessionExpired`
listeners.

`UserProvider` (`components/providers/user-provider.tsx`, mounted in
`app/providers.tsx`) loads the signed-in user from `GET /auth/me` into the
TanStack cache (`["auth","me"]`): `undefined` while loading, `null` when
signed out. The login form calls `refreshUser()` after the API signs in;
Sign Out calls `logout()` and clears every cached query. `AppLayout` shows a
spinner, a retry on a network failure, or sends a signed-out visitor to
`/login/` (and back afterwards). Read the user with `useUser()`, or
`useCurrentUser()` on pages behind `AppLayout`.

All of that decides only what renders — the API enforces session and role on
every endpoint, and scopes Sessions and the Audit Report to the caller's own
rows unless they're an Admin. Hiding a menu item or a form by role is
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
