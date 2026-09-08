import { DEFAULT_TIER_SIZE } from './tiers'

// ── Where a sentence session's sentences come from ───────────
// The practice tab's three sentence sections (reading, comprehension,
// translation) are each in two halves: the pickers are a station page
// under the chrome (screens/SentenceStation.jsx) and the session is a
// run on the stage (ReadingRun, ComprehensionRun, TranslationRun). The
// choice travels between them in the URL, and this module is the one
// place that knows its shape:
//
//   <base>/levels          the JLPT grades        → <base>/level/N4
//   <base>/tiers           the frequency tiers    → <base>/tier/3?size=200&domain=jmdict
//   <base>                 the sources            → <base>/mastery
//
// A section with one axis (comprehension) has no source list, so its
// root IS the level list and its run is <base>/N4.

export const LEVELS = ['N5', 'N4', 'N3', 'N2', 'N1']

/** The station's own pages, for the section rooted at `base`. */
export function sourcePaths(base) {
  return { level: `${base}/levels`, frequency: `${base}/tiers`, mastery: `${base}/mastery` }
}

/**
 * Read a run's path back into the choice that made it: which source,
 * its parameters, and the list the ‹ goes back to (with the key of the
 * word for it, since this side knows no language).
 *
 * Returns null for a path the station could not have produced — a
 * hand-typed grade that is not one, a tier that is not a number — which
 * a run answers by sending the learner back to the station.
 */
export function runSource({ base, level, tier, search = '', levelsOnly = false }) {
  const sp = new URLSearchParams(search)
  if (level != null) {
    if (!LEVELS.includes(level)) return null
    return {
      source: 'level',
      level,
      domain: 'vocab',
      tier: null,
      tierSize: DEFAULT_TIER_SIZE,
      back: levelsOnly ? base : `${base}/levels`,
      backKey: 'leaveLevels',
    }
  }
  if (tier != null) {
    const n = Number(tier)
    if (!Number.isInteger(n) || n < 0) return null
    const jmdict = sp.get('domain') === 'jmdict'
    const size = Number(sp.get('size')) || DEFAULT_TIER_SIZE
    return {
      source: 'frequency',
      level: null,
      domain: jmdict ? 'vocab_jmdict' : 'vocab',
      tier: n,
      tierSize: size,
      back: `${base}/tiers?size=${size}${jmdict ? '&domain=jmdict' : ''}`,
      backKey: 'leaveTiers',
    }
  }
  return {
    source: 'mastery',
    level: null,
    domain: 'vocab',
    tier: null,
    tierSize: DEFAULT_TIER_SIZE,
    back: base,
    backKey: 'leaveSources',
  }
}
