# CONTEXT

Shared vocabulary for this codebase. A glossary and nothing else — no
implementation detail, no design decisions (those live in `docs/adr/`), no
task list (that lives in `plans/`).

When a term here has a definition, use it in code, comments, API fields and
UI copy. When you need a term that isn't here, add it.

---

## Content and study

**Card** — one studiable item. Either an *app card* (a reference into the
app's own read-only decks, identified by a `raw_id` from `kanji_to_id` /
`vocab_to_id` / `grammar_to_id`) or a *custom card* (content the user typed).
SRS progress attaches to the card, not to the deck, so a card in three decks
has one shared progress.

**Deck** — a user-owned collection of cards. Holds exactly **one** structure
(`decks.type`), so a deck of vocab cards cannot also hold cloze cards.

**Structure** — the field shape of a card: `standard`, `kanji`, `vocab`,
`grammar`. Defined in `study/structures.py`. Not the same as *mode*.

**Mode** — one way of studying a card (recognition, recall, writing…).
Progress is tracked per `(card, mode)` pair, which is why "do I know this
word" is answered by merging across every graded mode rather than picking one.

**Level** — ambiguous on its own; never use it bare.
- **JLPT level** — N5…N1. A property of content, and (once onboarding
  exists) of the learner.
- **XP level** — the gamification level from `srs/xp.py`. Unrelated to JLPT.

**Learner level** — the user's own JLPT level. Does **not** exist yet; a
future onboarding flow will set it, by self-declaration or a placement test.
Until then it is resolved per request. Always read it through the resolver
seam rather than assuming a constant — see `docs/adr/0005`.

---

## Analysis

**Passage** — what the user submits for analysis, as one act: typed text, a
photo, a video window, or a reading-practice phrase. A Passage has a
**source** naming where it came from. It is a container; it is not the unit
that gets explained.

**Sentence** — the atom of analysis. One Sentence is segmented, colour-coded,
graded, explained and mined as a unit. A Passage splits into one or more
Sentences. Everything the user acts on acts on a Sentence.

> Supersedes **phrase**. The word survives in existing table names
> (`phrase_history`, `phrase_analysis_cache`), the `/api/phrase/*` routes and
> the screen's UI title, because renaming those costs a migration and buys
> nothing visible. Do not use "phrase" for anything new.

**Token** — one morpheme of a Sentence as the analyzer segments it: surface,
position, dictionary form, reading, part of speech. A Token may or may not
resolve to a Card.

**Local tier** — the analysis computable without a language model:
segmentation, readings, furigana, deck matches, SRS status, grammar points,
JLPT grading. Instant, free, works offline and with no provider configured.

**Deep tier** — the analysis that requires a language model: the contextual
gloss of each word *in this sentence*, and the prose explanation. Bought
explicitly, per Sentence, never automatically. See `docs/adr/0001`.

**Off-deck** — a Token that resolves to no card in any app deck: a proper
noun, JMdict-only vocabulary, slang. Distinct from *unknown*. The app cannot
teach an off-deck word, so it is never counted as something the learner has
failed to learn.

**Unknown** — a Token that resolves to a card the learner has not learned:
content-word part of speech, status `not_started` or `new`. Particles and
auxiliaries are never unknown. Off-deck tokens are never unknown.

**i+1** — a Sentence with exactly one unknown Token: comprehensible except
for a single step. The highest-value thing to study, and the signal the
Sentence bank is sorted by.

**Mining** — turning something found in a Sentence into a Card: a word, a
kanji, a grammar point, or a cloze built from the Sentence itself.

**Sentence bank** — the learner's collection of kept Sentences, with their
provenance. Stores the text, not a frozen analysis — badges are re-derived on
open so they always reflect current SRS state. See `docs/adr/0002`.

---

## Video

**Cue** — one timed caption unit: a start time, an end time, and text.
The unit a subtitle *file* is made of. Cue boundaries are a display artifact
and do **not** correspond to Sentence boundaries.

**Track** — an ordered list of Cues from one source: a fetched YouTube
caption track, or an uploaded `.srt` / `.vtt` / `.ass` file. The pipeline is
source-agnostic; nothing downstream knows which it was. See `docs/adr/0003`.

**Window** — the bounded time range of a video a learner asks to analyze.
Bounded on purpose: analysis cost scales with it.
