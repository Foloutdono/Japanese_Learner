# 0022 — The trail measures time and use, and stays within the exemption

- **Status**: accepted
- **Date**: 2026-10-16
- **Extends**: [0012](0012-behaviour-is-recorded-first-party-or-not-at-all.md)

## Context

ADR 0012 gave the app a first-party trail: a closed set of event names, each
with a closed set of property keys, posted through one seam (`lib/track.js`)
to the app's own Postgres. It answered the four questions that motivated it
(the boarding, the fare gate, runs started against finished, the boot) and
little else. The owner asked for everything the law allows: what learners do,
what they like, what they never touch, how long they take.

An audit of what 0012 left unanswered (plan 218):

- **No time.** `screen_view` records an arrival. Nothing said how long a screen
  was looked at, so "where is the time spent" had no answer, and a visit's
  length was the gap between its first and last event — the last screen's time
  always lost.
- **Half the runs dark.** Only the card runs (`hooks/useCardSession.js`)
  reported `run_start / run_complete / run_abandon`. The five practice runs —
  reading, translation, comprehension, dictation, composition — reported
  nothing, and no run said how long a card took or how many were right.
- **No context.** Nothing split phone from desk, by system, by language.
- **No small features.** Audio, the analyser, photo reading, the tutor, the
  dictionary's search, settings: exactly the "what is never used" questions.
- **No client failures, no page speed.**
- **Three ways the existing trail was less honest than its policy.** The
  opt-out was a `localStorage` flag, so the server's own events (`fare_blocked`,
  `day_clear`, the basics units) and every other device kept counting someone
  who had said no. `event_daily` was kept for the life of the account while the
  policy said "30 days". And the policy called the daily counts "anonymised";
  they carry the account id.

## The legal frame this design relies on

The app's learners are mostly in France. Two texts apply.

- **ePrivacy (art. 82 of the French *loi Informatique et Libertés*)** governs
  reading and writing on the device: the queue in `localStorage`, the visit id
  in `sessionStorage`. The CNIL exempts from consent the trackers used **only
  for audience measurement** of the service itself, provided they are
  first-party, serve that one purpose, produce statistics rather than follow
  individuals across other services, are not combined with other processing
  or passed to third parties, let the user object easily, and are kept for a
  bounded time (the CNIL's reference: identifiers 13 months, the data derived
  from them 25 months).
- **GDPR** governs the data once it is on the server. The basis is legitimate
  interest (art. 6(1)(f)): measuring and improving the service the learner
  uses, with an objection that is honoured everywhere, an access right, and a
  bound on retention.

The trail stays on the near side of every one of those conditions, and this
ADR is the list of what it relies on, so a lawyer can check it against the
code rather than against a promise. **It is not legal advice**; the owner
should have it read.

Out of scope because each would need consent (a banner, the thing 0012 exists
to avoid): session replay, pointer heatmaps, precise location, any third-party
SDK, an advertising id, any identifier that survives the account.

## Decision

1. **Time is engaged time.** `screen_leave {route, tab, ms}` is sent when the
   route changes and when the page is hidden (`lib/screenTrail.js`), `ms`
   measured by `lib/dwell.js`'s stopwatch, which stops while the tab is hidden.
   Coming back starts a new stretch on the same screen without a second
   `screen_view`: views count arrivals, leaves count time. Whatever must be in
   the page-hide flush registers in `lib/pageHide.js`, which `track.js` runs
   before flushing.
2. **Every run reports, with how it went.** The practice runs are measured off
   the seam they already share, `stores/runTally.js` (`startTally`,
   `countReview`), through `lib/runTrail.js`: a practice run opens with its
   tally and closes when its screen is left. Having no end of its own, a closed
   practice run with at least one answer is a `run_complete` with `mode:
   'stream'`; none is a glance, recorded as nothing. Every run's end carries
   engaged `ms`, `card_p50` / `card_p90` (the time per answer), `right` (quality
   ≥ 3) and `where` (the door it was entered by).
3. **A visit carries coarse classes.** `session_start` carries `platform`,
   `vp` (phone / tablet / desk / wide), `os` (a family), `lang`, `theme`,
   `input` (touch / mouse), `standalone`, `reduced` — reduced on the device by
   `lib/visitContext.js` and never sent raw. No user agent, resolution, time
   zone or font list: classes, not a fingerprint.
4. **Small features are counted per screen.** `countUse(feature, action)`
   accumulates while a screen is up; leaving it sends one `feature_use
   {feature, action, route, n}` per pair. Settings send `setting_change
   {setting, value}` — never the trail's own switch: an objection is not
   recorded by the thing it objects to. The server records `ai_use` when a
   rationed model call is claimed (`core/daily_limit.claim`), so that use
   outlives `daily_usage`'s 30 days.
5. **Failures and speed.** `client_error {route, where}` for an uncaught error
   or rejection — never its message or stack, which can quote the screen —
   deduplicated per screen a minute. `vitals {route, lcp, inp, cls, ttfb}` once
   per page load from `PerformanceObserver`, no library.
6. **Values are closed, not only keys.** `VALUES` in `core/events.py` (mirrored
   in `track.js`, held equal by `tests/test_events.py`) lists the values every
   enumerated string key may take; anything else is dropped, on both sides.
   `route` and `path` are held to the shape of a route pattern and an API area
   on every event. "Nothing a learner typed" is now structural for every key
   the plan added: a free string cannot reach the table under them.
7. **The objection is the account's.** `user_profiles.analytics_off`, written
   by Réglages › Données beside the device's flag, read by both write paths
   (`events.opted_out`, in a savepoint so a caller's transaction is never
   aborted by it), copied onto the device at boot (`syncOptOut`). A device that
   said no before the account could hold the answer carries its no up, once.
8. **Bounded, and readable by the learner.** Raw rows 30 days
   (`compact_events.py`); the once-per-account families (`KEEP_LONG`) one year
   (`prune_logs`' outer cut, which already existed); `event_daily` 25 months
   (`prune_logs`, new). `GET /api/profile/export/trail` hands the learner both
   halves as CSV, without the visit id.
9. **Read in Metabase, rebuilt from the repo.** Nine dashboards (overview,
   features, time, funnels, retention, runs and content, devices, AI and
   ceilings, reliability), every question SQL in `docs/analytics/metabase/`,
   built by `scripts/metabase_sync.py`. Joins stay inside the service: the
   trail with the app's own tables (reviews, practice logs, exams, credits),
   never with anything outside it. The practice logs' text columns are never
   selected.

## Consequences

**What it buys.** Time per screen, visit, run and card; every run kind's
completion and accuracy; phone/desk/system splits; adoption of each feature
and the list of what nobody opens; retention cohorts split by what learners
chose and did; a reliability view. The policy describes it exactly and the
store declarations need no change: still first-party, still no tracker.

**What it costs.** Volume: `screen_leave` roughly doubles `screen_view`'s
rows, and `feature_use` adds one row per feature per screen left. Still well
inside 0012's budget at today's traffic; the first lever, if it is not, is
the raw retention, as 0012 said. Engaged time undercounts a learner reading a
long text with no interaction only in the sense that matters: it counts it,
because a visible tab is counted whether or not anything is clicked.

**What it rules out.** A string-valued key added to an event must either be
enumerated in `VALUES` or be a count, a duration, a boolean or a route; a new
event that needs a free string is a design question, not a line.
