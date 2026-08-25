# 0005 — The learner's JLPT level is read through a resolver, not a column

- **Status**: accepted
- **Date**: 2026-08-25

## Context

Several things the analyzer needs to say depend on the learner's own JLPT
level: whether a Sentence is above them, which grammar points to surface,
how to grade a Passage.

**No such value exists today.** `user_profiles` holds a username and nothing
else. `profile.level` is the XP/gamification level from `srs/xp.py`, which is
unrelated. Every screen that needs a JLPT level today asks the learner to pick
one for that session (`ReadingScreen`'s `TierPicker`, the exam catalog, the
deck browser).

It *will* exist. A future onboarding flow will set it, either by
self-declaration or by a placement test.

The trap is building the analyzer against "no level exists" and then having to
find every assumption again when it does — or, worse, building against a
per-session picker and having two competing notions of the learner's level.

## Decision

Introduce one resolver — a single function that answers "what JLPT level
should I treat this learner as, for this request" — and route **every**
level-dependent decision through it. No caller reads a level from anywhere
else, and no caller hardcodes a default.

Its resolution order today:

1. an explicit level supplied by the caller (a session picker, a URL
   parameter) — always wins, so existing screens keep working unchanged;
2. otherwise, a conservative default.

When onboarding lands, one step is inserted between them: the stored learner
level. No call site changes.

Precedence matters and is deliberate: an explicit choice beats the stored
level. A learner reading above their level on purpose should not be
second-guessed.

## Consequences

- Onboarding becomes a change to one function plus a column, not an audit of
  every level-dependent call site.
- The analyzer can ship *now* with level-aware output that quietly improves
  when onboarding arrives.
- A seam with one implementation looks like indirection for its own sake until
  the second implementation exists. The docstring must say why it is there, or
  someone will inline it.
- Screens that pick a level per session keep doing so; nothing is taken away.

## Alternatives considered

**Wait for onboarding.** Blocks the analyzer on unrelated product work, and
guarantees the retrofit.

**Add the column now and a placeholder UI.** Ships a half-built onboarding
nobody asked for, and pre-commits to a data model before the placement test is
designed.

**Pass the level explicitly everywhere.** Honest, but pushes the default into
every caller, which is exactly the duplication that makes the retrofit
expensive.
