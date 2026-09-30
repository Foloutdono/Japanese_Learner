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
// When the store lands: flip HAS_STORE, and the offer's foot buys the
// pick instead of recording an interest in it. Nothing else here moves.
export const HAS_PAYWALL = true

// Where an offer can be opened from. The backend's note beside
// offer_view (backend/core/events.py) must name exactly these — every
// funnel query slices on this, so a door added on one side only is a
// silently-missing column in the dashboard. The profile was a door of
// its own until plan 143 made its pass's footer the door to the
// balance sheet, which is where the offer is reached from there now;
// rows recorded before that still carry `where: 'profile'`.
export const SOURCES = Object.freeze({
  ONBOARDING: 'onboarding',   // the last boarding screen, under the pass
  BALANCE: 'balance',         // the balance sheet, off the HUD
  SETTINGS: 'settings',       // the settings list
  RUNOUT: 'runout',           // the run stopped at a zero balance
  RIDE: 'ride',               // the reading ride's pass plate (plan 097)
})

// ── The plans, as the owner priced them ────────────────────────
// Two paid plans and the free one (docs/business/tsuji-costs.xlsx, the
// "Pricing" and "Offer review" sheets). The strategy is one sentence:
// sell Pro yearly, and keep Max as the step up for a Pro learner who
// reaches a limit. So the offer opens on Pro alone (LEAD), with yearly
// picked and first (PROMOTED) at "5 € a month" beside the saving, and
// monthly under it as the anchor that makes yearly look like what it is.
// Max is not hidden -- "See all offers" lays it out under Pro -- but it
// is not what a first look is spent on.
//
// Prices are the full-price tier, VAT included, and are what the offer
// prints until a store answers with the learner's own (the store sets a
// price per country, and the regional tiers of the pricing sheet ride
// on that, not on this table). Every one is a store price point (x.99).
//
// The deck and card figures are the offer as decided. Max's are what
// the server enforces for the pass today (PASS_DECKS, PASS_CARDS); the
// server has one paid plan yet, so Pro's are the figures it will
// enforce once the plans are split with the store. Nothing is sold
// before then (HAS_STORE), so nothing here is a promise yet collected on.
export const CURRENCY = 'EUR'
export const PLAN_IDS = Object.freeze(['pro', 'max'])
export const BILLINGS = Object.freeze(['yearly', 'monthly'])
export const PLANS = Object.freeze({
  pro: Object.freeze({ yearly: 59.99, monthly: 8.99, decks: 30, cards: 400 }),
  max: Object.freeze({ yearly: 99.99, monthly: 14.99, decks: PASS_DECKS, cards: PASS_CARDS, photos: 20, explains: 30 }),
})
// The plans the offer opens on; the rest wait behind "See all offers".
export const LEAD = Object.freeze(['pro'])
// The pick the offer opens with.
export const PROMOTED = Object.freeze({ plan: 'pro', billing: 'yearly' })
// What each plan's panel lists, in order. The figures come from PLANS
// and, for the free side of a comparison, from domain/credits.js.
export const PERKS = Object.freeze({
  pro: Object.freeze(['reviews', 'practice', 'analyzer', 'decks']),
  max: Object.freeze(['everything', 'included', 'decks', 'allowance']),
})
// The free tier's figures a perk is compared with: what a free learner
// holds today, from the constants the server enforces.
export const FREE = Object.freeze({ decks: FREE_DECKS, cards: FREE_CARDS })

const cents = v => Math.round(v * 100) / 100

/** What a pick costs per charge: a year's price, or a month's. */
export function price(plan, billing) {
  return PLANS[plan][billing]
}

/** What a pick comes to a month -- a year's price spread over twelve. */
export function perMonth(plan, billing) {
  const p = PLANS[plan]
  return billing === 'yearly' ? cents(p.yearly / 12) : p.monthly
}

/** Twelve months paid monthly: the figure the yearly price is set against. */
export function monthsOfYear(plan) {
  return cents(PLANS[plan].monthly * 12)
}

/**
 * The yearly price's saving over twelve monthly ones, in whole percent,
 * rounded DOWN: the tag says 44 % where the arithmetic says 44.4, never
 * more than the learner actually saves.
 */
export function yearlySaving(plan) {
  const p = PLANS[plan]
  return Math.floor((1 - p.yearly / (p.monthly * 12)) * 100 + 1e-9)
}

/**
 * A price in the learner's language: "59,99 €" / "€59.99", and a whole
 * amount without its cents ("5 €", not "5,00 €") -- the year's price
 * spread over twelve is €4.9992, which is the "5 € a month" the offer
 * leads with.
 */
export function formatPrice(amount, lang) {
  const whole = Number.isInteger(cents(amount))
  return new Intl.NumberFormat(lang === 'fr' ? 'fr-FR' : 'en-US', {
    style: 'currency',
    currency: CURRENCY,
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: whole ? 0 : 2,
  }).format(amount)
}

/** A whole percent in the learner's language: "44 %" / "44%". */
export function formatPercent(n, lang) {
  return new Intl.NumberFormat(lang === 'fr' ? 'fr-FR' : 'en-US', {
    style: 'percent',
    maximumFractionDigits: 0,
  }).format(n / 100)
}

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
// (plan 125), the exams, and the analyzer (phrase, ocr and video).
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
