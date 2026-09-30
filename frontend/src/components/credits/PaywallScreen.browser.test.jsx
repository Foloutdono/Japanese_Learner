import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { LangProvider } from '../../LangContext'
import '../../index.css'

// ── 定期券 — the offer ─────────────────────────────────────────
// The screen shown from all five doors and bought from none of them
// yet. Pinned here: the strategy it is drawn to (Pro alone, yearly
// picked, the month it comes to in the head and the saving on its row;
// Max only behind "See all offers"), the head following the pick, and
// the interest tap carrying the pick into the funnel rather than doing
// nothing.

vi.mock('../../lib/supabase', () => ({
  supabase: { auth: { getSession: async () => ({ data: { session: null } }) } },
}))
const track = vi.fn()
vi.mock('../../lib/track', () => ({ track: (...a) => track(...a), EVENTS: {} }))

const credits = await import('../../stores/credits')
const { PaywallScreen } = await import('./PaywallScreen')
const { PLANS, yearlySaving, monthsOfYear, formatPrice } = await import('../../domain/paywall')
const { FREE_DECKS, FREE_CARDS, DAILY_REFILL } = await import('../../domain/credits')

const settle = (ms = 60) => new Promise(r => setTimeout(r, ms))
const mount = () => render(<LangProvider><PaywallScreen /></LangProvider>)
const flat = s => s.replace(/[\s\u00a0\u202f]+/g, ' ').trim()
const $ = sel => document.querySelector(sel)
const $$ = sel => [...document.querySelectorAll(sel)]
// The test page's language: the provider reads the device's.
const lang = () => (document.documentElement.lang === 'fr' || navigator.language.startsWith('fr') ? 'fr' : 'en')

beforeEach(() => {
  credits.closePaywall()
  credits.seedCredits({ balance: 12, cap: 50, dailyRefill: DAILY_REFILL, nextCreditAt: null,
                        plan: 'free', unlimited: false, enforced: true })
  track.mockClear()
})

describe('PaywallScreen', () => {
  it('stays out until a door opens it', async () => {
    await mount()
    await settle()
    expect($('.pw')).toBeNull()
  })

  it('opens on Pro alone, yearly picked, with Max behind "See all offers"', async () => {
    await mount()
    credits.openPaywall('balance')
    await settle()

    const dialog = $('.pw')
    expect(dialog.getAttribute('role')).toBe('dialog')
    expect(dialog.getAttribute('aria-modal')).toBe('true')

    // One plan, two billings, yearly first and picked.
    expect($$('.pw-block').map(b => b.dataset.plan)).toEqual(['pro'])
    const rows = $$('.pw-plan')
    expect(rows.map(r => r.dataset.billing)).toEqual(['yearly', 'monthly'])
    expect(rows[0].getAttribute('aria-checked')).toBe('true')
    expect(rows[1].getAttribute('aria-checked')).toBe('false')
    expect($('[data-plan="max"]')).toBeNull()
    expect($('[data-action="paywall-all"]')).not.toBeNull()
  })

  it('leads with the month the year comes to, and the saving over twelve monthly payments', async () => {
    await mount()
    credits.openPaywall('balance')
    await settle()
    const l = lang()

    // "5 €": the year's price spread over twelve, whole.
    expect(flat($('.pw-head__fig').textContent)).toContain(flat(formatPrice(5, l)))
    expect(flat($('.pw-head__sub').textContent)).toContain(flat(formatPrice(PLANS.pro.yearly, l)))

    const yearly = $('.pw-plan[data-billing="yearly"]')
    expect(yearly.querySelector('.pw-tag').textContent).toContain(String(yearlySaving('pro')))
    // Twelve monthly payments struck through beside the year's price,
    // named for a screen reader rather than read as a second price.
    const was = yearly.querySelector('.pw-plan__was')
    expect(flat(was.textContent)).toBe(flat(formatPrice(monthsOfYear('pro'), l)))
    expect(was.getAttribute('aria-hidden')).toBe('true')
    expect(flat(yearly.querySelector('.pw-plan__price b').textContent)).toBe(flat(formatPrice(PLANS.pro.yearly, l)))
    expect(flat($('.pw-plan[data-billing="monthly"] .pw-plan__price b').textContent))
      .toBe(flat(formatPrice(PLANS.pro.monthly, l)))

    // Pro's decks beside what a free learner holds today.
    const perks = flat($('.pw-perks__list').textContent)
    expect(perks).toContain(String(PLANS.pro.decks))
    expect(perks).toContain(String(FREE_DECKS))
    expect(perks).toContain(String(FREE_CARDS))
  })

  it('turns the head with the pick, so monthly shows what it costs', async () => {
    await mount()
    credits.openPaywall('balance')
    await settle()
    $('.pw-plan[data-billing="monthly"]').click()
    await settle()

    expect($('.pw-plan[data-billing="monthly"]').getAttribute('aria-checked')).toBe('true')
    expect($('.pw-plan[data-billing="yearly"]').getAttribute('aria-checked')).toBe('false')
    expect(flat($('.pw-head__fig').textContent)).toContain(flat(formatPrice(PLANS.pro.monthly, lang())))
  })

  it('lays Max out under Pro on "See all offers", Pro yearly still picked', async () => {
    await mount()
    credits.openPaywall('settings')
    await settle()
    $('[data-action="paywall-all"]').click()
    await settle()

    expect($$('.pw-block').map(b => b.dataset.plan)).toEqual(['pro', 'max'])
    expect($('[data-action="paywall-all"]')).toBeNull()
    // The button that had the focus is gone: the focus is on Max.
    expect(document.activeElement.closest('[data-plan="max"]')).not.toBeNull()
    // Nothing picked for the learner.
    expect($('[data-plan="pro"] .pw-plan[data-billing="yearly"]').getAttribute('aria-checked')).toBe('true')
    expect($$('[data-plan="max"] .pw-plan[aria-checked="true"]')).toHaveLength(0)

    // A pick is the offer's, not a plan's: one row checked across both.
    $('[data-plan="max"] .pw-plan[data-billing="yearly"]').click()
    await settle()
    expect($$('.pw-plan[aria-checked="true"]')).toHaveLength(1)
    expect(flat($('.pw-head__fig').textContent)).toContain(flat(formatPrice(8.33, lang())))
    const perks = flat($('[data-plan="max"] .pw-perks__list').textContent)
    expect(perks).toContain(PLANS.max.cards.toLocaleString(lang() === 'fr' ? 'fr-FR' : 'en-US').replace(/[\s\u00a0\u202f]+/g, ' '))
  })

  it('answers the interest tap with the pick, instead of doing nothing', async () => {
    await mount()
    credits.openPaywall('runout')
    await settle()

    const cta = $('.pw__cta')
    expect(cta).not.toBeNull()
    track.mockClear()
    cta.click()
    await settle()

    // The button is replaced by the confirmation, in a live region so
    // it is announced rather than silently swapped.
    expect($('.pw__cta')).toBeNull()
    const thanks = $('.pw__thanks')
    expect(thanks).not.toBeNull()
    expect(thanks.getAttribute('role')).toBe('status')
    // The focus goes to the way out rather than to the page behind.
    expect(document.activeElement).toBe($('.pw__later'))
    // Name, door, the deliberation time, and the pick it was pressed on.
    expect(track.mock.calls).toHaveLength(1)
    const [name, props] = track.mock.calls[0]
    expect(name).toBe('offer_intent')
    expect(props).toMatchObject({ where: 'runout', plan: 'pro', billing: 'yearly', all: false })
    expect(Number.isInteger(props.ms)).toBe(true)
  })

  it('closes without recording an intent when it is dismissed', async () => {
    await mount()
    credits.openPaywall('ride')
    await settle()
    track.mockClear()

    $('.pw__later').click()
    await settle()

    expect($('.pw')).toBeNull()
    expect(track.mock.calls).toHaveLength(1)
    expect(track.mock.calls[0][0]).toBe('offer_dismiss')
    expect(track.mock.calls[0][1]).toMatchObject({ where: 'ride', all: false })
  })
})
