# Plan 022: Stop the exam screens crashing on the `{generating: true}` shape

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 2552915..HEAD -- frontend/src/screens/ExamResult.jsx frontend/src/screens/ExamRunner.jsx frontend/src/exam/examService.js`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P0
- **Effort**: S
- **Risk**: LOW — adds guards, removes no behaviour
- **Depends on**: —
- **Category**: correctness
- **Planned at**: commit `2552915`, 2026-08-26

## Why this matters

The deployed frontend throws this, caught in a production console on
2026-08-26:

```
Uncaught TypeError: Cannot read properties of undefined (reading '0')
```

It is a **white-screen crash**, not a handled error: the stack runs through
React's scheduler (`MessagePort`), which means it happened during render, and
React unmounted the tree.

`exam/examService.js` has one function with two unrelated return shapes:

```javascript
export async function getExam(examId, session, { exclude, revision } = {}) {
  ...
  if (res.status === 202) return { generating: true }
  ...
  return res.json()
}
```

`{ generating: true }` is **truthy and has no `sections`**. Every caller must
therefore check `generating` *before* touching the paper's fields.

`ExamRunner.jsx` does check, correctly — it early-returns and keeps polling:

```javascript
        .then(e => {
          if (!alive) return
          if (e?.generating) {
            timer = setTimeout(poll, delay)
            delay = Math.min(delay * 1.5, POLL_MAX_MS)
            return
          }
          ...
          setExam(e)
        })
```

**`ExamResult.jsx` does not.** It stores whatever comes back and reads into it
on the next render:

```javascript
    getAttempt(examId, attemptId, session)
      .then(summary =>
        getExam(examId, session, { revision: summary.revision })
          .then(exam => { if (alive) setLoaded({ exam, summary }) }))
      .catch(() => { if (alive) setLoaded(false) })
    ...
  const { summary, exam } = loaded || {}
  const section = exam?.sections[0] ?? null
  const sectionStats = section ? summary?.perSection[section.id] ?? null : null
```

When that `getExam` returns 202, `exam` is `{ generating: true }`, so
`exam?.sections[0]` evaluates `undefined[0]` and throws. **This is the reported
crash.**

Two things make it easy to miss in review:

- `exam?.sections[0] ?? null` *looks* fully guarded. The `?.` only guards `exam`
  being nullish, and the `?? null` only catches an `undefined` **result**.
  Neither protects the `[0]` step.
- The same mistake sits on the next line: `summary?.perSection[section.id]`
  guards `summary` but not `perSection`.

`ExamRunner.jsx:207` has the identical unguarded shape:

```javascript
  const section = exam ? exam.sections[0] : null
```

It is not reachable today only because the poll above never calls
`setExam({generating: true})`. That is one refactor away from becoming the same
bug, so it gets the same guard.

## Scope

**In scope:**
- `frontend/src/screens/ExamResult.jsx` — the crash, plus the `perSection` guard
- `frontend/src/screens/ExamRunner.jsx` — the latent twin, guard only
- `frontend/src/exam/examService.js` — a documenting comment only, **no logic
  change**
- `frontend/src/screens/ExamResult.generating.test.jsx` — new

**Out of scope — do not touch:**
- `getExam`'s two-shape contract. Collapsing 202 into an exception is a bigger
  design change than this plan, would touch `ExamRunner`'s working poll loop,
  and is not needed to stop the crash. See "Maintenance note".
- Anything about exam generation, scoring, or `routes/exams.py`.
- The `ExamRunner` poll/backoff logic.

## Steps

### Step 1 — Fix the live crash in `ExamResult.jsx`

Treat "still generating" as **not loaded**, which is a state this screen already
renders. Change the fetch so a 202 does not get stored as a paper:

```javascript
    getAttempt(examId, attemptId, session)
      .then(summary =>
        getExam(examId, session, { revision: summary.revision })
          .then(exam => {
            if (!alive) return
            // getExam returns {generating: true} on a 202 -- truthy, and
            // with no `sections`. Storing it would crash the render below
            // on exam.sections[0]. A result screen has nothing useful to
            // show for a paper that isn't materialized yet, so this is
            // the same "couldn't load" state as a failure.
            if (exam?.generating) { setLoaded(false); return }
            setLoaded({ exam, summary })
          }))
      .catch(() => { if (alive) setLoaded(false) })
```

Then make the derivations below structurally safe, so a future shape change
degrades instead of crashing:

```javascript
  const { summary, exam } = loaded || {}
  const section = exam?.sections?.[0] ?? null
  const sectionStats = section ? summary?.perSection?.[section.id] ?? null : null
```

**Verify** — no unguarded index remains on these lines:

```bash
cd frontend && grep -n "sections\[0\]\|sections?\.\[0\]\|perSection\[\|perSection?\.\[" src/screens/ExamResult.jsx
```

Expected: only the `?.[` forms appear; no bare `sections[0]` or `perSection[`.

### Step 2 — Guard the latent twin in `ExamRunner.jsx`

```javascript
  // `?.` on sections too, not just on exam: getExam's 202 shape
  // ({generating: true}) is truthy with no sections. The poll above
  // early-returns on it today, so this is defence against that guard
  // being moved, not a live bug -- see plans/022.
  const section = exam?.sections?.[0] ?? null
```

**Verify:**

```bash
cd frontend && grep -n "exam.sections\[0\]" src/screens/ExamRunner.jsx
```

Expected: no output.

### Step 3 — Name the trap where it originates

In `frontend/src/exam/examService.js`, above `getExam`, add:

```javascript
/**
 * ...existing docblock stays...
 *
 * RETURNS TWO SHAPES. A 202 (paper still being generated) resolves to
 * `{generating: true}` -- truthy, and WITHOUT `sections`/`revision`.
 * Every caller must check `.generating` before reading any paper field;
 * `exam?.sections[0]` is NOT enough, because the `?.` guards `exam` and
 * not `sections`. That exact line white-screened the result screen in
 * production (see plans/022-exam-generating-shape-crash.md).
 */
```

Do not change the function body.

### Step 4 — Regression test

Create `frontend/src/screens/ExamResult.generating.test.jsx`. Follow the
existing browser-test conventions in
`src/components/analysis/SentenceBreakdown.browser.test.jsx` — in particular,
wrap in `<LangProvider>` and stub `globalThis.fetch`, or the provider's own
translation fetch produces an unhandled rejection that pollutes the run.

The test must assert the **screen does not throw** when `getExam` resolves to
the generating shape:

```javascript
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the service, not the network: this is about the shape getExam
// returns, and mocking fetch would only re-test getExam's own status
// mapping.
vi.mock('../exam/examService', () => ({
  getAttempt: vi.fn(() => Promise.resolve({ revision: 1, perSection: {} })),
  getExam:    vi.fn(() => Promise.resolve({ generating: true })),
  ExamGenerationError: class extends Error {},
}))
```

Then render the screen at a route with an `attemptId`, await a tick, and assert
that rendering completed rather than throwing. Whatever query/assert helper the
existing browser tests use for "rendered without crashing" is the one to use
here — match them rather than inventing a pattern.

Add a second case asserting the normal shape (a real `sections` array) still
renders the section.

**Verify:**

```bash
cd frontend && npm test -- --run
```

Expected: all tests pass, including both new cases. Confirm the generating-shape
case **fails** if you temporarily revert Step 1 — a regression test that cannot
fail is not one.

### Step 5 — Full check

```bash
cd frontend && npm test -- --run && npm run lint
```

Expected: tests pass; lint reports **0 errors** (18 pre-existing warnings at the
time of writing are fine — do not fix them here).

## STOP conditions

- **The generating-shape test passes even with Step 1 reverted.** The test is
  not reaching the crash path — most likely the screen bails earlier on a
  missing route param or an unmocked dependency. Fix the test setup; do not
  weaken the assertion.
- **`ExamResult` has no "couldn't load" render branch** to reuse for
  `setLoaded(false)`. Then this needs a real generating state with a poll, which
  is a larger change than this plan covers — STOP and report.
- Any exam test outside the new file starts failing.

## Test plan

Automated: Step 4.

Manual, after deploying — this reproduces the original report:
1. Start a **brand new** mock exam so its paper generates fresh.
2. While it is still generating, navigate straight to that exam's result URL.
3. **Expected**: the "couldn't load" state, not a white screen, and no
   `Cannot read properties of undefined` in the console.

## Maintenance note

The real defect is a function with two incompatible return shapes and no type
system to force callers to discriminate. The guards here fix the two live call
sites; they do not stop a third from being written.

If this recurs, the durable fix is to make the generating case impossible to
read through by accident — either throw a typed `ExamGeneratingError` (making
202 a control-flow branch like the 503 already is), or return a discriminated
`{status: 'generating'} | {status: 'ready', exam}`. Both touch `ExamRunner`'s
working poll loop, which is why they are deliberately out of scope here.

Watch in review: any new `getExam(...)` call site, and any `exam.` field access
that is not behind a `generating` check or `?.`.
