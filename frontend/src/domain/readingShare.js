// ── 割合 — how often each reading is the one a word uses ─────────
// A kanji's readings are a list, and a list does not say which ones are
// worth the learner's time: 生 has twenty, and セイ is half the course's
// words that use it while お.う is none of them. The backend counts the
// words per reading (study/kanji_words.py, plan 176) over two scopes --
// the JLPT course the app teaches, which rides on every kanji entry as
// `reading_shares`, and all of JMdict, fetched on demand from
// /api/dictionary/readings-share -- and this turns a count into what the
// readings sheet prints: a share, a word for it, and the order.
//
// Pure, so the thresholds and the ordering are testable without a DOM.

export const SCOPE_COURSE = 'course'
export const SCOPE_ALL = 'all'

// A reading carrying a fifth of the words is the one to learn first; under
// a twentieth it is one to know by sight.
export const CORE_FROM = 20
export const USUAL_FROM = 5

export function shareTier(pct) {
  if (pct >= CORE_FROM) return 'core'
  if (pct >= USUAL_FROM) return 'usual'
  return 'rare'
}

export function sharePct(n, total) {
  return total > 0 ? (n / total) * 100 : 0
}

/**
 * What the sheet prints for one scope.
 *
 * `groups`  the entry's readings, [{reading, words}], in the deck's order
 * `shares`  {total, whole, readings: {reading: words}} for the scope, or
 *           null when it is not known yet
 * `scope`   SCOPE_COURSE | SCOPE_ALL
 *
 * Returns
 *   rows   the readings with at least one word, most used first (ties
 *          keep the deck's order), each {reading, words, n, pct, tier}
 *   idle   the readings no word in this scope uses -- the pills
 *   whole  {n, pct} for the words read as a whole (今朝 けさ), or null
 *   total  the words counted
 *
 * In the course scope a row shows only the course's own words (a word
 * with a level), never the pool's top-up: the share is the course's, and
 * so are the examples under it. In the full scope it shows every word.
 */
export function readingRows(groups, shares, scope) {
  if (!shares) return { rows: [], idle: [], whole: null, total: 0 }
  const total = shares.total ?? 0
  const rows = []
  const idle = []
  ;(groups ?? []).forEach((g, order) => {
    const n = shares.readings?.[g.reading] ?? 0
    if (n <= 0) {
      idle.push(g.reading)
      return
    }
    const words = scope === SCOPE_COURSE ? (g.words ?? []).filter(w => w.level) : (g.words ?? [])
    const pct = sharePct(n, total)
    rows.push({ reading: g.reading, words, n, pct, tier: shareTier(pct), order })
  })
  rows.sort((a, b) => b.n - a.n || a.order - b.order)
  const whole = shares.whole > 0 ? { n: shares.whole, pct: sharePct(shares.whole, total) } : null
  return { rows, idle, whole, total }
}

/** "49,1" / "49.1": one decimal, in the learner's language. */
export function formatPct(pct, lang) {
  return new Intl.NumberFormat(lang === 'fr' ? 'fr-FR' : 'en-US', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(pct)
}

// ── The study card's few ─────────────────────────────────────────
// A card is a glance: it prints the TOP_ON_CARD readings the course uses
// most, each with its share, and counts the rest as "+N" (the entry has
// them all). Only readings the course's words use are candidates -- a
// reading no word demonstrates is never worth a slot on a card -- so a
// kanji the course barely shows prints fewer, and one it never shows
// prints none, which is the caller's cue to keep the card it had.
export const TOP_ON_CARD = 4

/**
 * `tokens`  the kanji's readings in the deck's order (splitReadingTokens)
 * `shares`  the entry's `reading_shares` (the course's counts)
 * Returns {top: [{reading, n, pct, tier}], more}, `top` most used first
 * with ties in the deck's order, `more` the readings left out.
 */
export function topReadings(tokens, shares, limit = TOP_ON_CARD) {
  const total = shares?.total ?? 0
  if (!total) return { top: [], more: 0 }
  const used = (tokens ?? [])
    .map((reading, order) => ({ reading, order, n: shares.readings?.[reading] ?? 0 }))
    .filter(r => r.n > 0)
    .sort((a, b) => b.n - a.n || a.order - b.order)
    .slice(0, limit)
    .map(({ reading, n }) => {
      const pct = sharePct(n, total)
      return { reading, n, pct, tier: shareTier(pct) }
    })
  return { top: used, more: (tokens ?? []).length - used.length }
}

