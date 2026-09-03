// ── 評価 — which buttons the rating bar offers ────────────────────
// Three bars, one scale. `quality` is 0..5 everywhere — in the review
// payloads, in review_log, in last_quality, in the stats mix, in the
// scheduler's own PASS/FAIL tables (backend/srs/scheduler.py) — and
// that does not change with the bar. Each shorter bar is the longer one
// with buttons left off, never a rescaling:
//
//   binary  [4, 1]              correct / wrong
//   simple  [4, 3, 2, 1]        + difficult, almost   (the default)
//   full    [5, 4, 3, 2, 1, 0]  + perfect, blackout
//
// So a stored 4 means Correct whichever bar was on screen when it was
// pressed, the stats mix stays directly comparable, and a learner can
// move between bars without their own history changing meaning
// underneath them. Nothing anywhere needs to know which bar a row came
// from, which is the whole reason the scales nest.
//
// Why the default is four: blackout and perfect went almost entirely
// unused. Six segments is also a squeeze on a phone (the bar wraps to
// two rows below 560px) and a six-way judgement is a slower decision
// than a four-way one on a control you press hundreds of times a day.
//
// Dropping perfect had a cost that had to be paid on the backend: 4 is
// the best answer the shorter bars can give, and it used to leave a
// card's difficulty untouched while 3 raised it, so nothing on them
// could ever say "that one is getting easier". See the PASS table in
// backend/srs/scheduler.py, where 4 now eases a card and 5 eases it
// further.
//
// The two-button bar needs no further backend work — it is exactly the
// four-button bar with Difficult and Almost never pressed — but it does
// give up something real, and it is the right thing to give up
// knowingly: with no Difficult there is no way to slow a card down
// short of failing it, so a card you keep getting right drifts to the
// bottom of the difficulty range and grows at close to MAX_GROWTH every
// time. That is the trade a binary bar makes: one less decision per
// card, at the cost of the scheduler's only signal between "fine" and
// "only just".

export const DEFAULT_RATING_SCALE = 'simple'

// BEST-FIRST, and it must stay that way: RatingBar's keyboard handler
// indexes these positionally, so "1" is the best answer on every bar
// and the digits keep meaning the same thing across a switch. The bar
// DRAWS them worst-first; that is a display-only reversal.
export const RATING_SCALES = {
  binary: { id: 'binary', qualities: [4, 1] },
  simple: { id: 'simple', qualities: [4, 3, 2, 1] },
  full:   { id: 'full',   qualities: [5, 4, 3, 2, 1, 0] },
}

// The word each quality gets, by locale key. One map, not one per
// scale: the same number is the same rating on every bar, so the
// buttons they share are labelled identically and the stats screen
// needs to know nothing about which bar is in use.
export const QUALITY_LABEL_KEY = {
  5: 'perfect',
  4: 'correctHesit',
  3: 'difficult',
  2: 'wrongSeen',
  1: 'wrongRated',
  0: 'blackout',
}

/** The named scale, or the default for anything unrecognised — a stale
 *  localStorage value or an older backend must never leave the rating
 *  bar with nothing to draw. */
export function scaleFor(id) {
  return RATING_SCALES[id] ?? RATING_SCALES[DEFAULT_RATING_SCALE]
}

/** The scale's buttons, best-first: `[{ q, key, label }]`. */
export function ratingButtons(id, t) {
  return scaleFor(id).qualities.map(q => ({
    q,
    key: QUALITY_LABEL_KEY[q],
    label: t[QUALITY_LABEL_KEY[q]],
  }))
}
