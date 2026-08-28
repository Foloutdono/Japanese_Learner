// ── The journey ahead, as numbers ────────────────────────────────
// Pure math for the onboarding projection: given the backend's
// per-level ITEM volumes (GET /api/onboarding/volumes — words, kanji,
// grammar points, kana glyphs; deliberately not (card, mode) pairs,
// which would inflate every promise several-fold), a boarding level
// and a chosen pace, where does a straight line at that pace cross
// each level's content total?
//
// The model is honestly linear: perDay new items × 30.4 days a month,
// new material only — reviews come on top, and the copy that renders
// this (t.onbMapAssumption) says so. It is a projection, not a plan;
// its job is to make "the app will teach you 8,000 words" a line you
// can stand on rather than a slogan.

const LEVELS = ['N5', 'N4', 'N3', 'N2', 'N1']
const DAYS_PER_MONTH = 30.4

export function levelItems(volumes, level) {
  return (volumes.vocab?.[level] ?? 0)
    + (volumes.kanji?.[level] ?? 0)
    + (volumes.grammar?.[level] ?? 0)
}

/**
 * projectJourney(volumes, startLevel, perDay, opts) ->
 *   { points, milestones, totalItems, perMonth, horizonItems }
 *
 * points      [{ monthIndex, cumulativeItems }] for 0..months, capped
 *             at totalItems (the line goes flat once everything the
 *             app teaches from startLevel up is learned).
 * milestones  [{ level, items, monthIndex }] — one per level from
 *             startLevel, monthIndex FRACTIONAL (2.77 = late in the
 *             third month), only those inside the horizon.
 * includeKana adds the kana glyphs in front of everything else — the
 *             "never studied Japanese" path, where the syllabaries
 *             genuinely come first.
 */
export function projectJourney(volumes, startLevel, perDay, { months = 12, includeKana = false } = {}) {
  const startIdx = Math.max(0, LEVELS.indexOf(startLevel))
  const journey = LEVELS.slice(startIdx)
  const perMonth = perDay * DAYS_PER_MONTH

  let cumulative = includeKana ? (volumes.kana ?? 0) : 0
  const milestones = []
  for (const level of journey) {
    cumulative += levelItems(volumes, level)
    milestones.push({ level, items: cumulative, monthIndex: cumulative / perMonth })
  }
  const totalItems = cumulative

  const points = []
  for (let m = 0; m <= months; m++) {
    points.push({
      monthIndex: m,
      cumulativeItems: Math.min(Math.round(m * perMonth), totalItems),
    })
  }

  return {
    points,
    milestones: milestones.filter(ms => ms.monthIndex <= months),
    totalItems,
    perMonth,
    horizonItems: Math.min(Math.round(months * perMonth), totalItems),
  }
}
