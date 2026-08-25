# Plan 015: Extract one shared sentence-breakdown component from two divergent copies

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat d4911a6..HEAD -- frontend/src/screens/PhraseAnalyzerScreen.jsx frontend/src/screens/ReadingScreen.jsx frontend/src/components`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED — touches two live study screens
- **Depends on**: `plans/014-two-tier-phrase-api.md` (hard)
- **Category**: tech-debt
- **Planned at**: commit `d4911a6`, 2026-08-25

## Why this matters

The same sentence breakdown is implemented twice, in two screens, and the
copies have already diverged in a user-visible way: the analyzer's status
badges render **hardcoded English** while reading practice's render translated
text. A French learner sees "Mastered" on one screen and "Maîtrisé" on the
other, for the same concept.

Four more surfaces are about to render this same breakdown (the analyzer
rewrite, the Sentence bank, photo input, video subtitles). Extracting now means
every later improvement — furigana ruby, grammar chips, level badges, mining —
lands in one place instead of six. Extracting later means porting six copies.

This plan is a **refactor plus one bug fix**. It adds no feature.

## Current state

### The duplication, precisely

Both files define the same helpers, independently:

| Symbol | `PhraseAnalyzerScreen.jsx` | `ReadingScreen.jsx` | Identical? |
|---|---|---|---|
| `STATUS_COLORS` | line 10 | line 16 | yes |
| `wordColor` | line 29 | line 43 | yes |
| `StatusBadge` | line 287 | line 995 | **no — see below** |
| `DetailPanel` | line 299 | line 900 | near-identical |
| `Label` | line 371 | line 978 | yes |
| `StatRow` | line 379 | line 986 | yes |
| word card | `WordCard`, line 241 | `BreakdownWordCard`, line 799 | near-identical |

`wordColor` is byte-identical in both —
`frontend/src/screens/PhraseAnalyzerScreen.jsx:29`:

```js
function wordColor(word) {
  if (word.vocab_match) return STATUS_COLORS[word.vocab_match.stats.status] || STATUS_COLORS.not_started
  if (word.kanji_matches?.length > 0) return 'var(--accent3)'
  return 'var(--text-secondary)'
}
```

### The divergence — this is the bug to fix

`frontend/src/screens/ReadingScreen.jsx:995` translates:

```js
function StatusBadge({ status, t }) {
  const color = STATUS_COLORS[status] || STATUS_COLORS.not_started
  const label = t[`status_${status}`] || status
  return (
    <span className="status-pill" style={{ '--pill-color': color }}>
      {label}
    </span>
  )
}
```

`frontend/src/screens/PhraseAnalyzerScreen.jsx:287` does not:

```js
function StatusBadge({ status, small }) {
  const color = STATUS_COLORS[status] || STATUS_COLORS.not_started
  const label = STATUS_LABELS[status] || status
  return (
    <span className={`status-pill${small ? ' status-pill--sm' : ''}`} style={{ '--pill-color': color }}>
      {label}
    </span>
  )
}
```

`STATUS_LABELS` at `PhraseAnalyzerScreen.jsx:18` is a hardcoded English table
(`'Mastered'`, `'Learning'`, `'New'`, `'Not in deck'`, `'Due now'`). The
merged component must take `ReadingScreen`'s translated behaviour **and** keep
the analyzer's `small` variant. `STATUS_LABELS` is then dead and must be
deleted.

The `t.status_*` keys already exist in both locale tables — `ReadingScreen.jsx:27`
lists them among the keys it deliberately reuses. Confirm before relying on it:
`grep -n "status_mastered" frontend/src/locales/en/index.js frontend/src/locales/fr/index.js`.

### The CSS already exists and is shared

Both screens already use the same class names from `frontend/src/index.css`:
`phrase-line`, `word-span`, `word-span--clickable`, `phrase-word-card`,
`phrase-word-card__surface`, `phrase-kanji-chip`, `status-pill`,
`status-pill--sm`, `detail-overlay-sheet`, `detail-sheet`, `status-legend`.

**Do not rename, move or restyle any of them.** `index.css` is 15K+ lines and
plan 010 documented a cascade dependency between physically distant blocks in
it. This plan is a JSX refactor; CSS stays untouched.

### The data shape

Plan 014 made `/api/phrase/analyze` return `tokens` (the new shape) alongside
`words` (a deprecated alias pointing at the same list). **This plan reads
`tokens`.** Each entry carries `surface`, `start`, `end`, `lemma`, `reading`,
`pos`, `furigana`, `vocab_match`, `kanji_matches`, and — only when the deep
tier was bought — `meaning`. The response also carries `grammar`, `level`,
`grade`, `available`, `unknown_count` and `off_deck_count`.

`meaning` being absent is **normal**, not an error: it is absent for every
particle, and for every token when the deep tier was not requested. Render its
absence as nothing, never as "undefined" or an error state.

### Repo conventions this must match

- **Components are grouped by feature area** under `frontend/src/components/`:
  `decks`, `dictionary`, `profile`, `rewards`, `selection`, `station`, `stats`,
  `study`, `ui`. A new `analysis` directory belongs alongside them.
- **`prop-types` is a devDependency and is used** — check an existing
  component in `frontend/src/components/study/` and match whatever it does.
  Be consistent with the neighbours rather than introducing a new convention.
- **Translation keys get an inline `??` fallback** so a missing entry never
  breaks a screen. `ReadingScreen.jsx:26-36` documents this convention
  explicitly. Follow it.
- **Tests run in two lanes** (`frontend/vite.config.js:22-45`): a file named
  `*.browser.test.jsx` runs in a real Chromium via Playwright; everything else
  runs in the node lane. Component tests belong in the browser lane. The
  pattern to copy is `frontend/src/hooks/useDialog.browser.test.jsx:1-25`,
  which uses `render` from `vitest-browser-react`.

### Vocabulary (from `CONTEXT.md`)

- **Sentence** — the atom of analysis. Name new components after it; do not
  use "phrase" for anything new.
- **Token** — one morpheme as segmented.
- **Off-deck** — a Token in no app deck. Distinct from unknown.
- **Local tier** / **Deep tier** — analysis without / with a language model.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Install | `cd frontend && npm install` | exit 0 |
| Tests | `cd frontend && npm test` | all pass, both lanes |
| Lint | `cd frontend && npm run lint` | exit 0 |
| Build | `cd frontend && npm run build` | exit 0 |

## Scope

**In scope**:
- `frontend/src/components/analysis/` (create — files listed in Step 1)
- `frontend/src/screens/PhraseAnalyzerScreen.jsx` (delete the duplicated
  helpers, render the shared component)
- `frontend/src/screens/ReadingScreen.jsx` (same)
- `frontend/src/components/analysis/SentenceBreakdown.browser.test.jsx` (create)

**Out of scope** (do NOT touch):
- `frontend/src/index.css` — **no CSS changes at all**, including "tidying".
  Class names stay exactly as they are.
- The **behaviour** of either screen. Reading practice must still show one
  word card at a time with prev/next arrows and a jump-to-word line; the
  analyzer must still show a scrolling list of cards. That difference is
  deliberate and survives this plan as a prop, not a fork.
- `backend/` — nothing changes on the server.
- Furigana rendering, grammar chips, level badges, mining buttons and audio.
  Those are plans 016 through 020. This plan extracts what exists; it does not
  add. Resist this specifically — the new data is sitting right there in
  `tokens`.
- `ReadingScreen.jsx`'s `TierPicker`, session logic and everything above
  line 700.

## Git workflow

- Branch: `advisor/015-shared-analysis-components`
- Commit per step; conventional commits, e.g.
  `refactor(analysis): extract shared sentence breakdown`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Create the shared components

Create `frontend/src/components/analysis/` with:

- **`status.js`** — `STATUS_COLORS` and `wordColor`, moved verbatim from
  either screen (they are identical). No `STATUS_LABELS`.
- **`StatusBadge.jsx`** — the merged component: `ReadingScreen`'s translated
  label lookup (`t[`status_${status}`] ?? status`) **plus** the analyzer's
  `small` prop driving the `status-pill--sm` class.
- **`WordDetail.jsx`** — the slide-up detail panel, merged from the two
  `DetailPanel` implementations, with `Label` and `StatRow` as local helpers
  in the same file. Compare the two copies line by line and keep the union of
  their behaviour; where they genuinely differ, prefer `ReadingScreen`'s
  (it is the newer and the translated one) and note the difference in a
  comment.
- **`TokenCard.jsx`** — one Token's card, merged from `WordCard` and
  `BreakdownWordCard`.
- **`SentenceBreakdown.jsx`** — the composed view.

`SentenceBreakdown` takes: `analysis` (a `/api/phrase/analyze` response),
`t`, `layout` (`'list'` | `'stepper'`), `onTokenClick`, `onKanjiClick`, and for
the stepper layout `index` / `setIndex`.

`layout` is what lets one component serve both screens: `'list'` renders every
`TokenCard` in order (the analyzer's shape today); `'stepper'` renders the
jump-to-word line, prev/next arrows, one card at a time and the `n / total`
counter (reading practice's shape today). Everything else is shared.

Read `tokens`, not `words`. Where a token has no `meaning`, render nothing.

**Verify**: `cd frontend && npm run lint` → exit 0
**Verify**: `cd frontend && npm run build` → exit 0

### Step 2: Rewire `PhraseAnalyzerScreen.jsx`

Delete `STATUS_COLORS` (line 10), `STATUS_LABELS` (line 18), `wordColor`
(line 29), `Legend` (line 228), `WordCard` (line 241), `StatusBadge`
(line 287), `DetailPanel` (line 299), `Label` (line 371) and `StatRow`
(line 379). Import from `components/analysis/` instead and render
`<SentenceBreakdown layout="list" … />`.

Keep `Legend`'s rendered output — move it into the analysis directory as part
of `SentenceBreakdown` or as its own small component, but do not drop the
legend from the screen.

The screen's own concerns — the textarea, the Analyze button, the history list,
loading and error states — stay exactly as they are.

**Verify**: `cd frontend && npm run lint && npm test` → both pass
**Verify**: `grep -c "STATUS_LABELS" frontend/src/screens/PhraseAnalyzerScreen.jsx` → `0`

### Step 3: Rewire `ReadingScreen.jsx`

Delete `STATUS_COLORS` (line 16), `wordColor` (line 43), `AnalysisBreakdown`
(line 734), `BreakdownWordCard` (line 799), `DetailPanel` (line 900), `Label`
(line 978), `StatRow` (line 986) and `StatusBadge` (line 995). Render
`<SentenceBreakdown layout="stepper" index={…} setIndex={…} … />`.

`index`/`setIndex` stay owned by `ReadingScreen` — its comment at line 727
explains why (they reset to 0 whenever a new phrase is shown). Keep
`ChevronIcon` and `CardTransition` usage; move the arrow markup into the
stepper layout but keep importing `CardTransition` from
`components/study/CardTransition` rather than duplicating it.

**Verify**: `cd frontend && npm run lint && npm test && npm run build` → all pass

### Step 4: Confirm the duplication is gone

**Verify**: `cd frontend && grep -rn "function wordColor\|const STATUS_COLORS" src/` → exactly one match each, both in `src/components/analysis/status.js`
**Verify**: `cd frontend && grep -rn "function StatusBadge\|function StatRow\|function Label" src/screens/` → no matches

### Step 5: Test the shared component

Create `frontend/src/components/analysis/SentenceBreakdown.browser.test.jsx`,
modelled on `frontend/src/hooks/useDialog.browser.test.jsx:1-25` (import
`render` from `vitest-browser-react`; the file name's `.browser.` segment is
what routes it to the Chromium lane — see `frontend/vite.config.js:22-45`).

Build a fixture `analysis` object by hand rather than fetching. Cover:

- `layout="list"` renders one card per token
- `layout="stepper"` renders exactly one card, and `setIndex` is called when a
  word in the jump line is clicked
- a token **without** `meaning` renders without the string "undefined" anywhere
  in the output — this is the regression guard for the deep-tier-absent case,
  which is now the default
- `StatusBadge` renders the **translated** label: pass a `t` containing
  `status_mastered: 'TRANSLATED'` and assert that string appears, and that
  `'Mastered'` does not. This is the bug fix; without this test it can silently
  come back
- clicking a token with a `vocab_match` calls `onTokenClick`; clicking one
  without it does not

**Verify**: `cd frontend && npm test` → all pass, including the new browser tests

## Test plan

One new browser-lane test file, cases enumerated in Step 5.

The translated-label test is the one that matters most: it encodes the bug this
plan fixes, and the hardcoded-English version is an easy thing to reintroduce.

No backend tests change.

**Verification**: `cd frontend && npm test && npm run lint && npm run build` → all pass.

## Done criteria

ALL must hold:

- [ ] `cd frontend && npm test` exits 0 (both lanes)
- [ ] `cd frontend && npm run lint` exits 0
- [ ] `cd frontend && npm run build` exits 0
- [ ] `grep -rn "const STATUS_COLORS" frontend/src/` → exactly one match, in `components/analysis/status.js`
- [ ] `grep -rn "STATUS_LABELS" frontend/src/` → no matches
- [ ] `grep -rn "function StatusBadge\|function StatRow\|function Label" frontend/src/screens/` → no matches
- [ ] `git diff --stat frontend/src/index.css` → no changes
- [ ] Both screens still render their existing layouts (list for the analyzer, stepper for reading practice)
- [ ] `plans/README.md` status row for 015 updated

## STOP conditions

Stop and report back (do not improvise) if:

- `/api/phrase/analyze` does not return a `tokens` key. Plan 014 is a hard
  dependency; do not read `words` as a substitute and do not reshape the
  backend.
- `grep -n "status_mastered" frontend/src/locales/en/index.js` finds nothing —
  the translated-badge fix has no keys to use. Report it; adding locale keys is
  plan 016's job and the locale-parity test (commit `38bb4a3`) will fail if you
  add them to one side only.
- Merging the two `DetailPanel` copies reveals a behavioural difference you
  cannot resolve by taking `ReadingScreen`'s version. Report the difference
  rather than guessing.
- Either screen's layout visibly changes beyond the badge language. This plan
  must be invisible to a user apart from that one fix.
- You need to change `index.css` to make something render correctly. Stop —
  that means the extraction changed the DOM structure, which it should not.

## Maintenance notes

- **`layout` is the seam that keeps one component serving two shapes.** A third
  consumer (photo input, video subtitles) should add a layout or reuse one, not
  fork the component.
- **A reviewer should check** that no CSS changed, and that the `small` prop on
  `StatusBadge` survived the merge — it is easy to lose when taking
  `ReadingScreen`'s version wholesale.
- **Deliberately not done here**: furigana ruby, grammar chips, the level
  badge, mining buttons, audio. All are plans 016 through 020, and all land in
  `SentenceBreakdown` once, rather than twice.
- Plan 016 removes the deprecated `words` alias from the API once this plan has
  moved both screens onto `tokens`.
