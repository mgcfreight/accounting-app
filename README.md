# MGC Accounts — Frontend

The screens for MGC Accounts, MGC Freight's internal accounts app: shipper
invoices (AR), carrier invoices (AP), payments, statements, and financial
reports. Used by MGC's accounts team only.

This repository is the **React frontend only** (Vite + React Router). It
builds to static files (`out/`), which the Accounts API (NestJS, separate
repository) will copy into its Docker image and serve from the same origin.
There is no frontend server in production.

> **Status: design on mock data.** Every screen is built, in the same design as
> mokal-app, and runs on the sample data in `src/lib/mock/`. Nothing calls an
> API yet: sign-in goes straight to the dashboard, and actions (issue, record
> payment, export, save) show a "demo only" notice.

## Tech stack

| Layer         | Technology                                        |
| ------------- | ------------------------------------------------- |
| Build         | Vite 8                                            |
| Routing       | React Router 8                                    |
| Language      | TypeScript 6.0                                    |
| UI            | HeroUI v2, Tailwind CSS 4                         |
| React         | React 19                                          |
| Forms         | React Hook Form                                   |
| Charts        | ApexCharts (via `react-apexcharts`)               |
| Notifications | Sonner (toasts)                                   |

**Same look as mokal-app.** HeroUI v2 is NextUI v2 renamed, so mokal-app's
components port across with the same props and look. The theme is mokal-app's:
HeroUI colours in `hero.mjs`, and mokal-app's Tailwind colours under the same
class names (`bg-base-primary-500`, `text-content-6`, …) in the `@theme` block
of `src/app/globals.css`.

Version pins that are deliberately below "latest":

| Package       | Pinned | Why                                                             |
| ------------- | ------ | --------------------------------------------------------------- |
| @heroui/react | 2.x    | v3 is a redesigned library; v2 matches mokal-app's NextUI v2    |
| typescript    | 6.0.x  | typescript-eslint supports `<6.1.0`; TypeScript 7 breaks lint   |
| eslint        | 9.x    | eslint-plugin-react / jsx-a11y don't support ESLint 10          |
| @types/node   | 24.x   | Matches the Node 24 runtime                                     |

## Project structure

```
src/
├── app/                 route table (app.tsx), layouts, providers, global CSS
├── containers/          one folder per screen; shared ones take a prop
├── components/
│   ├── common/          BaseButton, BaseTable, StatCard, FormModal, Money, …
│   ├── header/          page title, back arrow, header button, profile menu
│   ├── sidebar/         mokal-app's gradient sidebar
│   ├── layouts/         dashboard and login layouts
│   └── icons/           SVGs from mokal-app
├── hooks/               useClientTable (sort + page), useLocalStorage
└── lib/                 enums, interfaces, routes config, money, dates, mock/
```

## Screens

| Route                          | Screen                                      | Phase |
| ------------------------------ | ------------------------------------------- | ----- |
| `/login/`                      | Sign in                                     | 0     |
| `/dashboard/`                  | KPIs, revenue chart, margin, aging, recent  | 3     |
| `/shipper-invoices/`           | AR list: search, status and flag filters    | 1     |
| `/shipper-invoices/view/?id=`  | AR detail: charges, notes, payments, files  | 1     |
| `/carrier-invoices/`           | AP list, with carrier bill #                | 1     |
| `/carrier-invoices/view/?id=`  | AP detail                                   | 1     |
| `/needs-review/`               | MGC changes that touch issued invoices      | 1     |
| `/payments/`                   | Payments, Unmatched tab, Record Payment     | 2     |
| `/shippers/`, `/carriers/`     | Parties with balance and overdue            | 2     |
| `/shippers/view/?id=`, `/carriers/view/?id=` | Balance page and statements   | 2     |
| `/reports/`                    | Reports with exports, P&L sheet, aging      | 3     |
| `/sync-status/`                | Last/next run, Sync now, checkpoints, runs  | 0     |
| `/audit-log/`                  | Change history with before/after            | 0     |
| `/settings/`                   | Company, tax rates, schedule, users (Admin) | 0     |

## Roles

| Role       | Can do                                                          |
| ---------- | --------------------------------------------------------------- |
| Admin      | Everything, including users, tax rates, settings and write-offs |
| Accountant | Invoices, notes, payments, disputes, installments, statements   |
| Viewer     | View and export everything; no changes                          |

The mock user is an Admin. The frontend hides controls by role for convenience
only; the API will enforce roles on every endpoint.

## Local development

```bash
npm ci
npm run dev
```

The app runs at [http://localhost:3001](http://localhost:3001) (3001 keeps it
clear of mokal-app on 3000). No environment variables or API are needed while
the screens run on mock data.

| Command             | Purpose                                   |
| ------------------- | ----------------------------------------- |
| `npm run dev`       | Vite dev server with hot reload           |
| `npm run build`     | Static build to `out/`                    |
| `npm run preview`   | Serve the built `out/` locally            |
| `npm run lint`      | ESLint                                    |
| `npm run typecheck` | `tsc --noEmit`                            |
| `npm test`          | Lint + typecheck (there are no tests yet) |

`npm install` also points git at `.githooks/`: lint on commit, typecheck on
push.

## Deployment

CI (`.github/workflows/ci.yml`) runs gitleaks, lint, typecheck and a build on
every pull request. Deployment belongs to the Accounts API pipeline, which
builds this app and serves `out/` from its image.

The build writes `out/<route>/index.html` for every route (and `out/404.html`),
so the API serves deep links and refreshes without an SPA fallback. A new route must be added to
`src/lib/routes.config.ts` as well as `src/app/app.tsx` to get its file.
