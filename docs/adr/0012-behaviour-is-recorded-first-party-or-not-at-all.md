# 0012 — Behaviour is recorded first-party, or not at all

- **Status**: accepted
- **Date**: 2026-09-10

## Context

Nothing in the app knew what anyone did in it. Not which screens were opened,
not where the boarding flow lost people, not whether a study run was finished
or walked away from, not what the cold start cost. `review_log` records
answers, not behaviour, and the one signal about willingness to pay the app
already computed — the fare gate's shadow-mode "would have blocked", in
`core/credits.py` — went to `logger.info` and therefore to Render's stdout,
which is not queryable and does not outlive the instance.

The obvious answer is a hosted product-analytics SDK, and the obvious choice
is PostHog: its EU free tier is 1M events a month with no card, Frankfurt
hosting, and funnels, retention, session replay and feature flags without
writing a query. On cost alone it wins — this design costs the same €0 and
does less.

Three things rule it out, and the first is the one that decides it:

1. **`frontend/public/privacy.html` says "No advertising, no trackers, no sale
   of data."** It is published, it is linked from the app at `/privacy`, and
   the Play Data-safety and App Store privacy declarations were made on the
   strength of it. A third-party SDK means amending the policy, re-declaring
   both store listings, and doing so again at every SDK change.
2. **It would put a consent banner at the top of the funnel.** EU guidance
   treats product analytics and session replay as non-essential, so a
   third-party tracker needs consent before it loads. The screen this would
   sit on is the first one a new learner sees — the exact place the boarding
   funnel is already losing people, and the thing this work exists to measure.
   Instrumentation that damages what it measures is worse than none.
3. **The bundle is deliberately lean.** `posthog-js` is ~52 KB. This app
   dynamically imports Capacitor and tesseract.js, keeps fonts out of the
   precache and slices Noto by unicode-range specifically to avoid weight of
   that order.

## Decision

Events are recorded **first-party**: a `track()` seam in the frontend
(`frontend/src/lib/track.js`), batched to `POST /api/events`
(`backend/routes/events.py`), stored in the app's own Postgres
(`backend/core/events.py`).

Four rules make that defensible rather than merely cheaper:

- **A closed set of names, each with a closed set of property keys.** Declared
  in `core/events.py` and mirrored in `track.js`; `tests/test_events.py` fails
  if the two drift. Anything not declared is dropped.
- **Nothing a learner typed, ever.** Not a dictation answer, not an analysed
  sentence, not a deck or theme name. Enforced structurally: only scalars are
  accepted, strings are cut at 64 characters, and paths are reduced to route
  patterns (`lib/routePattern.js`) before they are recorded — `/learn/vocab/
  theme/animaux/...` becomes `/learn/vocab/theme/:theme/...`, and a path
  matching no declared route is not recorded at all. The server applies the
  same rules to whatever a browser posts rather than trusting that it did.
- **Bounded.** `event_log` keeps 30 days of raw rows;
  `scripts/compact_events.py` folds the rest into `event_daily` first, on
  `review_log` → `review_daily`'s model, so the counts do not move. The
  once-per-learner families (boarding, the fare gate) are spared, because the
  questions they answer are about order and a rollup cannot reconstruct it.
- **Refusable.** Réglages › Données, beside the export and the delete, where
  the privacy policy already points.

The seam is the point of the design as much as the storage is: no screen names
an endpoint, so a second sink — PostHog included, if session replay ever
justifies the banner — is one file, not a migration.

## Consequences

**What this costs.** There is no session replay, no funnel built by clicking,
no feature flags. Every question is a SQL query someone writes.
`scripts/weekly_digest.py` answers the four that motivated the work and runs
weekly from `.github/workflows/weekly-digest.yml`; anything else is Metabase
pointed at the same database, or the Supabase SQL editor.

**What it buys.** The published policy stays true as written, the store
declarations are unchanged, no consent banner sits in front of the funnel, and
the data is in a table the app already backs up, already deletes with the
account (`routes/account.py`'s `PLAN`) and already prunes.

**The load-bearing constraint** is Supabase's 500 MB, shared with `review_log`.
`screen_view` is the volume driver; at ~50 views per learner per day, 500
learners would be ~225 MB a month stored raw. If it outgrows the budget the
first lever is a shorter raw retention, not a larger database.

**Found on the way in.** `check_deck_limit` and `check_card_limit` read
`cur.fetchone()[0]` against callers that pass a `RealDictCursor`, where that
raises `KeyError`. It was unreachable only because the counts sat behind
`if not ENFORCE: return`; the first `CREDITS_ENFORCE=1` deploy would have met
it on the first deck anyone created, returning 500 where a 402 was meant. Both
now go through `credits._count()`, and both count in shadow mode so the
crossing can be recorded.
