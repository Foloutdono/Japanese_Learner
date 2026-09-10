# 0013 — The learner grades their own dictation, and writes it in romaji

- **Status**: accepted. Supersedes the grading half of
  [0011](0011-the-dictation-answer-never-leaves-the-server-early.md); the
  other half of that record (the batch carries no text) still stands.
- **Date**: 2026-09-10

## Context

書取 shipped grading its own answers. 0011 argued the case: there is a
single right answer, it is text, so the machine can compare — and it
must, because the learner has not seen the sentence and cannot.

The first real session disproved it. The learner heard
「小さい子どもが三人います。」 correctly and wrote
`chisaikodomogasanniimasu`. The screen said **0%, MISSED**.

Two mistakes, and they compound:

**The answer was in the wrong alphabet, and that was our fault, not the
learner's.** A Japanese IME is a separate install on a laptop and a
separate keyboard on a phone. A beginner practising listening has not
got that far, and telling them to "write what you heard, in Japanese"
asked for something they could not type. Reading practice has known
this since it was written — its field says *in romaji* — and dictation
simply forgot to.

**Romaji has no single right spelling, so a mark scheme cannot hold
it.** しんぶん is shinbun or shimbun. ちいさい is chiisai, chīsai or
chisai. し is shi or si; つ is tsu or tu; the particle は is written ha
and said wa. None of those is a listening mistake. Any threshold strict
enough to catch a real error is strict enough to fail a correct answer
spelled another way — which is exactly the note left in `ReadingRun` the
day that mode's auto-grading was retired: *auto-comparing romaji proved
too brittle.*

0011 rejected the rating bar on the grounds that a learner cannot mark
an exam they have not been given the paper for. That was true of the
screen as it then was. It is not true of the screen once the answer has
been revealed: by the time the bar appears the learner is looking at the
sentence, its furigana, its romaji and their own line directly beneath.
They have the paper.

## Decision

**The learner grades themselves, on the app's rating bar.** Same
control, same 0..5 `quality`, same `q > 2` pass as reading and
translation practice. `dictation_log` gains a `quality` column beside
its `accuracy`, and `correct` is derived from the rating.

**The server measures rather than grades.** `study/dictation.measure`
returns one number — how much of the line matched — and the screen
prints it beside the learner's own answer as a hint, not a verdict. The
four-way verdict (perfect / close / partial / missed) and the
character-level diff are both retired: a machine verdict standing over a
sentence the learner is about to grade is a second opinion nobody asked
for.

**The answer may be written in any of the three forms, and the field
asks for romaji.** The measurement is taken against the written form,
the kana reading and the romaji, and the best score wins — so nothing
has to detect what the learner typed. `study/romaji.fold` settles the
spelling question by collapsing every choice and keeping every sound:
kunrei and Hepburn meet, long vowels collapse, ん before a labial is one
mora either way, and a standalone particle is folded to how it is said.
A doubled **consonant** is deliberately not folded — きって and きて are
different words and audibly different.

**The reveal answers in the learner's own alphabet.** The kana line is
replaced by the romaji line, and the reading moves onto the sentence
itself as furigana — built from the bank's own kana, so the ruby over
九時 is くじ rather than a guess. Every line in
`content/listening_clips.py` therefore carries a hand-written `romaji`
field, checked against its kana mechanically by the bank's own
`problems()`.

**Two calls, not one.** `/check` reveals and measures; `/result` takes
the grade. The measurement is the server's and arrives with the reveal;
the grade does not exist until the learner has read the sentence and
pressed a segment. Folding them together would mean either logging a
row before it was graded or holding the reveal back until it was.

## Consequences

- A learner who abandons a run at the reveal leaves no row behind. The
  history is attempts they actually graded.
- `accuracy` and `quality` sit side by side in `dictation_log` and must
  never be merged: one is measured, the other is an opinion. Where they
  disagree over a month is the interesting figure.
- `accuracy` is stored as the client reports it, because that is the
  number the learner was looking at when they rated. Recomputing it
  later would silently rewrite history the day the fold changes.
- The fold is tuned to merge when unsure. It will call a wrong answer
  closer than it was; it will not call a right answer wrong. That
  asymmetry is deliberate and only defensible because the figure is not
  the grade.
- `study/romaji.py` is now the one home for Hepburn conversion;
  `routes/reading.py` imports it instead of holding a second pykakasi
  instance.
