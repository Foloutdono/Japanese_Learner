# 0001 — Sentence analysis is two-tiered, local first

- **Status**: accepted
- **Date**: 2026-08-25

## Context

Sentence analysis began as one LLM call per phrase: segment the sentence,
gloss each word, explain the grammar. `routes/phrase.py` still works that
way, and reading practice fires it in the background for every phrase it
shows.

Three things made that shape untenable:

1. **It is the only path.** With no provider configured — or during the
   2026-08 OpenRouter outage that took down exams, reading comprehension and
   phrase analysis at once — the analyzer shows nothing at all. Yet the
   backend already owns a real morphological analyzer (`study/morphology.py`,
   MeCab/UniDic), a 205-point levelled grammar catalogue with a matcher, a
   three-gate JLPT difficulty grader, and per-kanji furigana alignment. None
   of it was reachable from the analyzer.
2. **The model's segmentation is unverified.** The LLM proposes word
   boundaries with nothing checking them, while `find_segments_in_text` does
   the same job against a real tokenizer for reading practice. Two different
   truths for one question.
3. **New input surfaces multiply the call count.** A photo of a page is ~10
   sentences; a five-minute video window is ~100. At one model call each,
   neither feature is affordable.

The observation that resolves it: **everything except the contextual gloss
and the prose explanation is computable locally.** Segmentation, readings,
furigana, deck matches, SRS status, grammar points and JLPT grading need no
model at all.

## Decision

Split analysis into two tiers.

The **local tier** is the default and is user-independent + pure. It composes
existing modules and adds no new inference. It is instant, free, offline, and
works with no LLM provider configured.

The **deep tier** adds the contextual gloss and the prose explanation. It is
bought **explicitly, per Sentence** — never automatically, never for a whole
Passage at once. Its output is merged **onto** the local tokens rather than
replacing them, which makes the model's segmentation checkable: a word the
tokenizer does not confirm is dropped rather than shown.

The API expresses this as `deep: bool = False`. The default path makes no
model call and returns no 503 when no provider exists.

## Consequences

- The analyzer answers instantly and degrades to "no explanation" rather than
  "no analysis" when the LLM is unavailable.
- Reading practice's eager background pre-fire becomes free, so it can stay
  eager.
- Photo and video input become affordable, because their default cost is zero.
- Cost moves from per-sentence-shown to per-sentence-the-user-asked-about.
- The existing `phrase_analysis_cache` now caches only the deep half, which is
  what it was already doing — the split it assumed is now explicit.
- Two code paths must agree on token shape. The deep tier merging onto local
  tokens (rather than the reverse) is what keeps them from drifting.

## Alternatives considered

**Keep LLM-first, add caching.** Already done, and insufficient: the cache
only helps the second reader of the same sentence, and uncurated photo/video
text is almost never a repeat.

**Local tier only, drop the LLM.** The contextual gloss is genuinely the most
valuable part for a learner — "what does this word mean *here*" is exactly
what a dictionary cannot answer. Dropping it would gut the feature.

**Auto-deepen in the background after rendering locally.** Preserves today's
behaviour and feels fast, but keeps paying for every sentence the learner only
glanced at. Rejected for the video case, where that is 100 sentences per
session.

---

## Amendment, 2026-10-16 — a video's lines are translated a block at a time (plan 235)

The owner asked for a translation under every line of a video. Since plan 161 a
line's translation came with its deep tier, so a translation under every line
would have been the background auto-deepening this ADR rejects, at one call a
line.

**A translation is not the deep tier.** It is a third thing, asked for a block of
20 lines in one call (`study/line_translate.py`) as the learner reaches them,
with the two lines either side and the video's title as context, and kept on the
session by the line's text (`video_sessions.translations`), so a chorus or a
second viewing costs nothing. That is about a twentieth of the calls auto-deepening
would make, and the translation is better for it: a line that is half a sentence
is read as the half it is. It is rationed (`LINE_TRANSLATION_DAILY_LIMIT` blocks a
day, `core/daily_limit.py`) and costed (`scripts/llm_cost_model.py`,
`line_translation`). A typed or photographed Passage the analyser saved is
translated the same way, its sentences kept on its `phrase_history` row; one
saved nowhere still has its translation only from Explain.

**The deep tier of a video's line is asked where the line stands.** Explained
alone, a line like みなさんがいてくれるので、 was explained as a sentence of its own.
Its explanation is now asked with the video's title and channel (read off the
player; the server never fetches them), the line's place and time, and the two
lines either side (`routes/phrase.deep_context`), and cached under a key that
includes that context. A typed Passage's sentence is asked the same way, with the
two sentences either side of it (`passage_context`), and found again under that
key when the Passage is reopened -- or, bought before, under the plain one. The
phrase alone keeps its old key, and a Passage of one sentence is asked as the
sentence alone, so the reading bank's cached explanations are untouched.

---

## Amendment, 2026-10-17 — the explanation is the construction (plan 242)

With a translation under every line (plan 235), and the video's own where it has
one (ADR 0003, same day), the owner: *"the explain button is only for the
explanation of how the sentence is built."* The deep tier's explanation had been
asked for "the grammar and nuance of the whole phrase", and came back opening on
a paraphrase of the meaning and closing on its tone.

It is now asked for how the phrase is built and nothing else: what its predicate
is and what it is said of, what modifies or completes what, how each conjugated
or combined form is put together and what each part adds, the Japanese pieces
quoted; never a restatement of what the phrase says, and a nuance named only
where a form carries it. Asked where the line stands, it says so when the
construction runs across lines (a clause left open, a subject carried over). The
schema is unchanged -- `translation` still comes with the deep tier, for the
callers that have no other -- and `CACHE_VERSION` is 6, so no explanation bought
under the old prompt is served again.
