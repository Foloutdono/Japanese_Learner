# 0011 — The dictation answer never leaves the server early, and the server marks it

- **Status**: accepted in part. The first decision below — the batch
  carries no text — stands. The second and third (the server marks the
  answer; there is no rating bar) were superseded within the day by
  [0012](0012-the-learner-grades-their-own-dictation-and-writes-it-in-romaji.md),
  after the first real session showed a correctly heard sentence scored
  0% because it was written in romaji. Left as written rather than
  edited: the reasoning is why the mistake was made, and 0012's case
  only reads against it.
- **Date**: 2026-09-10

## Context

書取 (dictation, `/practice/dictation`) plays a clip and asks the learner to
write down what was said. It is the fourth sentence mode on the Practice tab,
and the first whose prompt is not text.

The three modes beside it — reading, comprehension, translation — all ship the
sentence with the question and let the screen decide when to reveal it. That
works because in those modes the prompt *is* the sentence: `/api/reading/batch`
sends `phrase`, `romaji` and `translation` together, the screen shows the
Japanese first and the romaji after the learner has written, and nothing is
being kept from anyone — a learner who reads the network response has read the
sentence they are already looking at.

Two things about dictation break that arrangement, and they pull in the same
direction.

**The text is the answer.** A batch that carried `jp` and `kana` would put the
whole exercise one devtools panel — or one cached response — away. The mode
would be a listening exercise only for learners who chose not to look, which
is not a property a study app can claim about itself.

**The learner cannot mark their own work.** Every other practice mode ends at
the six-segment rating bar, on the reasoning that reading a sentence is rarely
simply right or wrong and the learner knows best how close they came. Here
they do not know: they have not seen the line. Asking them to rate a
transcription against a sentence they have never read is asking someone to
mark an exam they were not given the paper for. And unlike a translation,
there *is* a single right answer and it is a string, so the comparison is one
a machine can actually make.

## Decision

**`GET /api/dictation/batch` returns audio and an id, and no text at all.** A
clip is `{id, level, audioSrc}`. The words arrive from
`POST /api/dictation/check`, in the same response that grades them — after the
learner's own transcription has been sent.

**The server marks the answer.** *(Superseded by 0012: it measures, and
the learner grades.)* `study/dictation.grade` normalizes both texts
(NFKC, katakana folded to hiragana, spacing and the marks a listener cannot
hear removed), scores them with `difflib`'s ratio, and returns an accuracy out
of 100, a verdict, and a character-level diff the screen prints over the
reference. There is no rating bar on this screen.

**The answer is graded against the written form and the reading, keeping the
better of the two.** *(0012 adds romaji as a third form and makes the
result a measurement rather than a grade.)* A learner who hears 「駅の前で友だちに会います」 and writes
えきのまえでともだちにあいます has done the exercise; writing kanji is a
different skill, taught on a different line of this app. Every line in
`content/listening_clips.py` therefore carries a kana reading beside its
written form, and `matched` reports which one won so the diff is shown against
the form the learner was actually writing.

**The two-listen limit is the player's, and the server only records it.** The
clip is a static file behind `/exam-audio`; anything behind a URL can be
fetched again. `components/study/ClipPlayer.jsx` counts the listens and
disables the control; `plays` travels with the answer and is stored in
`dictation_log`. Pretending to enforce it server-side would buy nothing and
would claim a guarantee the architecture cannot make.

## Consequences

- The screen cannot show anything about the sentence before submit — not its
  length, not a first character, not a word count. Every such hint is a fact
  the batch does not carry, by construction rather than by discipline.
- Grading is a round trip. There is no offline or optimistic path: a failed
  `check` leaves the learner's typing in place and offers a retry, because
  there is nothing on the client to fall back to.
- The mark scheme is code, in one place
  (`study/dictation.PERFECT/CLOSE/PARTIAL`), and it is a judgement rather than
  a measurement — it decides what counts as having heard a sentence. It is
  stated once, with its arithmetic, so changing it is a deliberate act.
- `dictation_log` stores an `accuracy` where the other practice logs store a
  `quality`. They are not the same figure and should never be merged: one is
  measured, the other is an opinion.
- The clip id is the content key of its own audio
  (`study/exam_tts.content_key`), so a stored row keeps pointing at the same
  line forever, and stops resolving — rather than silently resolving to a
  *different* line — if that line is ever reworded.
