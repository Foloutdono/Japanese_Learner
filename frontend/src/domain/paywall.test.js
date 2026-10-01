import { describe, it, expect } from 'vitest'
import {
  PLANS, PLAN_IDS, BILLINGS, SOURCES, SCREENS, LIMITS, TRIAL_DAYS,
  offerScreen, offerPick, upgradePerMonth,
  price, perMonth, monthsOfYear, yearlySaving, formatPrice, formatPercent,
} from './paywall'
import { PASS_DECKS, PASS_CARDS } from './credits'

// ── The plans, as the owner priced them ─────────────────────────
// The strategy the offer is drawn to (docs/business/tsuji-costs.xlsx):
// Pro yearly is the headline at "5 € a month" with its saving, Pro
// monthly the anchor, Max the step up a Pro learner is offered at a
// ceiling (plan 171). These pin the arithmetic the screens print, so a
// price changed in one place cannot leave a stale saving or per-month
// figure in another.
const nbsp = s => s.replace(/[\u00a0\u202f]/g, ' ')

describe('the three offers', () => {
  it('opens the screen each door names', () => {
    expect(offerScreen(SOURCES.RUNOUT)).toBe(SCREENS.WEEK)
    expect(offerScreen(SOURCES.LIMIT)).toBe(SCREENS.MAX)
    expect(offerScreen(SOURCES.UPGRADE)).toBe(SCREENS.MAX)
    for (const door of [SOURCES.ONBOARDING, SOURCES.BALANCE, SOURCES.SETTINGS, SOURCES.RIDE]) {
      expect(offerScreen(door), door).toBe(SCREENS.DISCOVER)
    }
  })

  it('sells Pro yearly to a free learner and Max yearly to a Pro one', () => {
    expect(offerPick(SCREENS.DISCOVER)).toEqual({ plan: 'pro', billing: 'yearly' })
    expect(offerPick(SCREENS.WEEK)).toEqual({ plan: 'pro', billing: 'yearly' })
    expect(offerPick(SCREENS.MAX)).toEqual({ plan: 'max', billing: 'yearly' })
  })

  it("names Pro's four ceilings, each one Max doubles or lifts", () => {
    expect(LIMITS).toEqual(['practice', 'photos', 'explains', 'papers'])
    expect(PLANS.max.photos).toBe(2 * PLANS.pro.photos)
    expect(PLANS.max.explains).toBe(2 * PLANS.pro.explains)
    expect(PLANS.max.papers).toBe(2 * PLANS.pro.papers)
    expect(PLANS.pro.fare).toBe(1)
    expect(PLANS.max.fare).toBe(0)
    expect(TRIAL_DAYS).toBe(7)
  })

  it("prints the step up as the year's difference, a month", () => {
    expect(upgradePerMonth()).toBe(3.33)
  })
})

describe('the plans', () => {
  it('prices every plan on a store price point', () => {
    for (const id of PLAN_IDS) {
      for (const billing of BILLINGS) {
        const cents = Math.round(price(id, billing) * 100)
        expect(cents % 100, `${id} ${billing}`).toBe(99)
      }
    }
  })

  it('prints Max with the limits the server enforces for the pass today', () => {
    expect(PLANS.max.decks).toBe(PASS_DECKS)
    expect(PLANS.max.cards).toBe(PASS_CARDS)
  })

})

describe('the arithmetic', () => {
  it('spreads a year over twelve months, to the cent', () => {
    expect(perMonth('pro', 'yearly')).toBe(5)
    expect(perMonth('max', 'yearly')).toBe(8.33)
    expect(perMonth('pro', 'monthly')).toBe(8.99)
  })

  it('sets the yearly price against twelve monthly ones', () => {
    expect(monthsOfYear('pro')).toBe(107.88)
    expect(monthsOfYear('max')).toBe(179.88)
  })

  it('rounds the saving down, never promising more than it is', () => {
    // 1 - 59.99 / 107.88 = 44.39 %
    expect(yearlySaving('pro')).toBe(44)
    // 1 - 99.99 / 179.88 = 44.41 %
    expect(yearlySaving('max')).toBe(44)
  })
})

describe('formatPrice', () => {
  it('writes a price in the learner\'s language', () => {
    expect(nbsp(formatPrice(59.99, 'fr'))).toBe('59,99 €')
    expect(formatPrice(59.99, 'en')).toBe('€59.99')
  })

  it('drops the cents of a whole amount', () => {
    expect(nbsp(formatPrice(perMonth('pro', 'yearly'), 'fr'))).toBe('5 €')
    expect(formatPrice(perMonth('pro', 'yearly'), 'en')).toBe('€5')
    expect(formatPrice(8.33, 'en')).toBe('€8.33')
  })

  it('writes the saving as a percent the way each language does', () => {
    expect(nbsp(formatPercent(44, 'fr'))).toBe('44 %')
    expect(formatPercent(44, 'en')).toBe('44%')
  })
})
