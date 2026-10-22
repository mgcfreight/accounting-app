# Git rules

Last reviewed: 2026-08-02

## Protected branches

Never commit or push directly to any of these:

    master    main    staging    dev    aws_production

They are shared, and some of them deploy on push — `aws_production` deploys
this app to production. Every change reaches them through a pull request — no
exceptions, including one-line fixes and "just a typo".

Before making the first commit of a task, check the current branch. If it is
protected, stop and create a working branch first. If work has already been
committed to a protected branch locally, say so rather than pushing it.

A PreToolUse hook blocks these outright rather than trusting judgment: force
push, `--no-verify`, `git reset --hard`, `git clean -f`, remote branch deletion,
and any push to a protected branch. `--force-with-lease` on your own working
branch is allowed.

## Branch naming

Mandatory format:

    <type>/<issue-number>-<short-description>

- `<type>` — one of: `feature`, `bugfix`, `hotfix`, `chore`, `refactor`,
  `docs`, `test`
- `<issue-number>` — the GitHub issue number, digits only, no `#`
- `<short-description>` — lowercase kebab-case, 2–5 words

Examples:

    feature/123-add-quote-export
    bugfix/456-fix-login-delay
    hotfix/321-patch-payment-crash

If there is no issue number for the work, ask for one before branching — don't
invent a number and don't omit the field. Older branches in this repo use
inconsistent forms (`bug_fixes`, `prettier-setup`, `issue#16/…`); do not copy
them.

## Commit messages

Conventional Commits, imperative mood, under ~72 characters:

    <type>(<optional-scope>): <summary>

    feat(quotes): add CSV export
    fix(payment): stop update loop on rate change

- Imperative: "add", "fix", "remove" — not "added", "fixes", "removing".
- Reference the issue in the commit or PR body: `Closes #123`.
- Describe what the change does, not that it was made. `fix: fixed` and
  `chore: updates` are not acceptable messages.
- One logical change per commit.

## What never goes in a commit

Check `git diff --cached` before every commit and confirm none of the
following are present:

- **`.env` files** or any other file holding real configuration values
- **Secrets** — API keys, tokens, passwords, connection strings, private keys,
  including in comments, test fixtures, and markdown
- **Debug statements** — `console.log`, `console.debug`, `debugger`, temporary
  logging added while working. Use the project logger for logging that is
  meant to stay.
- **`node_modules/`**, build output (`out/`), test artifacts
  (`playwright-report/`, `test-results/`), or other generated files
- **Commented-out code.** Delete it — git history is the archive.
- **Unrelated changes.** If a file was only touched by an editor or formatter
  and is not part of the task, unstage it.

If any of these are already staged, remove them and say what was removed.

## Scope

Do not modify `.github/workflows/`, git hooks, or `.gitignore` unless the task
is explicitly about them. Flag it and ask.
