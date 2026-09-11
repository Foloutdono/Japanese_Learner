// ── A path, reduced to the route it matched ──────────────────────────
//
// `/learn/vocab/theme/animaux/level/N4/recognition` is not a thing to
// store. Two reasons, and the first is the important one:
//
//   1. It carries content the learner chose, and one of them is a deck
//      name they typed. The trail is meant to say WHICH SCREEN, never
//      what was on it, and a raw pathname quietly breaks that on the
//      themes, the decks and the exams.
//   2. Every theme × level × mode would be its own value, so the one
//      question this answers -- which screens get opened -- would come
//      back as ten thousand rows of one.
//
// So a path is matched against the routes App.jsx declares and stored
// as the pattern. A path that matches nothing is `null` and its event
// is dropped rather than stored raw: an unrecognised path is exactly
// the case where guessing would leak something.

// Every route App.jsx declares. src/lib/routePattern.test.js reads the
// `path="…"` attributes out of App.jsx and fails if one of them is
// missing here, so adding a screen and forgetting this list is not a
// thing that can happen quietly.
export const ROUTES = [
  '/',
  '/today',
  '/today/run',

  '/learn',
  '/learn/kana',
  '/learn/kana/:set',
  '/learn/kana/:set/:mode',
  '/learn/vocab',
  '/learn/vocab/levels',
  '/learn/vocab/tiers',
  '/learn/vocab/themes',
  '/learn/vocab/:level',
  '/learn/vocab/:level/:mode',
  '/learn/vocab/tier/:tier',
  '/learn/vocab/tier/:tier/:mode',
  '/learn/vocab/theme/:theme',
  '/learn/vocab/theme/:theme/:mode',
  '/learn/vocab/theme/:theme/level/:themeLevel',
  '/learn/vocab/theme/:theme/level/:themeLevel/:mode',
  '/learn/kanji',
  '/learn/kanji/levels',
  '/learn/kanji/tiers',
  '/learn/kanji/:level',
  '/learn/kanji/:level/:mode',
  '/learn/kanji/tier/:tier',
  '/learn/kanji/tier/:tier/:mode',
  '/learn/grammar',
  '/learn/grammar/:level',
  '/learn/grammar/:level/:mode',
  '/learn/decks',
  '/learn/decks/library',
  '/learn/decks/library/:deck_id',
  '/learn/decks/:deck_id',
  '/learn/decks/:deck_id/study',
  '/learn/decks/:deck_id/study/:mode',

  '/practice',
  '/practice/exam',
  '/practice/exam/:examId',
  '/practice/exam/:examId/results',
  // The four sentence sections are generated from SENTENCE_SECTIONS in
  // App.jsx rather than written out, which is why the test allows these
  // eight to have no literal `path="…"` of their own.
  '/practice/reading',
  '/practice/reading/levels',
  '/practice/reading/tiers',
  '/practice/reading/level/:level',
  '/practice/reading/tier/:tier',
  '/practice/reading/mastery',
  '/practice/translation',
  '/practice/translation/levels',
  '/practice/translation/tiers',
  '/practice/translation/level/:level',
  '/practice/translation/tier/:tier',
  '/practice/translation/mastery',
  '/practice/comprehension',
  '/practice/comprehension/:level',
  '/practice/dictation',
  '/practice/dictation/:level',

  '/dictionary',
  '/dictionary/analyzer',

  '/profile',
  '/profile/stats',
  '/profile/settings',
  '/profile/settings/:page',
]

// Split once at module load rather than on every navigation.
const SPLIT = ROUTES.map(pattern => ({ pattern, parts: pattern.split('/') }))

/**
 * The route pattern a pathname matched, or null.
 *
 * Scored rather than first-past-the-post, so the list above can be
 * written in whatever order reads best: `/learn/vocab/levels` and
 * `/learn/vocab/:level` both match "/learn/vocab/levels", and the one
 * with fewer parameters is always the one meant.
 */
export function routePattern(pathname) {
  if (typeof pathname !== 'string' || !pathname) return null
  // A trailing slash is the same screen; a query or a hash is not part
  // of the route at all (and `?exclude=…` on the exam carries ids).
  const clean = pathname.split(/[?#]/)[0].replace(/(.)\/+$/, '$1')
  const parts = clean.split('/')

  let best = null
  let bestParams = Infinity
  for (const { pattern, parts: candidate } of SPLIT) {
    if (candidate.length !== parts.length) continue
    let params = 0
    let ok = true
    for (let i = 0; i < candidate.length; i++) {
      if (candidate[i].startsWith(':')) { params++; continue }
      if (candidate[i] !== parts[i]) { ok = false; break }
    }
    if (ok && params < bestParams) {
      best = pattern
      bestParams = params
      if (params === 0) break   // an exact literal cannot be beaten
    }
  }
  return best
}
