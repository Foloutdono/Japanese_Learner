# Plan 009: Make `npm run dev` able to authenticate, and document the frontend env setup

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat a3c6597..HEAD -- frontend/.env.production frontend/.gitignore frontend/src/lib/supabase.js CLAUDE.md`
> On any mismatch with the "Current state" excerpts, treat it as a STOP
> condition.
>
> ⚠️ **This plan touches credential *plumbing*. It must never put a credential
> value into a tracked file, a commit message, a log, or your summary.** See
> "Hard rule on secrets" below before doing anything.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW (no application logic changes)
- **Depends on**: none
- **Category**: dx
- **Planned at**: commit `a3c6597`, 2026-08-25

## Why this matters

**A fresh checkout of this repo cannot log in in dev mode.** That is not a
hypothetical: it was the direct cause of live-verification failing on five of
the seven plans in the previous backlog, and it cost real debugging time twice
in one session, both times surfacing as an opaque `Failed to fetch` /
`ERR_NAME_NOT_RESOLVED` in the browser console.

The mechanism, confirmed:

- The real Supabase credentials live in `frontend/.env.production`, which is
  **deliberately tracked** in git (Vercel builds read it).
- Vite loads `.env.production` **only in production mode**. `npm run dev` runs
  in development mode and loads `.env`, `.env.local`, `.env.development`,
  `.env.development.local` — none of which contain the Supabase variables.
- `frontend/.gitignore` excludes `.env.local` and `.env.*.local`, so any local
  fix one developer makes never reaches a teammate, a fresh clone, or a git
  worktree.
- `frontend/src/lib/supabase.js` falls back to a **placeholder project** when
  the variables are undefined, so the app boots and looks fine right up until
  an auth call fails against a domain that does not resolve.

The failure is silent at startup and confusing at the point of use. A
one-line-per-developer setup step plus an `.env.example` and four lines of
documentation removes it permanently.

## Hard rule on secrets

The Supabase anon key and URL are already committed in `frontend/.env.production`
(that is pre-existing and out of scope to change here — see "Out of scope").
Regardless:

- **Never print a credential value** into your terminal output, your commit
  messages, or your final summary. Refer to variables by *name* only.
- When copying values between files, do it with a shell redirect that never
  echoes the value (e.g. `grep -E '^VITE_SUPABASE' .env.production > .env.development.local`),
  never by reading a value and re-typing it.
- The `.env.example` you create in Step 2 contains **placeholder text only**,
  never real values.

## Current state

### `frontend/.gitignore` — the relevant lines

```
# Local env overrides. .env.production is deliberately tracked (VITE_
...
.env.local
.env.*.local
```

### What actually exists on disk today

- `frontend/.env.production` — **tracked**; contains `VITE_API_URL`,
  `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
- `frontend/.env.local` — **gitignored**; contains only `VITE_API_URL`. No
  Supabase variables.
- No `frontend/.env.example`.
- No `frontend/.env.development.local` in a fresh checkout.

### `frontend/src/lib/supabase.js:3-9`

```js
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

// Storybook's Vite build doesn't inherit the app's .env, so these are
// undefined there — createClient throws on a missing/invalid URL,
// which used to crash every story that imports anything on the
// BurgerMenu/TopBar → useProfileSummary chain. Every story file's own
```

Read the rest of this file before Step 3 — the placeholder fallback exists for
a stated reason (Storybook), so it must **not** be removed. This plan adds a
warning alongside it, not a replacement for it.

### `CLAUDE.md`

Documents the backend's local setup (`.env`, `DATABASE_URL`, `DEV_USER_ID`,
the docker Postgres commands) and the frontend's commands (`npm install`,
`npm run dev`, `npm run build`, `npm run lint`, `npm test`) — but says
**nothing** about frontend environment variables. Confirmed:
`grep -n "VITE_SUPABASE\|env.local\|env.development" CLAUDE.md` returns nothing.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Install | `cd frontend && npm install` | exit 0 |
| Dev server | `cd frontend && npm run dev` | serves; console clean |
| Build | `cd frontend && npm run build` | exit 0 |
| Lint | `cd frontend && npm run lint` | exit 0 |
| Confirm var reaches the app | see Step 4 | real project URL, not the placeholder |

## Scope

**In scope** (the only files you should create or modify):
- `frontend/.env.example` (create)
- `frontend/src/lib/supabase.js` (add a dev-mode warning only — see Step 3)
- `CLAUDE.md` (add a frontend env section)
- `plans/README.md` (status row)

**Out of scope** (do NOT touch, even though they look related):
- **Moving the credentials out of the tracked `frontend/.env.production`.**
  That file is deliberately tracked for Vercel, the anon key is a
  publishable-by-design key, and relocating it is a deployment change with
  real blast radius. If you believe it should be rotated or moved, say so in
  your summary as a recommendation — do not act on it.
- The placeholder fallback in `supabase.js`. It exists so Storybook does not
  crash; removing it breaks that. Add a warning beside it, do not replace it.
- `.gitignore`'s `.env.local` / `.env.*.local` rules. Those are correct —
  local overrides *should* be ignored. The fix is `.env.example` +
  documentation, not un-ignoring local files.
- Committing any real `.env.local` or `.env.development.local`. Ever.
- The backend's `.env` handling. Different file, different concern.

## Git workflow

- Branch: `advisor/009-dev-env-supabase-credentials`
- Conventional commits, scoped. Use `docs(dx): ...` / `fix(dx): ...`.
- One commit is fine.
- **Before committing, run `git status` and confirm no `.env.local` or
  `.env.development.local` is staged.** See the Done criteria.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Reproduce the failure, so you know the fix works

In a checkout with **no** `.env.development.local`, start the dev server and
open the app. In the browser console:

```js
(await import('/src/lib/supabase.js')).supabase.supabaseUrl
```

**Verify**: it returns the **placeholder** URL (whatever `supabase.js`'s
fallback is), not the real project. This is the bug. Record what you saw.

### Step 2: Add `frontend/.env.example`

Create it with **placeholder values only**:

```
# Frontend environment variables.
#
# Vite only loads .env.production in a production build, so the values
# in the tracked .env.production do NOT reach `npm run dev`. For local
# development, copy this file to .env.development.local (gitignored)
# and fill it in — or, since .env.production is tracked and already has
# working values, just copy the two VITE_SUPABASE_ lines out of it:
#
#   grep -E '^VITE_SUPABASE' .env.production > .env.development.local
#
# Without these, the app boots against a placeholder Supabase project
# and every auth call fails with ERR_NAME_NOT_RESOLVED.

# Backend origin. Leave unset in dev — vite.config.js proxies /api to
# http://localhost:8000 already.
VITE_API_URL=

# Supabase project. Both are publishable client-side values.
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

**Verify**: `cd frontend && grep -c "your-project-ref" .env.example` → `1`
(i.e. it contains the placeholder, proving no real value was pasted in).

**Verify**: `cd frontend && git check-ignore .env.example; echo "exit=$?"` →
`exit=1` (NOT ignored — this file must be committed).

### Step 3: Make the failure loud instead of silent

In `frontend/src/lib/supabase.js`, where the placeholder fallback is applied,
add a development-only console warning. Keep the existing Storybook rationale
comment intact and add to it.

Target shape (adapt to the file's actual structure):

```js
// A missing URL in `npm run dev` is nearly always the .env trap:
// the real values live in the tracked .env.production, which Vite
// does not load in development. Warn loudly rather than letting the
// placeholder fail later as an opaque ERR_NAME_NOT_RESOLVED on the
// first auth call. See .env.example.
if (import.meta.env.DEV && !SUPABASE_URL) {
  console.warn(
    '[supabase] VITE_SUPABASE_URL is unset — using a placeholder project. ' +
    'Auth will fail. See frontend/.env.example: copy the VITE_SUPABASE_ ' +
    'lines from .env.production into .env.development.local.',
  )
}
```

`import.meta.env.DEV` is statically replaced with `false` in a production
build, so this whole branch is dropped from the bundle — the same pattern
`App.jsx` already uses for its `/dev/rewards` route.

**Verify**: `cd frontend && npm run build` → exit 0.

**Verify**: with no `.env.development.local`, start the dev server and confirm
the warning appears in the browser console.

### Step 4: Confirm the documented fix actually works

Apply the very command the `.env.example` recommends:

```bash
cd frontend && grep -E '^VITE_SUPABASE' .env.production > .env.development.local
```

Restart the dev server (Vite reads env files at startup only — an existing
server will not pick this up).

**Verify**: in the browser console,

```js
(await import('/src/lib/supabase.js')).supabase.supabaseUrl
```

now returns the **real** project URL, and the Step 3 warning no longer fires.

**Verify**: `cd frontend && git status --short` → `.env.development.local` does
**not** appear (it is correctly gitignored).

⚠️ Do not paste the returned URL into your summary. Report only "returns the
real project URL, not the placeholder."

### Step 5: Document it in `CLAUDE.md`

Add a short subsection under the existing Frontend section. Match the file's
existing tone and formatting (it uses `###` headings and fenced bash blocks).

```markdown
### Frontend env vars

`frontend/.env.production` is tracked (Vercel reads it), but **Vite does not
load it for `npm run dev`** — dev mode reads `.env.local` /
`.env.development.local`, which are gitignored. Without them the app falls back
to a placeholder Supabase project and every auth call fails with
`ERR_NAME_NOT_RESOLVED`.

One-time setup in a fresh clone or a new git worktree:

```bash
cd frontend && grep -E '^VITE_SUPABASE' .env.production > .env.development.local
```

See `frontend/.env.example` for the full variable list.
```

Note the git-worktree mention explicitly — gitignored files do not propagate to
worktrees, which is what made this bite repeatedly during automated work.

**Verify**: `grep -c "env.development.local" CLAUDE.md` → at least `1`

### Step 6: Run the full gate

**Verify**: `cd frontend && npm run lint` → exit 0, 0 errors
**Verify**: `cd frontend && npm test` → all pass
**Verify**: `cd frontend && npm run build` → exit 0

## Test plan

No automated tests. This is configuration and documentation; the verification
that matters is the **before/after in Step 1 vs Step 4** — placeholder URL
before, real URL after, using only the command the documentation tells a
developer to run. Record both in your summary (by outcome, never by value).

A follow-on worth noting but not doing here: once plan 008's browser test lane
exists, a smoke test asserting `supabase.supabaseUrl` is not the placeholder
would catch this in CI. It needs the test environment first.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `frontend/.env.example` exists and is tracked (`git ls-files frontend/.env.example` returns it)
- [ ] `cd frontend && grep -c "your-project-ref" .env.example` → `1` (placeholder, not a real value)
- [ ] `cd frontend && grep -cE "^VITE_SUPABASE_ANON_KEY=your-anon-key" .env.example` → `1`
- [ ] `cd frontend && grep -c "import.meta.env.DEV" src/lib/supabase.js` → at least `1`
- [ ] `grep -c "env.development.local" CLAUDE.md` → at least `1`
- [ ] `git status --short` shows **no** `.env.local` or `.env.development.local` staged or untracked-and-added
- [ ] `git diff --cached` contains no string resembling a real Supabase project ref or key
- [ ] `cd frontend && npm run lint` exits 0, `npm test` passes, `npm run build` exits 0
- [ ] Step 1 and Step 4 outcomes both recorded in your summary, by outcome not by value
- [ ] `plans/README.md` status row for 009 updated

## STOP conditions

Stop and report back (do not improvise) if:

- `frontend/.env.production` does **not** contain `VITE_SUPABASE_URL` and
  `VITE_SUPABASE_ANON_KEY`. The whole "copy the two lines" instruction depends
  on it, and if the credentials have moved, the documentation must describe
  wherever they actually are.
- The placeholder fallback in `supabase.js` has been removed since this plan
  was written — the warning in Step 3 assumes it still exists and that
  `SUPABASE_URL` can legitimately be undefined.
- Adding the warning trips a lint rule (`no-console` is a plausible one).
  Report the rule rather than adding a blanket disable — a targeted
  `eslint-disable-next-line` with a written justification is this repo's house
  style, but confirm the rule is actually enabled before assuming.
- You find yourself about to commit a file containing a real credential.
  Stop immediately and report.

## Maintenance notes

- **The root cause is a Vite mode rule, not a bug**: `.env.production` is
  production-only by design. Anyone who "fixes" this by renaming that file will
  break the Vercel build. The `.env.example` comment says so; keep it.
- A reviewer should scrutinize: that no real credential entered a tracked file.
  `git diff --cached` before merging is the check.
- **Git worktrees are the sharpest edge here.** Gitignored env files do not
  propagate, so every new worktree silently loses auth. If automated agents
  keep working in worktrees, consider a `postCreate`-style helper script that
  runs the copy command — worth its own small plan if it keeps recurring.
- Deliberately deferred, and worth a separate decision: whether
  `VITE_SUPABASE_ANON_KEY` should be committed at all. It is a publishable
  client-side key by Supabase's design, so this is not an incident — but a
  reviewer may still prefer it injected at build time by Vercel rather than
  tracked. That is a deployment-process change, not a dev-setup fix.
