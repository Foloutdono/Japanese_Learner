# Plan 013: Build the local analysis tier — full sentence breakdown with no LLM call

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat d4911a6..HEAD -- backend/study/card_lookup.py backend/study/difficulty.py backend/study/morphology.py backend/study/furigana.py`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW
- **Depends on**: `plans/012-learner-level-resolver.md`
- **Category**: direction
- **Planned at**: commit `d4911a6`, 2026-08-25

## Why this matters

Sentence analysis in this app currently requires a language model. One LLM call
per sentence produces the word breakdown, and without a provider the analyzer
shows nothing at all.

That is unnecessary. The backend already owns a real morphological analyzer, a
205-point levelled grammar catalogue with a matcher, a three-gate JLPT
difficulty grader, and per-kanji furigana alignment. **Everything except the
contextual gloss and the prose explanation is computable locally** — instantly,
free, offline.

This plan builds that local tier as one pure function. It changes no API and no
screen; it is the foundation the rest of the wave consumes. Once it exists, an
analyzer that answers instantly, a photo of a page, and a five-minute video
window all become affordable, because their default cost drops to zero.

Read `docs/adr/0001-two-tier-sentence-analysis.md` before starting. Its
load-bearing points are inlined below.

## Current state

### What exists and is reusable

Five modules already do the work. This plan **composes** them; it must not
reimplement any of them.

`backend/study/morphology.py:146` — the tokenizer output:

```python
@dataclass
class Morpheme:
    surface: str
    start: int
    end: int
    lemma: str
    reading: str        # hiragana reading of `surface`, as inflected
    lemma_reading: str  # hiragana reading of `lemma` (dictionary form)
    pos: str
    auxiliary_use: bool  # True when UniDic marks this token's usage as
    # grammaticalized/non-independent (pos2 == 非自立可能)
```

`backend/study/morphology.py:180` — `tokenize(text) -> list[Morpheme] | None`.
It returns **None** when the analyzer is unavailable (fugashi/unidic-lite not
installed) or when a call fails. Its docstring says: *"Callers must have a
fallback path for the None case."* Honour that.

`backend/study/card_lookup.py:448` and `:463` — the two resolvers that turn a
morpheme into a deck entry. These are exactly the right functions; they are
currently private:

```python
def _resolve_lemma(lemma: str, reading: str):
    """(level, entry, raw_id) for the deck entry whose kanji field is
    `lemma`, disambiguated by `reading` when several entries share that
    lemma text (see _index_vocab_by_lemma), or None."""

def _resolve_kana(reading: str, pos: str, auxiliary_use: bool):
    """Fallback for when lemma-TEXT matching finds nothing..."""
```

`backend/study/card_lookup.py:507-533` shows the exact sequence to follow —
two-token merge first, then lemma, then kana fallback:

```python
        if i + 1 < len(morphemes):
            m2 = morphemes[i + 1]
            merged = m.surface + m2.surface
            hit = _resolve_lemma(merged, "")
            if hit:
                ...
                i += 2
                continue

        hit = _resolve_lemma(m.lemma, m.lemma_reading) or _resolve_kana(m.lemma_reading, m.pos, m.auxiliary_use)
```

`backend/study/card_lookup.py:206` — `card_stats(states, user_id, raw_id, modes)`
returns the full per-card SRS dict (`status`, `total_reviews`,
`correct_reviews`, `accuracy`, `due`, `interval_days`, `next_review`). The
`modes` argument comes from these module-level constants at
`card_lookup.py:34-36`:

```python
VOCAB_STATUS_MODES = STATUS_MODES[VOCAB]
KANJI_STATUS_MODES = STATUS_MODES[KANJI]
KANA_STATUS_MODES = STATUS_MODES[KANA]
```

`backend/study/furigana.py:208` — `align_deck(text, reading) -> list[dict]`,
each part `{"text": ..., "reading": ...}`. It degrades to a single unreadinged
part rather than raising.

`backend/study/difficulty.py:391` — `report(sentence, level, segments=None, allow_kanji="")`
returns `{"ok": bool, "kanji": [...], "grammar": [...], "vocab": [...], "too_long": int | None}`.

`backend/study/difficulty.py:54` — `LEVELS = ("N5", "N4", "N3", "N2", "N1")`,
easiest first.

`backend/study/difficulty.py:288` — the point index this plan builds on:

```python
@lru_cache(maxsize=1)
def _checkable_points() -> list[tuple[str, str, tuple[str, ...]]]:
    """(level, pattern, stems) for every catalogue point a substring test
    can honestly check."""
```

and `backend/study/difficulty.py:334`:

```python
def _spans(sentence: str, needles: tuple[str, ...]) -> list[tuple[int, int]]:
    """Every (start, end) at which any of `needles` occurs."""
```

and `backend/study/difficulty.py:307`:

```python
def _distinctive(stem: str) -> bool:
    """Whether finding `stem` in a sentence is evidence of its pattern.
    A two-character all-hiragana stem is not."""
```

`backend/content/grammar_points_data.py:31`:

```python
def grammar_to_id(entry: dict, level: str) -> str:
    return f"grammar_{level}_{entry['pattern']}"
```

### The gap this closes

`backend/study/card_lookup.py:25-33` is an explicit invitation, left by whoever
removed grammar lookup in 2026-08:

> NOTE (2026-08): grammar-point lookup (GRAMMAR_STATUS_MODE, the old
> `_grammar_hits`/`_index_grammar_by_surface` machinery) was removed
> entirely — segmentation for both the phrase analyzer and reading
> practice is now mostly AI-driven [...] **If per-grammar-point SRS
> tracking is wanted again later, it belongs in the AI segmentation
> result, not resurrected here.**

This plan takes that up. Note the constraint: the new grammar lookup goes in
the **new analysis module**, not back into `card_lookup.py`'s old machinery.

### Repo conventions this must match

- **Comments carry reasoning, not restatement.** Every non-obvious choice gets
  a comment explaining why, including what was rejected. See
  `backend/study/card_lookup.py:65-97` (the boundary-safety block) or
  `backend/study/furigana.py:1-33` for the house style. A plain restatement of
  the code is not acceptable here.
- **Tests are `unittest.TestCase` classes under pytest**, with a class
  docstring stating the property under test. See
  `backend/tests/test_furigana.py:1-35`.
- **Pure, user-independent logic stays separate from per-user enrichment.**
  `backend/routes/phrase.py:218` already draws that line for its cache:
  *"The model's own words/explanation only. Everything below this line is
  per-user (SRS state) and is recomputed on a cache hit."* Keep it.

### Vocabulary to use (from `CONTEXT.md`)

The executor has not read that file. Use these terms exactly in names,
docstrings and JSON keys:

- **Sentence** — the atom of analysis. Supersedes "phrase" in all new code.
- **Token** — one morpheme as segmented: surface, position, dictionary form,
  reading, part of speech. May or may not resolve to a Card.
- **Local tier** — the analysis computable without a language model.
- **Off-deck** — a Token that resolves to no card in any app deck (proper
  noun, JMdict-only vocabulary, slang). The app cannot teach it, so it is
  never counted as something the learner failed to learn.
- **Unknown** — a Token that resolves to a card the learner has not learned:
  content-word part of speech, status `not_started` or `new`. Particles and
  auxiliaries are never unknown. Off-deck tokens are never unknown.
- **i+1** — a Sentence with exactly one unknown Token.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Install | `cd backend && pip install -r requirements.txt` | exit 0 |
| Tests (all) | `cd backend && pytest` | all pass |
| Tests (this) | `cd backend && pytest tests/test_analysis.py tests/test_difficulty_points.py -v` | all pass |
| Tokenizer available? | `cd backend && python -c "from study.morphology import MORPHOLOGY_AVAILABLE; print(MORPHOLOGY_AVAILABLE)"` | prints `True` |

## Scope

**In scope**:
- `backend/study/analysis.py` (create)
- `backend/study/difficulty.py` (add two public functions — Step 1 only)
- `backend/study/card_lookup.py` (add `GRAMMAR_STATUS_MODES`; make two
  resolvers public — Step 2 only)
- `backend/tests/test_analysis.py` (create)
- `backend/tests/test_difficulty_points.py` (create)

**Out of scope** (do NOT touch, even though they look related):
- `backend/routes/phrase.py` — the API reshape is plan 014. This plan adds no
  endpoint and changes no route. If you feel the urge to wire this up, stop.
- `backend/study/card_lookup.py`'s `find_segments_in_text`,
  `_find_segments_morphological`, `_find_segments_legacy` and
  `_assemble_segments` — reading practice's scan path. Leave the segment shape
  alone; this plan produces a **different** shape for a different consumer.
- `backend/study/morphology.py` and `backend/study/furigana.py` — consume
  them, do not modify them.
- `frontend/` — nothing on the client changes in this plan.

## Git workflow

- Branch: `advisor/013-local-analysis-tier`
- Commit per step; conventional commits scoped by area, e.g.
  `feat(analysis): add local-tier sentence analysis`. See `git log` for the
  house style.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Add two public functions to `difficulty.py`

`difficulty.py` currently answers only *"does this Sentence fit level X"* — a
gate. The analyzer needs it to also answer *"what level is this"* and *"which
grammar points are present"*. Both are small compositions of code already
there.

Add `points_in(sentence: str) -> list[tuple[str, str, int, int]]` returning
`(pattern, level, start, end)` for **every** catalogue point that occurs, at
any level — not just above-level ones.

Requirements:

- Build on `_checkable_points()` and `_spans()`. Do not write a new matcher.
- **Apply `_distinctive()` to every point**, not only above-level ones.
  Today `grammar_over_level` applies it exclusively to the above-level branch
  (`difficulty.py:369`). Uncurated text — OCR output, auto-generated video
  captions — makes the false-positive rate visible, and a two-character
  all-hiragana stem is not evidence. Comment this choice.
- **Exclude `_extra_points()`.** Those are `EXTRA_MARKERS`
  (`difficulty.py:251`), not catalogue entries — they have no grammar card and
  therefore no `raw_id`. Including them would produce chips that cannot link
  anywhere. Comment why they are absent.
- Sort by `start`, then by longer span first, so a caller rendering underlays
  gets a stable order.

Add `estimate_level(sentence: str, segments=None) -> str | None` returning the
**lowest** member of `LEVELS` for which `report(sentence, level, segments)["ok"]`
is true, or `None` when the Sentence fits no level. Iterate `LEVELS` in order
and return the first match; do not re-derive the ordering.

**Verify**: `cd backend && python -c "from study.difficulty import points_in, estimate_level; print(estimate_level('私は学生です。')); print(points_in('食べようとしました'))"`
→ prints a level string (or `None`) on the first line and a list of tuples on
the second, without raising

### Step 2: Restore grammar SRS modes and publish the two resolvers

In `backend/study/card_lookup.py`:

1. Add `GRAMMAR_STATUS_MODES = STATUS_MODES[GRAMMAR]` next to the three
   existing constants at line 34, importing `GRAMMAR` from `study.modes`
   alongside the existing `KANA, KANJI, VOCAB` import.
2. Rename `_resolve_lemma` to `resolve_lemma` and `_resolve_kana` to
   `resolve_kana`, updating their two call sites inside
   `_find_segments_morphological` (`card_lookup.py:518` and `:527`). These are
   now part of the module's public surface because `analysis.py` uses them.
   Keep the docstrings exactly as they are.

Do **not** re-add the removed `_grammar_hits` / `_index_grammar_by_surface`
machinery. The 2026-08 note quoted above is explicit that grammar lookup
belongs in the new analysis result, not back here.

**Verify**: `cd backend && pytest` → all pass (this is a pure rename plus a
constant; nothing should break)
**Verify**: `cd backend && grep -rn "_resolve_lemma\|_resolve_kana" backend/ --include=*.py` → no matches

### Step 3: Create `backend/study/analysis.py`

Two functions, and the split between them is the point.

```python
def analyze_local(text: str, level: str | None = None) -> dict:
    """Everything about a Sentence that needs no language model.
    Pure and user-independent, therefore cacheable and shareable."""

def attach_user_state(analysis: dict, states: dict, user_id: str) -> dict:
    """Add per-learner SRS stats to an analyze_local result."""
```

`analyze_local` returns:

```python
{
  "text": str,
  "tokens": [
    {
      "surface": str, "start": int, "end": int,
      "lemma": str, "reading": str, "pos": str,
      "furigana": [{"text": str, "reading": str | None}],
      "vocab_match": {"level": str, "raw_id": str, "entry": {...}} | None,
      "kanji_matches": [{"kanji": str, "level": str, "raw_id": str, "entry": {...}}],
    },
  ],
  "grammar": [{"pattern": str, "level": str, "start": int, "end": int, "raw_id": str}],
  "level": str | None,          # estimate_level result
  "grade": {...},               # difficulty.report against `level`
  "available": bool,            # False when the tokenizer is unavailable
}
```

Implementation requirements:

- **Tokenize once** with `morphology.tokenize`. When it returns `None`, return
  a well-formed result with `"available": False`, `"tokens": []` and the
  original text — never raise, never fall back to the legacy substring scan.
  Callers render "analysis unavailable"; they do not get a worse analysis
  silently.
- **Resolve each token** using the exact sequence from
  `card_lookup.py:507-533` quoted above: two-token merge, then
  `resolve_lemma(m.lemma, m.lemma_reading)`, then
  `resolve_kana(m.lemma_reading, m.pos, m.auxiliary_use)`. Do not invent a
  different order — that sequence encodes real lessons about homographs and
  auxiliary verbs.
- **Furigana** per token via `furigana.align_deck(m.surface, m.reading)`.
  Use `reading` (the inflected reading), not `lemma_reading` — the furigana
  goes over the surface as written.
- **Kanji matches** per token via `card_lookup.find_kanji_matches(m.surface)`,
  mapped to the dict shape above with `serializable_entry`.
- **Grammar** from `difficulty.points_in(text)`. For each hit, look the entry
  up in `GRAMMAR_POINTS_BY_LEVEL[level]` by its `pattern` field and call
  `grammar_to_id(entry, level)`. **Never construct the id string by hand** —
  duplicating the `grammar_{level}_{pattern}` format is how it drifts. If no
  entry is found for a hit, drop the hit and log at debug; do not emit a chip
  with no card behind it.
- **`level`** from `estimate_level`. **`grade`** from
  `difficulty.report(text, level_for_grading)` where `level_for_grading` is
  the `level` argument when given, else the estimate, else `"N5"`.
- `analyze_local` must not touch the database, read `user_id`, or import
  anything from `core/`. That is what makes it cacheable.

`attach_user_state` walks the result and adds a `"stats"` key to every
`vocab_match`, every entry of `kanji_matches`, and every `grammar` entry,
using `card_stats(states, user_id, raw_id, modes)` with `VOCAB_STATUS_MODES`,
`KANJI_STATUS_MODES` and `GRAMMAR_STATUS_MODES` respectively. It also adds two
top-level counts:

- `"unknown_count"` — Tokens whose `vocab_match` exists, whose `pos` is one of
  `noun`, `verb`, `adjective`, `adverb`, and whose stats `status` is
  `not_started` or `new`.
- `"off_deck_count"` — Tokens with **no** `vocab_match` and no
  `kanji_matches`, whose `pos` is one of those same content-word classes.

The distinction is load-bearing and must be commented: an off-deck word is not
something the learner failed to learn, it is something the app cannot teach.
Counting it as unknown would make every real-world Sentence — every photo,
every video caption — look impossible, and would make the i+1 signal
permanently false.

`attach_user_state` must return a new dict and must not mutate its argument:
`analyze_local`'s result is cacheable and shared between learners.

**Verify**: `cd backend && python -c "from study.analysis import analyze_local; r = analyze_local('私は毎日日本語を勉強しています。'); print(r['available'], len(r['tokens']), r['level'], [g['pattern'] for g in r['grammar']])"`
→ prints `True`, a token count above 5, a level string, and a list

### Step 4: Test `points_in` and `estimate_level`

Create `backend/tests/test_difficulty_points.py`.

Cover:

- `estimate_level` on a plainly N5 sentence returns `"N5"`
- `estimate_level` returns a harder level for a sentence containing an
  above-N5 grammar point, and the result is a member of `LEVELS` or `None`
- `points_in` finds a known catalogue point in a sentence that plainly uses it
  (pick one from `backend/content/grammar_points.json` with a distinctive,
  non-hiragana-only stem, and assert on that pattern by name)
- `points_in` returns spans that are valid indices into the sentence
  (`0 <= start < end <= len(sentence)`) and that `sentence[start:end]` is
  non-empty
- every `pattern`/`level` pair returned by `points_in` resolves to an entry in
  `GRAMMAR_POINTS_BY_LEVEL` — this is the invariant `analysis.py` depends on
- `points_in` on a sentence with no grammar (a bare noun, e.g. `犬`) returns
  an empty list
- results are sorted by `start`

### Step 5: Test `analyze_local` and `attach_user_state`

Create `backend/tests/test_analysis.py`, modelled on
`backend/tests/test_furigana.py`'s structure.

Cover:

- **Shape**: every key in the documented return shape is present, with the
  right type, for a normal sentence
- **Segmentation**: `私は学生です。` yields tokens whose `surface` values
  concatenate back to the original text exactly, and whose `start`/`end`
  offsets are contiguous and cover the whole string. This is the single most
  valuable assertion in the file — it catches offset bugs that silently
  corrupt every downstream highlight
- **Furigana**: a token containing a kanji compound (e.g. 大学) has more than
  one furigana part
- **Deck matching**: a common N5 word resolves to a `vocab_match` with a
  `raw_id`
- **Grammar**: a sentence using a distinctive catalogue point produces a
  `grammar` entry whose `raw_id` starts with `grammar_`
- **Purity**: calling `analyze_local` twice on the same text returns equal
  results, and `attach_user_state` does not mutate the dict it is given
  (assert the original has no `stats` key afterwards)
- **Unavailable path**: monkeypatch `study.analysis`'s `tokenize` to return
  `None` and assert the result has `available is False`, `tokens == []`, and
  still carries `text` — and that it does not raise
- **Unknown vs off-deck**: with a hand-built `states` dict, a content word
  with no deck match increments `off_deck_count` and **not** `unknown_count`;
  a particle with no match increments neither

For `attach_user_state`, build the `states` dict by hand rather than hitting
the database — `card_stats` reads `states.get((f"{user_id}:{raw_id}", mode))`,
so a literal dict is enough. Mirror `test_furigana.py`'s `_FAKE` deck approach:
test against known inputs, not against whatever the real deck holds.

**Verify**: `cd backend && pytest tests/test_analysis.py tests/test_difficulty_points.py -v`
→ all pass

### Step 6: Confirm nothing else regressed

**Verify**: `cd backend && pytest` → all pass, with the new tests included

## Test plan

Two new files, cases enumerated in Steps 4 and 5, both following
`backend/tests/test_furigana.py`'s structure (a `unittest.TestCase` subclass
with a class docstring naming the property under test).

The offset-contiguity assertion in Step 5 is the one to get right: every later
plan in this wave renders highlights, ruby and click targets from those
offsets, so an off-by-one here becomes a visible defect in four screens.

**Verification**: `cd backend && pytest` → all pass.

## Done criteria

ALL must hold:

- [ ] `cd backend && pytest` exits 0
- [ ] `backend/study/analysis.py` exists and exports `analyze_local` and `attach_user_state`
- [ ] `cd backend && pytest tests/test_analysis.py tests/test_difficulty_points.py -v` → all pass
- [ ] `grep -rn "_resolve_lemma\|_resolve_kana" backend/ --include=*.py` → no matches
- [ ] `grep -n "GRAMMAR_STATUS_MODES" backend/study/card_lookup.py` → one definition
- [ ] `grep -rn "grammar_{" backend/study/analysis.py` → no matches (the id is never hand-built)
- [ ] `grep -rn "from core" backend/study/analysis.py` → no matches (`analyze_local` stays pure)
- [ ] `git diff --name-only` lists only the five in-scope files
- [ ] `plans/README.md` status row for 013 updated

## STOP conditions

Stop and report back (do not improvise) if:

- `python -c "from study.morphology import MORPHOLOGY_AVAILABLE; print(MORPHOLOGY_AVAILABLE)"`
  prints `False`. The whole tier depends on the tokenizer; without it the
  tests cannot be meaningful. Report it rather than writing tests that pass
  vacuously.
- `_checkable_points()` or `_spans()` at the cited lines do not match the
  excerpts above.
- Making `points_in` work seems to require editing `grammar_match.py` or
  `content/grammar_points.json`. It does not; report what you found.
- The offset-contiguity test fails and the cause appears to be inside
  `morphology.tokenize`. That is out of scope — report it with the failing
  input rather than patching the tokenizer.
- More than roughly 15% of `points_in` results fail to resolve to a catalogue
  entry in the Step 4 invariant test. That means the pattern-to-entry lookup
  is wrong, not that the data is dirty; report before adding a workaround.

## Maintenance notes

- **`analyze_local` must stay pure.** It has no database access, no `user_id`,
  and no `core/` imports precisely so its result can be cached once and shared
  across every learner. A reviewer should reject any change that adds one.
- **The unknown / off-deck distinction is a product decision**, recorded in
  `CONTEXT.md`. If the counts ever start looking wrong, check that definition
  before changing the code.
- **`_distinctive` now applies to all points**, which is stricter than
  `grammar_over_level`'s behaviour. If a legitimate point stops being detected,
  that is the first place to look — and the fix is probably to give the point a
  better stem in the catalogue, not to relax the filter.
- Plan 014 consumes this to reshape `/api/phrase/analyze`; plans 015 through
  020 consume that. The token shape defined here is the contract for the whole
  wave — changing it later is expensive.
