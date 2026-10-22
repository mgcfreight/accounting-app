# MGC Accounts — Frontend

React + TypeScript single-page app (Vite + React Router), built to **static
files**. The Accounts API (NestJS) is a separate repository that serves the
built `out/` folder from its own origin, so the two ship as one container. A change spanning
both needs a pull request in each, merged together.

Design reference: *MGC Accounts — Design & Architecture*, v1.0, 15 October 2026.

## What this system does

MGC's internal accounts tool: shipper invoices (money in), carrier invoices
(money out), payments, reminders, statements, and financial reports, for MGC's
accounts team only. Data comes from MGC Freight through the Accounts API's sync.

**A wrong number is worse than a crash.** A blank page gets reported; an amount
in the wrong currency, a tax total that is a cent out, or a balance shown as
`0.00` because a request failed does not. Treat anything showing amounts,
totals, tax, or currency as high-stakes work.

## Where things live

```
src/
├── app/                 route table (app.tsx), layouts, providers, global CSS
├── containers/          page composition and page state
├── components/          reusable presentation (common/ = mokal-app's kit)
├── hooks/               reusable client behaviour
├── services/            the only path to the Accounts API (no endpoints yet)
└── lib/                 constants, enums, interfaces, money, dates
    └── mock/            the data every screen runs on today

**The screens run on mock data.** `services/` holds the axios instance
(`apiClient`) and TanStack Query client, but no endpoints are wired yet: the
signed-in user is the mock user (`UserProvider`), and every action shows a
"demo only" toast.
The design copies mokal-app's — same layout, components, theme and colours.

Layer rules, static-hosting limits, the UI kit, and money and date rules are
in `.claude/rules/architecture.md`, which loads automatically when you work
in these directories.

## Commands

```bash
npm run dev         # Vite dev server on port 3001
npm run build       # static build to out/ (one index.html per route)
npm run preview     # serve out/ on port 3001
npm run lint        # ESLint
npm run typecheck   # tsc --noEmit
npm test            # currently just lint + typecheck — there are no tests
```

**This repo uses npm.** Install with plain `npm ci` — unlike mokal-app, the
dependency tree resolves without `--legacy-peer-deps`, so don't add the flag;
a peer conflict is a signal to look at, not to suppress.

Stack: Vite 8, React Router 8, React 19, HeroUI **v2** (NextUI v2 renamed —
kept on v2 because mokal-app's components are NextUI v2; v3 is a different
library) on Tailwind CSS 4. Tailwind is configured in `src/app/globals.css`
(`@theme`, through PostCSS) and HeroUI in `hero.mjs`; there is no
`tailwind.config.ts`. Lint is the ESLint CLI (`eslint .`). TypeScript is
pinned to 6.0.x and ESLint to 9.x on purpose: typescript-eslint does not
support TypeScript 7, and the React and a11y ESLint plugins do not support
ESLint 10 yet.

## Working with Claude in this repo

- **Say what you actually ran.** Never report that something works because it
  looks right. Name the command and give the real outcome. "I didn't run it" is
  a fine answer; a false "it works" is not. There is no test suite here, so
  passing lint and typecheck is not evidence that behaviour is correct.
- **Read before writing.** Open the component and its container before
  changing either, and check `components/common` before writing a new one.
- **Match the surrounding code.** If the surrounding pattern looks wrong, say so
  rather than silently copying it or silently diverging from it.
- **Stay in scope.** Don't reformat, upgrade, or clean up files the task didn't
  ask about. Known problems in existing code get flagged, not fixed in passing.
- **Ask before** adding a dependency.
- **When a requirement is ambiguous, ask.** Tax rules, rounding, which amount
  is official, and who may do what are product decisions — several are still
  open questions in the design document (section 15). Don't guess at them.

## Reference material

Rules in `.claude/rules/` load automatically — `git.md` and `security.md` every
session, `architecture.md` when you work under `src/`. You don't need to open
them.

Knowledge files load **only when you read them**. Open them when relevant:

| File | Read it when |
| --- | --- |
| `.claude/knowledge/owasp-top-10.md` | Touching auth, session handling, route guards, payments, or uploads |

## Setup

See `README.md`. Developer environments differ — WSL, Windows, native — so if a
command here doesn't work on your machine, check the README or ask. Don't edit
this file to match your local setup; machine-specific notes belong in
`CLAUDE.local.md`, which is gitignored.

**Start Claude Code from inside this repository**, not from a parent directory.
Hooks and rules are discovered from the directory the session starts in; launch
from one level up and the guardrails silently do not load.
