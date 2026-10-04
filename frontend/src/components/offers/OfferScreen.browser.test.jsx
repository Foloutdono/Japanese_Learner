import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { LangProvider } from '../../LangContext'
import '../../index.css'

// ── 定期券 — the three offers (plan 172) ────────────────────────────
// The screen every door opens, and which of the three it is is the
// door's: the trial (DISCOVER), a free learner's own week against the
// refill (WEEK), and the step up to Max at one of Pro's ceilings or
// from Settings (MAX). Pinned here: each door's screen and what it
// prints from the learner's own figures, the gate recording the
// offer's one pick, and the way out recording a dismissal.

vi.mock('../../lib/supabase', () => ({
  supabase: { auth: { getSession: async () => ({ data: { session: null } }) } },
}))
const track = vi.fn()
vi.mock('../../lib/track', () => ({ track: (...a) => track(...a), EVENTS: {} }))

const credits = await import('../../stores/credits')
const { seedSummary } = await import('../../stores/profileSummary')
const { OfferScreen } = await import('./OfferScreen')
const { weekDays } = await import('./format')
const { translations } = await import('../../i18n')

const settle = (ms = 60) => new Promise(r => setTimeout(r, ms))
const mount = () => render(<LangProvider><OfferScreen /></LangProvider>)
const flat = s => s.replace(/[\s\u00a0\u202f]+/g, ' ').trim()
const $ = sel => document.querySelector(sel)
const $$ = sel => [...document.querySelectorAll(sel)]
// The lanes run on a French device (vite.config.js).
const t = () => translations.fr

const WEEK = {
  days: [
    { date: '2026-09-21', reviewed: 22, waited: 0 },
    { date: '2026-09-22', reviewed: 30, waited: 8 },
    { date: '2026-09-23', reviewed: 30, waited: 0 },
    { date: '2026-09-24', reviewed: 30, waited: 15 },
    { date: '2026-09-25', reviewed: 18, waited: 0 },
    { date: '2026-09-26', reviewed: 30, waited: 11 },
    { date: '2026-09-27', reviewed: 28, waited: 0 },
  ],
  cap: 30,
  stops: 3,
  waited: 34,
}

beforeEach(() => {
  credits.closePaywall()
  seedSummary({ username: 'Aiko', level: 12, xp: 640, xpPrevLevel: 0, xpForNext: 1000, motive: 'trip', jlptLevel: 'N4' })
  credits.seedCredits({ balance: 0, cap: 30, dailyRefill: 30, nextCreditAt: '2026-10-01T14:32:00Z',
                        plan: 'free', unlimited: false, enforced: true })
  credits.seedOfferWeek(WEEK)
  track.mockClear()
})

describe('OfferScreen', () => {
  it('stays out until a door opens it', async () => {
    await mount()
    await settle()
    expect($('.ofr')).toBeNull()
  })

  it('opens the trial as a modal dialog, speaking to why the learner came', async () => {
    await mount()
    credits.openPaywall('balance')
    await settle()
    const dialog = $('.ofr')
    expect(dialog.dataset.screen).toBe('discover')
    expect(dialog.getAttribute('role')).toBe('dialog')
    expect(dialog.getAttribute('aria-modal')).toBe('true')
    expect($('.ofr__eyebrow').textContent).toBe(t().ofrDiscEyebrow.trip)
    // Six platforms bloom out of the lock, and one card plays the
    // sentence through each of them.
    expect($$('.ofr-disc-tile')).toHaveLength(6)
    expect($$('.ofr-disc-pane')).toHaveLength(6)
    expect(flat($('.ofr-tkt__price').textContent)).toContain('0 €')
  })

  it('takes the trial as Pro yearly, once, and says it is noted', async () => {
    await mount()
    credits.openPaywall('settings')
    await settle()
    track.mockClear()
    $('[data-action="paywall-intent"]').click()
    await settle()
    expect(track.mock.calls).toEqual([['offer_intent', expect.objectContaining({ where: 'settings', plan: 'pro', billing: 'yearly' })]])
    expect($('[data-action="paywall-intent"]')).toBeNull()
    expect($('.ofr__thanks').getAttribute('role')).toBe('status')
    expect($('.ofr__quiet').textContent).toBe(t().close)
    expect(document.activeElement).toBe($('.ofr__quiet'))
  })

  it("draws the free learner's own week, the stops and the cards that waited", async () => {
    await mount()
    credits.openPaywall('runout')
    await settle()
    expect($('.ofr').dataset.screen).toBe('week')
    expect($$('.ofr-week__col')).toHaveLength(7)
    expect($$('.ofr-week__wait')).toHaveLength(3)
    expect($('.ofr__title').textContent).toBe(t().ofrWeekTitle(3))
    expect($('.ofr__lede').textContent).toBe(t().ofrWeekLede(34))
    // The chart says it in words too: status is never colour alone.
    expect($('.ofr-week').getAttribute('aria-label')).toBe(t().ofrWeekChart(3, 34))
    // The way out waits for the refill, at its clock.
    expect($('.ofr__quiet .ofr__clock')).not.toBeNull()
  })

  it("counts the run that just stopped as today's wait, before the server has it", () => {
    const days = weekDays(WEEK, 12)
    expect(days.at(-1).waited).toBe(12)
    expect(days.slice(0, -1)).toEqual(WEEK.days.slice(0, -1))
    // And never less than the server already counted.
    expect(weekDays({ days: [{ date: '2026-09-27', reviewed: 0, waited: 20 }] }, 5)[0].waited).toBe(20)
  })

  it('opens each of Pro\'s ceilings on its own stage, naming it on the stub', async () => {
    await mount()
    const stubs = { practice: '0', photos: '20', explains: '30', papers: '8' }
    for (const [limit, save] of Object.entries(stubs)) {
      credits.openPaywall('limit', { limit })
      await settle()
      expect($('.ofr').dataset.screen).toBe('max')
      expect($('.ofr').dataset.limit).toBe(limit)
      expect($('.ofr-tkt__save').textContent).toBe(save)
      expect(flat($('.ofr-tkt__price').textContent)).toContain('3,33')
      credits.closePaywall()
      await settle()
    }
  })

  it('prints a counter at its limit in red, and Max\'s allowances as written', async () => {
    // Every animation of an element held at one instant of its loop.
    const at = (el, ms) => {
      el.getAnimations().forEach(a => { a.pause(); a.currentTime = ms })
      return getComputedStyle(el).color
    }
    await mount()
    credits.openPaywall('limit', { limit: 'photos' })
    await settle()
    // 10 / 10: the count is the limit's red, then white under 20.
    expect(at($('.ofr-cap-num'), 0)).toBe('rgb(255, 155, 134)')
    expect(at($('.ofr-cap-num'), 4000)).not.toBe('rgb(255, 155, 134)')
    credits.closePaywall()
    await settle()

    // 3A writes Max's allowances down from the start, in the page's
    // ink, and only shakes them as they grow when the switch turns.
    credits.openPaywall('limit', { limit: 'practice' })
    await settle()
    const vals = [...document.querySelectorAll('.ofr-fare-val__n')]
    expect(vals.map(v => v.textContent)).toEqual(['20', '30', '8'])
    const ink = getComputedStyle($('.ofr__title')).color
    expect(at(vals[0], 0)).toBe(ink)
    expect(getComputedStyle(vals[0]).transform).toBe('none')
    at(vals[0], 6000)
    expect(getComputedStyle(vals[0]).transform).not.toBe('none')
  })

  it('lays out what Max changes from Settings, every figure on one line', async () => {
    await mount()
    credits.openPaywall('upgrade')
    await settle()
    expect($('.ofr__hero--upgrade')).not.toBeNull()
    expect($$('.ofr-turn__face')).toHaveLength(2)
    expect($$('.ofr-grid__row')).toHaveLength(6)
    // Max's figures are written in the table, not counted: they are
    // revealed as the pass lands.
    expect($$('.ofr-grid__val').map(v => flat(v.textContent))).toEqual(['Sans crédit', '20', '30', '8', '100 · 10 000'])
    const first = $('.ofr-grid__val').getAnimations()
    expect(first.map(a => a.animationName)).toEqual(['ofr-grid-reveal'])
    const decks = $$('.ofr-grid__row').at(-1).querySelector('.ofr-grid__max')
    expect(flat(decks.textContent)).toBe('100 · 10 000')
    // The widest figure never breaks.
    expect(decks.getBoundingClientRect().height).toBeLessThan(40)
  })

  it('closes on its way out and records the dismissal', async () => {
    await mount()
    credits.openPaywall('balance')
    await settle()
    track.mockClear()
    $('[data-action="paywall-later"]').click()
    await settle()
    expect($('.ofr')).toBeNull()
    expect(track.mock.calls[0]).toEqual(['offer_dismiss', expect.objectContaining({ where: 'balance' })])
  })
})
