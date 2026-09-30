import { describe, it, expect } from 'vitest'
import {
  PLANS, PLAN_IDS, BILLINGS, LEAD, PROMOTED, PERKS,
  price, perMonth, monthsOfYear, yearlySaving, formatPrice, formatPercent,
} from './paywall'
import { PASS_DECKS, PASS_CARDS } from './credits'

// ── The plans, as the owner priced them ─────────────────────────
// The strategy the offer is drawn to (docs/business/tsuji-costs.xlsx):
// Pro yearly is the headline at "5 € a month" with its saving, Pro
// monthly the anchor, Max the step up that waits behind "See all
// offers". These pin the arithmetic the screen prints, so a price
// changed in one place cannot leave a stale saving or per-month figure
// in another.
const nbsp = s => s.replace(/[\u00a0\u202f]/g, ' ')

describe('the plans', () => {
  it('opens on Pro alone, yearly picked', () => {
    expect(LEAD).toEqual(['pro'])
    expect(PROMOTED).toEqual({ plan: 'pro', billing: 'yearly' })
    // Max exists, and is the only plan the lead leaves out.
    expect(PLAN_IDS.filter(id => !LEAD.includes(id))).toEqual(['max'])
  })

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

  it('lists four perks a plan, drawn from the same ids for both', () => {
    for (const id of PLAN_IDS) expect(PERKS[id]).toHaveLength(4)
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
