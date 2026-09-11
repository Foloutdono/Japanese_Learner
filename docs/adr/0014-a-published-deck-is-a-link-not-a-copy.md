# 0014 — A published deck is a link, not a copy

- **Status**: accepted
- **Date**: 2026-09-11

## Context

Decks were the only content in Tsuji a learner makes themselves, and they were
a dead end. Every deck query in `routes/decks.py` was `WHERE user_id = %s` —
eighteen endpoints, the clause inlined in each — so a deck could only ever be
seen by the person who typed it. Someone who built a good N3 verb deck had no
way to give it to anyone, and someone starting out had nothing to begin from
but the app's own levels.

Opening that up is not one decision but three, and this app already has
opinions about all three in neighbouring places:

- **What a shared artifact IS.** ADR 0002 records what went wrong the last
  time: `phrase_history` stored a fully enriched analysis, per-learner SRS
  figures baked in, so reopening a month-old entry still said "New" over a
  word since mastered. A shared thing holds content and provenance; per-learner
  state is resolved at read time.
- **What happens when it is deleted.** ADR 0010 records that nothing here
  foreign-keys to `auth.users` and that deletion is reconciled rather than
  cascaded — and names this exact gap in its own consequences: "their decks
  and transcripts sit in the tables forever."
- **What may be measured about it.** ADR 0012 closes the event set and forbids
  recording anything a learner typed — "not a deck or theme name" is written
  into `core/events.py`'s docstring.

## Decision

### Following is a link

`deck_subscriptions(deck_id, user_id)` records that someone follows a deck.
It copies nothing. The deck, its `custom_cards`, its `deck_cards` and every
later edit to them stay the author's; the follower's SRS state is their own.

This is free, and that is the argument for it. A personal card's raw id is
`custom_{deck_id}_{card_id}` — **deck-scoped but not owner-scoped** — so the
SRS key for a follower studying Alice's deck 42, card 7 is
`"{follower}:custom_42_7"`. Already unique, already theirs. The scheduler
needed no change at all; what needed changing was every read path's assumption
that the viewer and the owner are the same person.

The alternative, copy-on-follow (how Anki shared decks work), was rejected on
two counts. It breaks the live-edit promise — an author fixing a wrong reading
cannot reach the people who took it — and it multiplies the author's typed text
across accounts that then own it, which makes ADR 0010's deletion question
unanswerable rather than merely hard.

**"Make it mine"** (`POST /api/decks/{id}/detach`) is the door out, and it is a
real copy: new deck, new cards, and the learner's own scheduler rows re-keyed to
the new ids so a mature deck does not silently reset to new. `review_log` is
deliberately NOT copied — lifetime XP, the level and the streak are all
aggregates over it, so a copy would pay the learner twice for one history.

### Owner and viewer are separated by a type, not by discipline

Every endpoint resolves a `DeckAccess` first: `owner_id` (whose rows to read),
`viewer_id` (whose SRS state to touch), and a `role`. `_listed_cards` and
`_build_pool` take that object rather than two loose strings, because passing
the viewer where the owner was meant should be unspellable rather than merely
discouraged. It is the one mistake in this feature that corrupts data quietly
instead of erroring.

A write on a followed deck is **403, not 404**: the follower can see the deck,
so "gone" would be a lie, and the screen needs to be able to say *make it yours
first*. A deck the caller may not see at all is 404, because whether a private
deck exists is its author's business.

### Warn, then vanish

Three endings, deliberately distinguished:

| What the author does | What followers see |
|---|---|
| **Unpublish** | Nothing. It only delists; existing followers keep their link |
| **Delete a followed deck** | It is **withdrawn** — a warning, and "make it mine", for 30 days |
| **Delete their account** | It is gone, at once, with no grace |

`withdrawn_at` is a separate column from `visibility` on purpose. Folding them
into one enum made a single value mean two unrelated things — "delisted" and
"deleted but still readable" — and the first draft of this design did exactly
that before the states pulled apart. A withdrawn deck leaves the author's
shelf, their deck limit and every endpoint they can reach; it exists only so
its followers can copy it, and `scripts/prune_withdrawn.py` collects it for
real afterwards. Without that script the grace period is not a grace period, it
is a leak: content an author asked to delete, kept forever because somebody
once followed it.

Account deletion gets no grace because the deck holds **the author's own typed
text**, and ADR 0010's "delete means delete" outranks a follower's convenience.

### Per-learner state stays out of the shared artifact

Nothing about the author's progress is stored on or served with a published
deck — not their mastery counts, not their level, not their review history.
`GET /api/decks/library/{id}` serves content, provenance (a username, a
publication date) and two counts. Every figure a viewer sees about their own
progress is resolved at read time, which is ADR 0002's lesson applied before it
has to be learned again.

### Moderation is a queue, not a mechanism

`deck_reports` records that someone objected. Nothing is hidden automatically,
nothing is counted toward a threshold, and `UNIQUE(deck_id, user_id)` makes
reporting idempotent so a second tap is not a second report. `reason` is a
closed enum, never free text — a free-text field here would be learner-typed
content on a path with no way to refuse it. Review is a query against the
existing Metabase connection; unpublishing is a manual `UPDATE`. That is
proportionate to a closed test and will not be once the app is open.

### What may be measured

Five new names in `core/events.py`, mirrored in `lib/track.js`, carrying
structures, counts and enums — **no deck name, no description, and no deck
id**. The id is omitted deliberately: it would let the trail say who follows
whom, which is more than "is the library used" needs to know. A "popular"
ordering is `follower_count` computed from the rows, never reconstructed from
analytics.

## Consequences

- **Following a kanji deck does not open a private track for those kanji.** Its
  `deck_cards` rows resolve to the app's own global raw ids, so that progress is
  the same progress as on the Kanji screen. Only the deck's *written* cards are
  deck-scoped. This is stated on the deck page rather than left to be found.
- **An author's edit silently changes a follower's mature card.** The raw id is
  unchanged, so the scheduler is not reset. That is the live-link promise
  working; it is also the strongest argument for keeping "make it mine" one tap
  away.
- **Publishing exposes `custom_cards.notes`.** Notes are a scratchpad. They are
  not in the library preview payload today; if that changes, the publish
  confirm has to say so.
- **`GET /{id}/export` is open to followers**, which is a copy that skips
  detach. The CSV is deliberately lossy — `front,back` only, so a structured
  deck loses its readings — which is what keeps it from being the easy path.
- **Unfollowing keeps the follower's scheduler rows**, so following again picks
  up where they left off. They are unreachable meanwhile, because the daily
  queue lists cards of decks on the shelf and not cards that merely have rows.
- **The library's count subqueries scan `custom_cards`/`deck_cards` whole.**
  Already true of `GET /api/decks` before this, fine at today's size, and the
  first thing to fix when it is not — a `LATERAL` per row, or a denormalised
  `card_count`.
