# 0021 — Every grammar point is asked in Choisir, from questions of its own where it must

- **Status**: accepted (plan 201). Refines the contrast drill of plans 087
  and 190 and the ladder of plans 187e and 194;
  [0016](0016-grammar-is-taught-not-glossed.md) still stands.
- **Date**: 2026-10-13

## Context

A grammar point climbs the ladder in a fixed walk: Choisir three times,
Construire four, then mastered (`srs/ladder.py`). Choisir is the contrast
drill: the point blanked out of a sentence its author marked, its rivals as
the choices. Where a point cannot be asked that way the step "falls a
rung": contrast, then fill_in, then the flashcard, which every point can be.

Forty-one of the catalogue's 545 points had no contrast to ask. Their
rivals share every sentence with them (は beside が and も, と beside や, ね
beside よ), or their letters are every verb's (ない形, 〜ば, 使役形), or they
are a class (い形容詞／な形容詞, 自動詞／他動詞), or a cause the detector cannot
tell from a sequence (〜て（理由）). Plan 190 had looked at the first kind and
written the rule down: *は against が and も, と against や, ね against よ
share too many sentences: leave them unmarked.* So they were left, and
their Choisir steps were a flashcard under a "Choisir 2/3" ring. A learner
on です／だ, the first point of the first level, was shown a rule and a
"reveal" key where the screen promised choices, and asked why.

## Decision

**Every point is asked in Choisir. A point the contrast drill cannot be
drawn on carries questions of its own**, a `choose` list in its catalogue
entry (`study/grammar_choose.py`, `content/grammar/README.md`, "Choisir's own
questions"), written by hand like the tour's quiz it is modelled on:

    {"jp": "あれは学校＿＿＿。", "tr": {en, fr},
     "choices": ["です", "あります", "ます"],   // the right one first
     "why": {en, fr}}

The choices are the forms that stand in the hole, not catalogue points, so a
question is not limited to the rivals the lesson names. The translation is
printed under the sentence (it always was, in Choisir), so it fixes the
meaning, and a question is held to being answerable by understanding the
point: the right filling is the only one a native speaker would accept with
that meaning. The question is served through the contrast drill's own
payload, so the run draws it as it draws any other, plus the parts of the
form as it stands in the sentence (`fill`), the ruby of a filling with
kanji and the `answer` the tiles are judged against.

The gate makes it a standing property rather than a one-off: a point the
matcher cannot read, with no marked sentence the detector can blank and no
`choose`, fails `check_grammar`, and `tests/test_grammar_choose.py` serves
every point of the catalogue on every turn and fails on one that falls back.

## Alternatives considered

- **Mark contrast sentences for these points**, as plan 190 did for を, に,
  で, が and か. It needs a sentence in which *every rival is ungrammatical*,
  and for は, も, と, や, ね, よ there is none that is not contrived. It also
  needs the detector to find the point once, on one piece, which it does for
  fewer than half of the forty-one, and it offers the named rivals alone:
  one or two wrong choices, a coin toss.
- **Fillers from the level**, as a verifiable point gets. A particle's gap
  takes だけ, まで, から and more, so no filler is certainly wrong there.
- **Reuse the tour's `form` questions.** They are this question exactly, but
  the learner has just answered them at the tutorial and Choisir 1 is
  minutes later, so the same sentence would be asked twice running. The gate
  refuses a question that is a sentence of the lesson or the tutorial.
- **Teach the detector to read these points.** It would change every chip in
  the app, and for the particles it would still not say which of は, が and も
  the sentence means.
- **Keep the fallback and relabel it.** A flashcard is not a choice, and the
  ring would be lying less but the step would still be empty.

## Consequences

- 168 questions across the 41 points (three to five each, both languages),
  and the audit reads them (`scripts/audit_slice.py`, the playbook).
- The tutorial's quiz and Choisir now ask a point in different sentences.
- The six points that cannot be typed (so have no Construire) fall to the
  contrast on those steps, as the chain always said they would, now a real
  question and not a flashcard.
- The landing page's station specimens are unchanged: they pair a blank with
  the point's first example, so they draw from marked sentences only
  (`contrast_payload(..., authored=False)`).
- `slips`, the marker for a wrong filling the detector reads as the point
  although the sentence rules it out, is the author's word. It is the one
  place a reviewer must look, and the one place the gate cannot.
- The first draft of the 168 was attacked by six independent reviewers, one
  per slice. They found no wrong Japanese in a right filling, but eight
  questions with a second right answer or a "slip" that was a real form
  (group で beside と, な before a する-noun, や as a free choice, a polite
  question inside a clause, the clipped volitionals 走ろ and 急ご, 痛さ beside
  痛み), a hole that swallowed part of a stem (悲み for 悲しみ, which the
  furigana hid), and some fifteen translations and `why` lines that were false,
  ambiguous or agreed with the learner's gender. A second reviewer, given only
  the twenty-seven questions revised after the first round, found three more:
  a cause (あつさ) that に also takes in writing, a `why` that gave an
  ungrammatical wrong filling a meaning, and one that said "only" of へ
  where it meant "of the two destination particles". The review is part of the
  process, not an extra.
