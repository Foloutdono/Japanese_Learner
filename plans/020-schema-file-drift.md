# Plan 020: Make `data_structure.sql` tell the truth, and add a test that keeps it true

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat d4911a6..HEAD -- backend/srs/data_structure.sql backend/routes CLAUDE.md`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none (independent of the rest of this wave)
- **Category**: tech-debt
- **Planned at**: commit `d4911a6`, 2026-08-25

## Why this matters

`backend/srs/data_structure.sql` is presented as the schema. `CLAUDE.md` tells
every new contributor to bootstrap their database with it:

```bash
docker exec -i jp-db psql -U postgres -d jp < backend/srs/data_structure.sql
```

It is not the schema. It declares **11** tables; the application creates **16**
at import time, and it declares one of the shared tables with the wrong
columns. The app happens to work anyway, because every module runs
`CREATE TABLE IF NOT EXISTS` for its own tables on startup — so the drift is
invisible until someone reads the file and believes it.

Anyone reading `custom_cards` in that file today would conclude a personal card
has `front`, `back`, `kana` and `hint` columns. It has `structure` and a
`fields` JSONB. Plan 017 writes to that table; this file would have sent its
executor down the wrong path.

This plan does not change any behaviour. It makes a document that is currently
misleading correct, and adds a cheap test so the next new table cannot drift
silently.

## Current state

### Tables declared in `backend/srs/data_structure.sql`

`cards`, `card_modes`, `review_log`, `user_profiles`, `phrase_history`,
`reading_log`, `comprehension_log`, `frequency_overrides`, `decks`,
`custom_cards`, `deck_cards` — eleven.

### Tables the application creates at import time

Reproduce the list yourself before starting:

```bash
cd backend && grep -rn "CREATE TABLE IF NOT EXISTS" routes/*.py srs/*.py \
  | sed 's/.*CREATE TABLE IF NOT EXISTS //' | sort -u
```

At the time of writing that yields sixteen, of which these **eight are absent
from the SQL file entirely**: `daruma_goals`, `daruma_state`,
`phrase_analysis_cache`, `streak_mends`, `translation_log`, `user_cosmetics`,
`user_loadout`, `xp_ledger`.

Re-derive the list rather than trusting this one — plans 016 and 019 in this
wave each add tables, so the true set depends on what has landed.

### The `custom_cards` divergence

The SQL file, `backend/srs/data_structure.sql:158`:

```sql
CREATE TABLE custom_cards (
    id BIGSERIAL PRIMARY KEY,
    deck_id BIGINT NOT NULL REFERENCES decks(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL,
    front TEXT NOT NULL,
    back TEXT NOT NULL,
    kana TEXT NOT NULL DEFAULT '',
    hint TEXT NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

The code, `backend/routes/decks.py:302-331`, then reshapes it on every startup:

```python
            cur.execute("""
                ALTER TABLE custom_cards
                    ADD COLUMN IF NOT EXISTS structure TEXT NOT NULL DEFAULT 'standard',
                    ADD COLUMN IF NOT EXISTS fields JSONB NOT NULL DEFAULT '{}'::jsonb
            """)
            ...
            cur.execute("ALTER TABLE custom_cards DROP COLUMN IF EXISTS hint")
            for col in ("front", "back", "kana"):
                cur.execute(f"ALTER TABLE custom_cards ALTER COLUMN {col} DROP NOT NULL")
```

So the real table has `structure` and `fields`, has **no** `hint`, and has
`front`/`back`/`kana` nullable and vestigial. The insert at `decks.py:694`
confirms it:

```python
                INSERT INTO custom_cards (deck_id, user_id, structure, fields, notes)
```

### The mechanism that makes it survivable

`backend/routes/decks.py:302` explains why this shape exists at all:

> Additive and idempotent, not DROP/CREATE: this runs on every
> startup, so a recreate would empty the table each time the API restarts.

That is a good decision and this plan does not change it. **The code stays the
source of truth.** The SQL file's job is to be an accurate description of what
the code produces, and a working bootstrap.

### Repo conventions

- Tests are `unittest.TestCase` under pytest; see
  `backend/tests/test_furigana.py`.
- Some tests need a live Postgres (`backend/tests/conftest.py` defaults
  `DATABASE_URL` to `postgresql://postgres:dev@localhost:5433/jp_test`). **The
  test in this plan must not** — it reads source files only, so it runs
  anywhere.
- `backend/tests/test_query_bounds.py` is an existing example of a test that
  asserts a property across source files rather than exercising behaviour.
  Read it and match its approach.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Tests | `cd backend && pytest` | all pass |
| This test | `cd backend && pytest tests/test_schema_declared.py -v` | all pass |
| Table inventory | see the `grep` in "Current state" | prints the true list |

## Scope

**In scope**:
- `backend/srs/data_structure.sql`
- `backend/tests/test_schema_declared.py` (create)
- `CLAUDE.md` (one clarifying line — Step 4)

**Out of scope** (do NOT touch):
- **Any `CREATE TABLE` or `ALTER TABLE` in Python.** The code is the source of
  truth and stays that way. Do not move table creation out of the modules and
  into the SQL file — that would break the idempotent-startup property
  `decks.py:302` depends on.
- Any actual database. This plan changes a file and adds a test; it runs no
  migration and alters no live data.
- Consolidating the eight scattered `CREATE TABLE IF NOT EXISTS` sites into one
  module. Tempting, and a much bigger change with real risk to startup
  ordering (`decks.py:335` notes a resolved FK-ordering concern). Not here.

## Git workflow

- Branch: `advisor/020-schema-file-drift`
- Commit per step; conventional commits, e.g.
  `docs(schema): declare the eight tables created only in code`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Inventory the real schema

Run the `grep` from "Current state" to get the true table list. For each table
**missing** from `data_structure.sql`, find its `CREATE TABLE IF NOT EXISTS`
in the code and copy the column definitions verbatim.

Record which module owns each one — you will need it for Step 2's comments.

**Verify**: you have a written list of every table, its owning module, and
whether it is currently declared

### Step 2: Correct and complete the file

Two changes.

**Fix `custom_cards`** so it matches what the code actually produces: add
`structure TEXT NOT NULL DEFAULT 'standard'` and
`fields JSONB NOT NULL DEFAULT '{}'::jsonb`, remove `hint`, and drop the
`NOT NULL` from `front`, `back` and `kana`. Add a comment above the table
pointing at `backend/routes/decks.py:302` and saying that the migration there
is authoritative.

**Add the missing tables**, each with a one-line comment naming the module that
creates it — e.g. `-- created by routes/phrase.py` above
`phrase_analysis_cache`.

Add a header comment at the top of the file stating plainly what it is: a
description of the schema the application creates for itself at startup, and a
convenient bootstrap — **not** a migration system, and not the source of truth.
Name the test from Step 3 as what keeps it honest.

Keep every table's existing formatting and its existing comments. This is an
additive correction, not a rewrite.

**Verify**: `cd backend && grep -c "^CREATE TABLE" srs/data_structure.sql` →
matches the count from Step 1

### Step 3: A test that catches the next drift

Create `backend/tests/test_schema_declared.py`, structured like
`backend/tests/test_query_bounds.py` (a source-reading property test, no
database).

It must:

- Walk `backend/routes/*.py` and `backend/srs/*.py`, extracting every table
  name following `CREATE TABLE IF NOT EXISTS`.
- Extract every table name following `CREATE TABLE` in
  `backend/srs/data_structure.sql`.
- Assert the first set is a subset of the second, and **name the missing tables
  in the failure message** — a bare `assertTrue` here would be actively
  unhelpful to whoever trips it.

Deliberately **not** asserted: that columns match. Parsing `ALTER TABLE`
sequences to reconstruct a table shape is a small database engine, and it
would be a brittle test of a file that only needs to be broadly honest. The
valuable property is "a new table cannot be invisible", and that is what this
catches. Say so in the test's docstring, so nobody later mistakes the gap for
an oversight.

**Verify**: `cd backend && pytest tests/test_schema_declared.py -v` → passes
**Verify**: temporarily add `CREATE TABLE IF NOT EXISTS zzz_probe (` to a route
file, re-run, confirm it **fails and names `zzz_probe`**, then remove it

### Step 4: One line in `CLAUDE.md`

Next to the bootstrap command in the "Local Postgres" block, note that the
application also creates and migrates its own tables at startup, so the SQL
file is a starting point rather than the complete schema.

One or two sentences. Do not restructure the document.

**Verify**: `cd backend && pytest` → all pass

## Test plan

One new test file, described in Step 3. Its own verification is the negative
case in that step — a test that cannot be made to fail proves nothing, so
actually run the `zzz_probe` check rather than assuming it works.

**Verification**: `cd backend && pytest` → all pass, including the new test.

## Done criteria

ALL must hold:

- [ ] `cd backend && pytest` exits 0
- [ ] `cd backend && pytest tests/test_schema_declared.py -v` passes
- [ ] The `zzz_probe` negative check was run and failed with the table named
- [ ] `grep -n "hint TEXT" backend/srs/data_structure.sql` → no match
- [ ] `grep -n "structure TEXT" backend/srs/data_structure.sql` → one match, in `custom_cards`
- [ ] `grep -c "^CREATE TABLE" backend/srs/data_structure.sql` → equals the code's table count
- [ ] `git diff --name-only` → exactly three files
- [ ] No Python file was modified (`git diff --name-only -- 'backend/**/*.py'` → only the new test)
- [ ] `plans/README.md` status row for 020 updated

## STOP conditions

Stop and report back (do not improvise) if:

- A table created in code has a **conflicting** definition in the SQL file
  beyond `custom_cards` — that is a live bug, not documentation drift, and it
  needs its own investigation.
- The `zzz_probe` negative check does not fail. The test is not doing what it
  claims; fix it before proceeding.
- Making the test pass seems to require changing a Python file. It does not —
  the fix is always in the SQL file.
- You conclude the SQL file should be deleted instead. That may well be right,
  but it changes the documented setup path in `CLAUDE.md` and is an operator
  decision. Report the recommendation; do not act on it.

## Maintenance notes

- **The code remains the source of truth.** This file describes it. If they
  ever disagree again, the code is right and the file is wrong.
- **The test only checks table presence, not columns.** That is deliberate and
  documented in its docstring; a column-level check would need a real database
  and a schema differ, which is a much larger piece of work with much less
  payoff.
- **Plans 016 and 019 in this wave add tables** (`phrase_history` columns,
  `video_sessions`, `video_session_jobs`). If either lands after this plan, its
  executor will be caught by this test — which is exactly the point.
- A reviewer should confirm no Python changed.
