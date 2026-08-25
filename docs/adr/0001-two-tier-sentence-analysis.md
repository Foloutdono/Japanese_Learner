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
