# 0015 — Generated text is gated on its level mix, and written around its grammar

- **Status**: accepted
- **Date**: 2026-09-13

## Context

Reading comprehension (`/practice/comprehension/:level`) is the one place a
learner reads text a model wrote for them at a level they chose. Until this
decision the generator (`routes/reading.py`) asked for that level in one
paragraph of prose and a pasted kanji list, parsed what came back, and served
it. Nothing measured the text afterwards. Two things followed, both observed
while testing on 2026-09-13:

- **The texts revolved around the same two or three grammar points.** は and
  the て-form at every level, because a model asked for "N5 grammar" reaches
  for the commonest N5 grammar every time. The catalogue
  (`content/grammar_points.json`) teaches seventy-one points a level, and
  nothing here ever asked for the other sixty-eight.
- **Nothing stopped an N5 text from using N3 words.** The exam generators
  already validate their passages (`study/exam_validation.py`) and already
  retry with the failure fed back (`study/exam_reading_gen.py`), and
  `study/difficulty.py` already grades a sentence's kanji, grammar and
  vocabulary against a level. None of it was wired into comprehension.

The app also already had two halves of a good breakdown and no whole: the
analyzer's local tier (`study/analysis.py`: furigana, tokens, deck matches,
grammar spotted) and the comprehension model's per-sentence translation and
note. The practice modes drew three different breakdowns from these — a
one-word-at-a-time carousel in reading and dictation, a translation-and-note
list in comprehension, nothing in translation practice.

## Decision

### The model proposes, the code decides

A comprehension exercise is asked for **around three grammar points and six
words of the level**, drawn at random per request and formatted the way the
exam generators already format their seeds. A point the learner met in their
last five exercises is avoided when the pool allows (`comprehension_log.grammar`
records what each exercise was written around). Only points a substring test
can honestly find are ever asked for (`grammar_match.verifiable`, minus
`difficulty.GATE_BLIND`): asking for 「は」 and being told it was used proves
nothing.

The text is then **measured** (`study/level_mix.py`), and each measurement has
its own consequence, chosen by what it costs the learner:

| what | rule | on a retry | on the last attempt |
|---|---|---|---|
| vocabulary above the level | more than one word in twenty | fed back, asked again | **the exercise is refused (502)** |
| kanji above the level | more than one in twenty | softened to kana, never retried alone | softened to kana |
| a seed point missing | `contains_pattern` | fed back, asked again | accepted; only the points found are claimed |
| the breakdown drifts from the text | concatenation, whitespace aside | fed back, asked again | the breakdown wins |
| grammar above the level, length | — | feedback only | ignored |

Vocabulary is the one hard gate because it is the one that makes a text
unreadable at its level and has no repair. Kanji has a repair — a real N5
text writes a kanji the learner has not met in kana — and at N5 no natural
paragraph passes a kanji gate first time (a 103-character set; measured ~40%
of occurrences out of level), so retrying on kanji alone would be a
two-minute call under a spinner for nothing. The breakdown wins a drift
because it is what the learner opens, and every sentence of it is analysed
as written.

### The vocabulary ratio is `difficulty.vocab_over_level`'s count, deliberately

Counting each token's own deck level reports a plain N5 paragraph as a third
over-level: the tokenizer cuts 七時, 日本語 and 図書館 into pieces the deck
files at N3 and N4, and する resolves to its kanji spelling 為る, filed at N3.
`vocab_over_level`'s exclusions — a kana-only segment, a one-character
segment, a segment that splits into easier words, the stem of an easier
verb — are exactly the guards the ratio needs. Words the deck does not know at
all are **named in the feedback and never counted**: the deck is eight
thousand words, not a language.

### One breakdown, drawn from the analyzer

Every practice mode now draws the same breakdown (`SentenceBreakdown`'s
`rows` layout): the sentence as a ruby line with the SRS state under each
word, its translation, **one row per word** — surface, reading, what it does
in this sentence, its level — and the note last, in the quiet register. The
comprehension result stacks the passage's sentences and opens one at a time
(`PassageBreakdown`). Translation practice, which had no breakdown, prefetches
the reference's the way reading practice does.

The rows are words, not morphemes. A model glosses 会いました as one word and
the tokenizer cuts it into three, so `merge_deep` now binds a gloss to the
run of tokens whose surfaces concatenate to it (`span_end`), and the rows fold
a run — or a verb with its polite ending — back into the word a learner reads.
The comprehension generator asks for these glosses **in the same call that
writes the text**, so the breakdown costs no second model call; the analyzer's
own deep tier gets the run-binding for free.

## Consequences

- A comprehension exercise can now be refused (a 502 the screen reads as
  "Couldn't load a text") where before anything parseable was served. Each
  attempt logs one line — `comprehension N5 attempt 1/3: len …, vocab …,
  kanji …, seeds …, repro …` — so the refusal rate can be read off the
  deployment log. The levers, in order: more word seeds, naming deck
  replacements in the feedback, and only then the ratio.
- Kanji-heavy N5 text becomes kana-heavy N5 text. That is what a real N5
  text looks like, and it is now the rule rather than the prompt's request.
- The exam passage generator applies the same vocabulary measurement as a
  soft error: fed back on a retry, accepted with a log line on the last
  attempt. A paper that does not exist costs more than one that leans on a
  few hard words; reading practice, which can afford to refuse, does.
- The one-card-at-a-time carousel is gone, with its pre-token CSS. The
  analyzer's `stage` layout is untouched; its `list` layout has no caller
  left and is a follow-up.
- Three exercises' worth of seeds are the only new state
  (`comprehension_log.grammar`, nullable). Nothing a learner typed is stored
  by this decision (ADR 0012).
