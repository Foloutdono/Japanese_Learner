import { FREE_DECKS, FREE_CARDS, PASS_DECKS, PASS_CARDS } from './credits'

// ── 定期券 — the offer, as the client knows it ─────────────────
// The pass, shown before it can be bought. This is deliberately a
// SEPARATE flag from domain/credits.js's HAS_STORE, and the split is
// the whole design:
//
//   HAS_STORE   — a purchase can complete. Still false. Everything it
//                 gates (the pass tags on Practice and the analyzer,
//                 the "Go unlimited" controls that would charge) stays
//                 out of the tree exactly as before.
//   HAS_PAYWALL — the offer may be SHOWN, and interest recorded. True.
//
// The reason the two are not one flag: the codebase's standing rule is
// that a control leading nowhere is worse than none (domain/credits.js,
// and again in SettingsScreen's "no dead controls"). An offer whose
// button says "prévenez-moi", records that, and says thank you is not
// a dead control — it is a real answer to a real question, and the
// only way to know what a store would be worth before building one.
// A button that silently did nothing would break that rule, and this
// flag would be the wrong way to get there.
//
// When the store lands: flip HAS_STORE, and the sheet's foot becomes a
// purchase instead of an interest tap. Nothing else here moves.
export const HAS_PAYWALL = true

// Where an offer can be opened from. The backend's note beside
// offer_view (backend/core/events.py) must name exactly these — every
// funnel query slices on this, so a door added on one side only is a
// silently-missing column in the dashboard.
export const SOURCES = Object.freeze({
  ONBOARDING: 'onboarding',   // the last boarding screen, under the pass
  BALANCE: 'balance',         // the balance sheet, off the HUD
  PROFILE: 'profile',         // the profile, under the commuter pass
  SETTINGS: 'settings',       // the settings list
  RUNOUT: 'runout',           // the run stopped at a zero balance
  RIDE: 'ride',               // the reading ride's pass plate (plan 097)
})

/**
 * What the pass changes, as figure pairs. Derived from the same
 * constants the free tier is enforced with (domain/credits.js), so the
 * offer can never advertise a limit the server does not actually use.
 *
 * `free: null` means "the free tier does not have this at all".
 */
export const BENEFITS = Object.freeze([
  { id: 'reviews', free: null, pass: null },              // counted vs unlimited
  { id: 'decks', free: FREE_DECKS, pass: PASS_DECKS },
  { id: 'cards', free: FREE_CARDS, pass: PASS_CARDS },
])

/** Whether the offer may be shown at all. */
export function offerable(credits) {
  if (!HAS_PAYWALL) return false
  // Never offer a pass to someone already holding one.
  return !(credits?.unlimited || credits?.plan === 'pass')
}

// ── The platforms that ride on the pass ────────────────────────
// Every router under backend/core/credits.require_pass, named by the
// section that fronts it (config/tabs.js paths): reading and
// comprehension (routes/reading.py), translation, dictation, composition
// (plan 124), the exams, and the analyzer (phrase, ocr and video).
// backend/tests/test_pass_platforms.py pins this map against the
// routers, so the reading ride's plate (plan 099) can never promise
// more or less than the server enforces.
export const PASS_PLATFORMS = Object.freeze({
  reading: '/practice/reading',
  comprehension: '/practice/comprehension',
  translation: '/practice/translation',
  dictation: '/practice/dictation',
  composition: '/practice/composition',
  exam: '/practice/exam',
  analyzer: '/dictionary/analyzer',
})
