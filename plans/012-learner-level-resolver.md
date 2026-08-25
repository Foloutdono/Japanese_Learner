# Plan 012: Route every JLPT-level decision through one resolver, ready for onboarding

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat d4911a6..HEAD -- backend/core backend/routes/reading.py backend/tests`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: direction
- **Planned at**: commit `d4911a6`, 2026-08-25

## Why this matters

A future onboarding flow will ask each learner for their JLPT level (by
self-declaration or a placement test). That value does not exist yet, but a
wave of upcoming work — sentence analysis, grading, the i+1 signal — needs to
know "what level should I treat this learner as".

If each of those features invents its own answer, onboarding becomes an audit
of every level-dependent call site months from now. This plan spends about an
hour to make onboarding a change to **one function**.

There is a second, immediate payoff: the word "level" is currently overloaded
in this codebase (JLPT level vs. XP level), and this establishes one named,
documented place where the JLPT one is decided.

## Current state

### There is no learner JLPT level

`backend/srs/data_structure.sql:61` — the profile table holds a username and
nothing else:

```sql
CREATE TABLE user_profiles (
    user_id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

`backend/routes/profile.py:220` returns `level_progress(xp)["level"]` — that
is the **XP/gamification** level from `backend/srs/xp.py`, not a JLPT level.
Do not confuse them; do not reuse it.

### Level is chosen per session today

Every screen that needs a JLPT level asks for one. Example — the reading
comprehension endpoint takes it as a **required** query parameter,
`backend/routes/reading.py:793`:

```python
@router.get("/api/reading/comprehension")
def get_comprehension_text(level: str, lang: str = "en", user_id: str = Depends(get_user_id)):
    data = _call_llm_comprehension(level, lang)
    spec = COMPREHENSION_SPECS.get(level, DEFAULT_COMPREHENSION_SPEC)
```

Its only caller always supplies it —
`frontend/src/screens/ReadingComprehensionScreen.jsx:38`:

```js
apiFetch(`/api/reading/comprehension?level=${lvl}&lang=${lang}`, session)
```

so making the parameter optional is a strict superset of today's behaviour.

### The level vocabulary

`backend/study/difficulty.py:54` is the canonical ordering, easiest first:

```python
LEVELS: tuple[str, ...] = ("N5", "N4", "N3", "N2", "N1")
```

### Repo conventions this must match

- **`backend/core/` holds cross-cutting singletons and identity helpers** —
  `auth.py`, `db.py`, `srs_instance.py`, `frequency_store_instance.py`. This
  new module belongs there. Read `backend/core/auth.py:22-45` for the house
  comment style: a section banner, then prose explaining *why* the code is
  shaped this way, including what was rejected. Match it. This codebase's
  comments carry reasoning, not restatement.
- **Tests use `unittest.TestCase` classes run under pytest**, with a
  docstring on the class explaining what property is under test. See
  `backend/tests/test_furigana.py:1-35` for the exact shape.
- `backend/tests/conftest.py` sets `DEV_USER_ID=test-user` and a
  `DATABASE_URL` default, so tests never need real credentials.

### Vocabulary to use (from `CONTEXT.md`)

Use these terms exactly in names and docstrings — the executor has not read
that file:

- **JLPT level** — N5 to N1. A property of content, and (once onboarding
  exists) of the learner.
- **XP level** — the gamification level from `srs/xp.py`. Unrelated to JLPT.
- **Learner level** — the user's own JLPT level. Does not exist yet; a future
  onboarding flow will set it. Always read it through the resolver seam.

### The decision this implements

`docs/adr/0005-learner-level-behind-a-resolver.md` records the trade-off.
Its load-bearing points, inlined:

- Resolution order is **explicit request, then (future) stored learner level,
  then a conservative default**.
- An explicit choice **beats** the stored level, deliberately: a learner
  reading above their level on purpose should not be second-guessed.
- A seam with one implementation looks like pointless indirection. The
  docstring must say why it exists, or someone will inline it.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Install | `cd backend && pip install -r requirements.txt` | exit 0 |
| Tests (all) | `cd backend && pytest` | all pass |
| Tests (this) | `cd backend && pytest tests/test_user_level.py -v` | all pass |
| Import check | `cd backend && python -c "from core.user_level import resolve_level"` | exit 0, no output |

## Scope

**In scope** (the only files you should modify or create):
- `backend/core/user_level.py` (create)
- `backend/tests/test_user_level.py` (create)
- `backend/routes/reading.py` (one endpoint signature — Step 3 only)

**Out of scope** (do NOT touch, even though they look related):
- `backend/srs/xp.py` and `backend/routes/profile.py` — that is the XP level,
  a different concept. Renaming or touching it is not part of this work.
- `backend/srs/data_structure.sql` — **do not add a level column.** Onboarding
  will design that schema; pre-empting it is exactly what this seam avoids.
- Any other route that takes a `level` parameter (`reading.py`'s batch
  endpoints, `exams.py`, `decks.py`). Converting them is deliberately
  deferred — one proof consumer is enough to keep the seam honest, and a bulk
  conversion is a bigger review for no added safety.
- `frontend/` — nothing changes on the client.

## Git workflow

- Branch: `advisor/012-learner-level-resolver`
- Commit per step; message style is conventional commits scoped by area. From
  `git log`: `test(i18n): add locale-parity test (fr<->en key set + value types)`
  and `chore(i18n): delete 8 dead French-only locale keys`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Create the resolver module

Create `backend/core/user_level.py`.

It must expose exactly three names:

- `DEFAULT_LEVEL: str` — the string `N5`.
- `LEVELS: tuple[str, ...]` — re-exported from `study.difficulty` so there is
  one ordering in the codebase, not two. Import it; do not redefine it.
- `resolve_level(user_id: str, requested: str | None = None) -> str`

`resolve_level` behaviour:

1. If `requested` is a valid level (a member of `LEVELS`), return it.
2. If `requested` is given but **not** valid, ignore it and fall through —
   do not raise. A bad query parameter must not return a 500 from a study
   screen.
3. Otherwise return `DEFAULT_LEVEL`.

Between 2 and 3, leave a clearly marked insertion point for the stored learner
level, naming `user_profiles` as where the column will go.

`user_id` is currently unused. That is intentional and must be stated in the
docstring, or a future reader will delete the parameter and every call site
will need editing when onboarding lands. Do **not** rename it with a leading
underscore.

The module docstring must carry the reasoning from the ADR: why a function and
not a constant, the resolution order, and why an explicit request wins over
the stored level. Follow `backend/core/auth.py:22-45`'s style.

**Verify**: `cd backend && python -c "from core.user_level import resolve_level, DEFAULT_LEVEL, LEVELS; print(resolve_level('u'), resolve_level('u','N2'), resolve_level('u','bogus'))"`
→ prints exactly `N5 N2 N5`

### Step 2: Test the resolver

Create `backend/tests/test_user_level.py`, modelled structurally on
`backend/tests/test_furigana.py` (a `unittest.TestCase` subclass with a class
docstring stating the property under test).

Cover, each as its own named test:

- an explicit valid level is returned unchanged, for every member of `LEVELS`
- no request returns `DEFAULT_LEVEL`
- an invalid request (`"bogus"`, `""`, `None`, and lowercase `"n5"`) falls
  back to `DEFAULT_LEVEL` and does not raise
- `DEFAULT_LEVEL` is itself a member of `LEVELS` (guards a future typo)
- `LEVELS` is identical to `study.difficulty.LEVELS` (guards the re-export
  drifting into a second copy)

**Verify**: `cd backend && pytest tests/test_user_level.py -v` → all pass, at
least 5 tests collected

### Step 3: Wire one real consumer

In `backend/routes/reading.py`, change `get_comprehension_text` (line 793) so
`level` is optional and resolved:

```python
@router.get("/api/reading/comprehension")
def get_comprehension_text(level: str | None = None, lang: str = "en",
                           user_id: str = Depends(get_user_id)):
    level = resolve_level(user_id, level)
    ...
```

Add the import alongside the module's existing `core` imports. Everything
below that line already reads the local `level` variable —
`_call_llm_comprehension(level, lang)`, `COMPREHENSION_SPECS.get(level, ...)`,
`READ_SECONDS_BY_LEVEL.get(level, ...)` and the `"level": level` in the
response — so no other line in the function changes.

This is the seam's proof consumer: it makes the parameter optional (a strict
superset, since the only caller always sends it) and puts one real call site
behind the resolver so the module is not dead code.

Do not convert any other endpoint.

**Verify**: `cd backend && pytest` → all pass (no regression)
**Verify**: `cd backend && grep -n "resolve_level" routes/reading.py` → exactly
two lines (the import and the call)

## Test plan

New file `backend/tests/test_user_level.py`, following
`backend/tests/test_furigana.py`'s structure. Cases are enumerated in Step 2.

No new test is needed for Step 3: the change is signature-only and the existing
suite covers that `reading.py` still imports and serves. If
`backend/tests/test_http_smoke.py` asserts anything about
`/api/reading/comprehension`, confirm it still passes rather than editing it.

**Verification**: `cd backend && pytest` → all pass, including at least 5 new
tests.

## Done criteria

ALL must hold:

- [ ] `cd backend && pytest` exits 0
- [ ] `backend/core/user_level.py` exists and exports `resolve_level`, `DEFAULT_LEVEL`, `LEVELS`
- [ ] `cd backend && pytest tests/test_user_level.py -v` → at least 5 tests, all pass
- [ ] `grep -c "N5" backend/core/user_level.py` → the default literal appears exactly once outside comments
- [ ] `grep -n "user_profiles" backend/core/user_level.py` → appears only inside a comment (no schema change)
- [ ] `git status` shows only the three in-scope files created/modified
- [ ] `plans/README.md` status row for 012 updated

## STOP conditions

Stop and report back (do not improvise) if:

- `backend/core/user_level.py` already exists — someone has done this. Report
  what is there rather than overwriting it.
- `user_profiles` already has a JLPT-level column — the premise of this plan is
  false and the resolver needs a different Step 1.
- `get_comprehension_text` at `reading.py:793` does not match the excerpt above.
- You find yourself wanting to change a second endpoint to make a test pass.
  That is out of scope; report it instead.
- `pytest` was already failing before your first change. Report the
  pre-existing failure; do not fix it as part of this plan.

## Maintenance notes

- **When onboarding lands**, the only change here is inserting the stored
  lookup between steps 2 and 3 of `resolve_level`, plus the column. Every
  consumer keeps working. If that turns out not to be true, the seam failed and
  the ADR should be revised.
- **A reviewer should check** that `user_id` was not deleted as "unused" and
  that the docstring explains why it is there.
- **Deliberately deferred**: converting the other roughly ten endpoints that
  take a `level` parameter. Do them opportunistically, as each is touched for
  other reasons, not in a single sweep.
- Plans 013 through 020 in this wave consume this resolver. Landing it first is
  what keeps them from each inventing a default.
