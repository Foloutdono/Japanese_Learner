# 0017 — A lesson is the real component fed a literal, and writes nothing

- **Status**: accepted
- **Date**: 2026-09-21

## Context

The boarding (plan 075) ends at the ticket gate and, until wave 21, dropped
the learner on an empty queue with no word on how a card is flipped, what
the rating bar is for, or that "wrong" is the method rather than a failure.
Wave 8 had answered this once with a tour of four working demos and the
principle that *words about a flashcard cannot compete with flipping one*;
plan 075 deferred that tour and it was deleted with the old flow. Wave 21
brings the lesson back in three parts — the card ride, the reading ride and
the per-gate guide — and this record states the rule they were built to, so
the next lesson is built to it too.

Three ways of building a tutorial were on the table, and two of them are
what most apps do:

- **A picture of the card.** A mock-up drawn for the tutorial, with the
  copy beside it. Cheap, and wrong within two features: every near-copy of a
  component in this app has drifted from its original (DESIGN.md, "What not
  to do"), and a lesson that shows a card the learner will never meet
  teaches the wrong card.
- **A real first session, narrated.** Serve two real cards, review them for
  real, and explain as you go. Honest about the card — and dishonest about
  everything the review touches: XP, the level, the streak, the daily-new
  budget and the 番付 standing are every one of them a `SUM`/`COUNT` over
  `review_log` (CLAUDE.md, "review_log is not an audit log"). The learner's
  first XP, first streak day and first spent new-card slot would come from
  cards we chose, on a screen that was meant to teach rather than to count.
- **The real component, fed a literal, writing nothing.** Wave 8's
  principle.

## Decision

A lesson renders the production component with a literal payload and local
state. It posts no review, schedules no card, spends no credit, and is
served its content from the same bank the real thing draws on.

Concretely, for the three lessons of wave 21:

- The card ride (`screens/RideRun.jsx`) is `StudyStage`, `CardTransition`,
  `CardPrompt` and `RatingBar` — not a picture of them — fed two cards the
  ticket office serves (`GET /api/onboarding/ride`) through the vocab
  batch's own card assembly (`routes/vocab._build_vocab_card`), so the shape
  is the shape a run serves. Both cards are deck entries checked at import;
  a deck correction fails the deploy, not a learner's first screen. The
  rating is local state: no `useReviewGates`, no `lib/reviews`, no
  `review_log` row. The first real card is the one behind the 改札.
- The reading ride (`screens/RideReading.jsx`) draws with the reading run's
  own pieces, extracted into `components/reading/ReadingPieces.jsx` rather
  than copied, and measures the answer with the ticket office's own check
  against its one sentence (`POST /api/onboarding/ride/check`, the same
  `measure_forms` 読解 and 書取 use) — never the pass-gated reading
  router, and never `/api/reading/result`.
- The guide (`components/guide/Guide.jsx`) points at the live DOM through
  `data-guide` anchors and draws a spot around what is already there. It
  never renders a replica of a screen. A stop whose anchor is not on the
  screen is skipped.

The one write a lesson makes is its own stamp — `user_profiles.tutorial_at`
for the rides, the `guided` map for the guide — so it is not shown twice.
The stamp is per learner on the profile row (a guest is a real user, and
the account made later is the same row), with a localStorage mirror only
where a stamp could not land, never as an authority.

Two corollaries the lessons also keep:

- **A lesson never blocks a door.** No ride and no guide opens unless the
  profile said so; a profile the gate failed open without, or a payload
  that could not be served, means no lesson and the app as usual.
- **What a lesson says about the product comes from the code that enforces
  it.** The pass plate lists `domain/paywall.PASS_PLATFORMS`, pinned by
  `tests/test_pass_platforms.py` to every router under `require_pass`; its
  "open to everyone for now" line rides on the server's `enforced` flag. A
  tutorial that hard-coded either would be a promise the server could break
  without a test noticing.

## Consequences

- A change to `CardPrompt` or `RatingBar` changes the lesson for free, and a
  change that breaks the lesson breaks it in the lesson's own tests
  (`RideRun.browser.test.jsx`, `Guide.browser.test.jsx`) rather than on a
  learner.
- The ride cannot demonstrate what a review *does* — the XP toast, the
  stamp, the fare — because it does none of it. The done screen says so in
  words instead. This is the accepted cost; the alternative was a first XP
  the learner did not earn.
- A lesson's content is the deck's, gloss and all. The known card printed
  the deck's own spreadsheet residue ("hello,good day (daytime greeting,
  id)") on the very first card; the fix is a content correction in the
  deck, which is safe for a gloss (a gloss is not part of the card id), and
  is content work rather than a tutorial override.
- The guide's anchors are attributes on production components (`data-guide`,
  or a `guide` prop on `Plate`, `StopsFoot`, `Console`, `Chips`,
  `CardTransition` and `RatingBar`). A refactor that drops one fails
  `components/guide/guides.test.js`, which reads the source, not the DOM.
- Adding a lesson means: the real component, a literal from the real bank,
  local state, one stamp. Anything that needs a review to demonstrate is not
  a lesson; it is a first session, and it belongs behind the 改札.
