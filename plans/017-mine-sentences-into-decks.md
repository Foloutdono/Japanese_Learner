# Plan 017: Let the analyzer mine words, kanji, grammar and cloze cards into decks

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat d4911a6..HEAD -- backend/routes/decks.py frontend/src/components/analysis frontend/src/screens/PhraseAnalyzerScreen.jsx`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW — additive; writes go through existing, tested endpoints
- **Depends on**: `plans/016-analyzer-local-first-and-sentence-bank.md` (hard)
- **Category**: direction
- **Planned at**: commit `d4911a6`, 2026-08-25

## Why this matters

The analyzer is a dead end. A learner pastes a sentence, sees exactly which
words they do not know, and then has no way to keep any of it. The next time
that word appears they look it up again.

Everything needed to fix this already exists on the server: the analysis
carries a `raw_id` for every matched word, kanji and grammar point, and
`routes/decks.py` already has endpoints for adding app cards and writing custom
ones. **This plan writes no new backend endpoint.** It is the missing button.

That turns the analyzer from a lookup tool into the app's acquisition funnel,
and it makes the i+1 signal from plan 016 actionable rather than merely
informative.

## Current state

### The endpoints that already do the work

**App cards** — `backend/routes/decks.py:858`, a batch insert:

```python
@router.post("/api/decks/{deck_id}/cards/app")
def add_app_cards(deck_id: str, payload: AddAppCardsPayload, user_id: str = Depends(get_user_id)):
```

Its payload is a list of `{source, level, raw_id}`. `source` is one of
`kanji`, `vocab`, `grammar`. Note its deliberate leniency, documented inline:
a card whose `source` is not allowed for the deck, or whose `raw_id` does not
resolve, is **skipped rather than erroring**, so a stale picker cannot break an
otherwise-valid batch. It returns `{"added": n}` — so `added` can legitimately
be less than what was sent, and the UI must read it rather than assume success.

**Custom cards** — `backend/routes/decks.py:671`:

```python
@router.post("/api/decks/{deck_id}/cards")
def add_card(deck_id: str, payload: CardPayload, user_id: str = Depends(get_user_id)):
```

with `CardPayload` at `decks.py:398`:

```python
class CardPayload(BaseModel):
    fields: dict = {}
    notes:  str = ""
    front:  str | None = None
    back:   str | None = None
```

### The constraint that shapes the whole feature

**A deck holds exactly one structure.** `backend/routes/decks.py:171`:

```python
REGISTRY_SOURCE_FOR_TYPE = {
    "standard": MODE_STANDARD,
    "kanji":    MODE_KANJI,
    "vocab":    MODE_VOCAB,
    "grammar":  MODE_GRAMMAR,
}
```

and `_allowed_sources(deck_type)` at `decks.py:179` returns the app sources a
deck browses — **empty for `standard`**.

Consequences the UI must respect:

- a mined **vocab** word can only go into a `vocab` deck;
- a mined **kanji** only into a `kanji` deck;
- a mined **grammar** point only into a `grammar` deck;
- a **cloze** card is a hand-written card and, because it is free text rather
  than a deck-source entry, belongs in a `standard` deck.

There is **no default deck** and **no cloze structure**. Do not add one — see
Scope.

### Deck creation

`backend/routes/decks.py:565` — `POST /api/decks` takes `{name, type}` and
validates `type` against `DECK_TYPES`.

### What the analysis already gives you

Per plans 013/014/016, every Sentence carries tokens with
`vocab_match: {level, raw_id, entry, stats}` and
`kanji_matches: [{kanji, level, raw_id, entry, stats}]`, plus a `grammar` list
of `{pattern, level, start, end, raw_id, stats}`. The `raw_id` and `level` are
exactly the two fields `add_app_cards` needs; `source` is implied by which list
the item came from.

### Repo conventions

- New locale keys go in **both** `frontend/src/locales/en/index.js` and
  `frontend/src/locales/fr/index.js`; the locale-parity test (commit `38bb4a3`)
  fails otherwise.
- Prefer `apiJson` / `apiJsonWithTimeout` from `frontend/src/lib/api.js` for
  new calls — `CLAUDE.md` says so explicitly, and they raise `ApiError` on
  non-2xx instead of silently returning a body with a missing key.
- Frontend component tests use the browser lane (`*.browser.test.jsx`).

### Vocabulary (from `CONTEXT.md`)

- **Mining** — turning something found in a Sentence into a Card: a word, a
  kanji, a grammar point, or a cloze built from the Sentence itself.
- **Card** — one studiable item, either an *app card* (a reference into the
  app's read-only decks by `raw_id`) or a *custom card* (content the user
  typed).
- **Deck** — holds exactly one structure.
- **i+1** — a Sentence with exactly one unknown Token.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Backend tests | `cd backend && pytest` | all pass |
| Frontend tests | `cd frontend && npm test` | all pass |
| Lint | `cd frontend && npm run lint` | exit 0 |
| Build | `cd frontend && npm run build` | exit 0 |

## Scope

**In scope**:
- `frontend/src/components/analysis/MineButton.jsx` (create)
- `frontend/src/components/analysis/DeckPicker.jsx` (create)
- `frontend/src/components/analysis/useMining.js` (create)
- `frontend/src/components/analysis/` — wiring the controls into the existing
  `TokenCard`, `WordDetail` and `GrammarChips`
- `frontend/src/locales/en/index.js` and `frontend/src/locales/fr/index.js`
- `frontend/src/components/analysis/useMining.browser.test.jsx` (create)

**Out of scope** (do NOT touch):
- `backend/` — **nothing at all**. Every write goes through the two existing
  endpoints. If you find yourself wanting a `/api/mining/*` route, stop: that
  is a signal you have misread `add_app_cards`'s batch shape.
- `backend/study/structures.py` — **do not add a cloze structure.** Nothing in
  the study-mode registry would know how to serve it, so a new structure would
  create cards that cannot be reviewed. A cloze is a `standard` card by
  convention.
- Deck study, review scheduling, or anything under `backend/srs/`.
- The Today queue — mined cards enter it through the normal deck path, with no
  special casing.

## Git workflow

- Branch: `advisor/017-mine-sentences-into-decks`
- Commit per step; conventional commits, e.g. `feat(analysis): mine words into decks`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Mining target resolution

Create `frontend/src/components/analysis/useMining.js`, a hook owning the
answer to "which deck does this go in".

It must:

- Fetch the learner's decks once via `GET /api/decks` (using `apiJson`).
- Expose `targetFor(kind)` where `kind` is `vocab` | `kanji` | `grammar` |
  `cloze`. It returns the remembered deck for that kind, or `null` when there
  is none yet.
- Map `kind` to the required deck `type`: `vocab`→`vocab`, `kanji`→`kanji`,
  `grammar`→`grammar`, `cloze`→`standard`. **Only offer decks of the matching
  type** — offering a deck the server will silently skip is worse than
  offering none, because `add_app_cards` returns `{"added": 0}` rather than an
  error and the learner would see nothing happen.
- Remember the last chosen deck per kind in `localStorage`, keyed per kind.
  Wrap every read and write in `try/catch`: a private window or blocked site
  data must degrade to "ask each time", never throw.
- Expose `ensureDeck(kind, name)` which creates a deck of the right type via
  `POST /api/decks` when none exists, and remembers it.
- Expose `mineApp({deckId, source, level, rawId})` posting a **single-element
  batch** to `POST /api/decks/{deckId}/cards/app`, and returning the server's
  `added` count.
- Expose `mineCloze({deckId, front, back, notes})` posting to
  `POST /api/decks/{deckId}/cards`.

**`added === 0` is not success.** Surface it distinctly — the card was already
in the deck, or the reference went stale. Do not show a success confirmation
for it.

**Verify**: `cd frontend && npm run lint` → exit 0

### Step 2: The mine control

Create `MineButton.jsx` — a small control rendered on `TokenCard`,
`WordDetail` and each entry of `GrammarChips`.

Behaviour:

- Disabled with an explanatory title when the item has no `raw_id` (an
  off-deck word cannot be mined as an app card).
- When no target deck is remembered for the kind, open `DeckPicker.jsx`:
  a list of the learner's decks **of the matching type only**, plus a
  "create one" affordance calling `ensureDeck`.
- After a successful mine, the control shows a persistent "in deck" state
  rather than reverting — the learner must be able to see at a glance what
  they have already taken from this Sentence.
- All copy comes from locale keys with inline `??` fallbacks.

Create `DeckPicker.jsx` as a simple overlay. Reuse the existing
`detail-overlay-sheet` / `detail-sheet` classes from `frontend/src/index.css`
rather than writing new CSS — plan 015 established that this feature area
styles itself from existing classes, and `index.css` is 15K+ lines with
documented cascade dependencies.

**Verify**: `cd frontend && npm run lint && npm run build` → both pass

### Step 3: Cloze from the Sentence

On each Sentence, add a **"make a cloze"** action per token that has a
`vocab_match`.

The card is built entirely client-side from data already present:

- `front` — the Sentence text with that token's span replaced by `＿＿＿`.
  Use the token's `start` and `end` offsets, which plan 013 guarantees are
  exact indices into the Sentence text. Do **not** string-replace the surface
  form: a word appearing twice would blank both occurrences.
- `back` — the token's `meaning` when the deep tier was bought, otherwise its
  `vocab_match.entry` meaning field, otherwise the surface plus reading. Never
  post an empty `back`; `add_card` rejects it via `missing_required` and the
  learner sees an opaque 400.
- `notes` — the original, unblanked Sentence, so the card carries its own
  context.

Target deck kind is `cloze` (a `standard` deck).

**Verify**: `cd frontend && npm test` → all pass

### Step 4: Make i+1 actionable

On a Sentence where `unknown_count === 1`, surface the single unknown token's
mine control prominently — that one word is the entire reason the Sentence is
worth studying. Wire it to the same `useMining` path; add no new mechanism.

**Verify**: `cd frontend && npm run lint && npm run build` → both pass

### Step 5: Locale keys

Add to **both** locale files, at minimum: `mineToDeck`, `inDeck`,
`alreadyInDeck`, `chooseDeck`, `createDeck`, `noDeckOfType`, `makeCloze`,
`clozeCreated`, `mineFailed`, `cannotMineOffDeck`.

**Verify**: `cd frontend && npm test` → the locale-parity test passes

### Step 6: Test

Create `frontend/src/components/analysis/useMining.browser.test.jsx`, modelled
on `frontend/src/hooks/useDialog.browser.test.jsx`. Stub `fetch`; do not hit a
real backend.

Cover:

- `targetFor` returns only decks whose `type` matches the kind — given a deck
  list containing one of each type, asking for `vocab` never offers the
  `kanji` deck
- `mineApp` posts a single-element `cards` array with the right `source`,
  `level` and `raw_id`
- a response of `{"added": 0}` is reported as "already there", not success
- a `localStorage` read that throws does not break the hook (simulate by
  stubbing `localStorage.getItem` to throw)
- cloze `front` blanks **only** the targeted span when the same surface form
  appears twice in the Sentence — the offset-vs-string-replace case
- a cloze whose `back` would be empty is not posted

**Verify**: `cd frontend && npm test` → all pass

## Test plan

One new browser-lane test file, cases in Step 6. The duplicate-surface cloze
case is the one most likely to be got wrong and least likely to be noticed:
string replacement looks correct on every sentence where the word appears once.

No backend tests change — this plan adds no backend code.

**Verification**: `cd frontend && npm test && npm run lint && npm run build`.

## Done criteria

ALL must hold:

- [ ] `cd frontend && npm test` exits 0, including the locale-parity test
- [ ] `cd frontend && npm run lint && npm run build` both exit 0
- [ ] `git diff --name-only backend/` → **empty**
- [ ] `grep -rn "api/mining" frontend/src/ backend/` → no matches
- [ ] Mining a word into a vocab deck makes it appear in `GET /api/decks/{id}/cards`
- [ ] A deck picker offering a mismatched deck type cannot be produced by any UI path
- [ ] Every new locale key exists in both `en` and `fr`
- [ ] `plans/README.md` status row for 017 updated

## STOP conditions

Stop and report back (do not improvise) if:

- `POST /api/decks/{id}/cards/app` returns `{"added": 0}` for a `raw_id` taken
  straight from a fresh analysis. That means the analysis and the deck registry
  disagree about id format — a real bug worth reporting, not worth working
  around in the UI.
- `add_card` rejects a cloze card built as described. Report the exact
  `detail` message; the fix is in the payload, not in `structures.py`.
- You conclude a new backend endpoint is needed. Re-read `add_app_cards`'s
  batch payload first; if you still conclude it, stop and report why.
- The learner has decks but none of a needed type and `POST /api/decks`
  rejects the type you send. Check it against `DECK_TYPES` and report.

## Maintenance notes

- **A cloze is a `standard` card by convention, not a structure.** If a real
  cloze structure is ever added, the study-mode registry has to learn to serve
  it first; this plan deliberately does not open that.
- **`added` may legitimately be less than sent.** `add_app_cards` skips rather
  than errors, by design and with a comment saying so. Any future bulk-mine
  feature must read the count too.
- **A reviewer should check** the cloze blanking uses offsets, not string
  replacement, and that deck pickers filter by type.
- **Deliberately deferred**: bulk mining ("add every unknown word in this
  Passage"). It is a natural next step and becomes trivial once this lands —
  `add_app_cards` is already a batch endpoint — but it needs its own thinking
  about how many cards a learner should be able to add in one press.
