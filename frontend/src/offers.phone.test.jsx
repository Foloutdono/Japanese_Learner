import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { LangProvider } from './LangContext'
import './index.css'

// ── 定期券 — the three offers on a phone (plan 172) ─────────────────
// 390×844, the size the owner's canvas drew every board at. Each of the
// seven screens takes the glass, its stage across the top at the
// canvas's height, its words and its docked answer under it -- and
// reads whole without a scroll, as the canvas does. Nothing is wider
// than the phone.

vi.mock('./lib/supabase', () => ({
  supabase: { auth: { getSession: async () => ({ data: { session: null } }) } },
}))
vi.mock('./lib/track', () => ({ track: () => {}, EVENTS: {} }))

const credits = await import('./stores/credits')
const { seedSummary } = await import('./stores/profileSummary')
const { OfferScreen } = await import('./components/offers/OfferScreen')

const settle = (ms = 350) => new Promise(r => setTimeout(r, ms))
const $ = sel => document.querySelector(sel)
const rect = sel => $(sel).getBoundingClientRect()

// What a fixed box is laid out in: the window less the scrollbar gutter
// the root keeps stable (the claim sheet's test measures the same way).
function viewport() {
  const probe = document.createElement('div')
  probe.style.cssText = 'position: fixed; inset: 0'
  document.body.appendChild(probe)
  const box = probe.getBoundingClientRect()
  probe.remove()
  return box
}

const DOORS = [
  ['discover', 'balance', {}],
  ['week', 'runout', { waiting: 12 }],
  ['practice', 'limit', { limit: 'practice' }],
  ['photos', 'limit', { limit: 'photos' }],
  ['explains', 'limit', { limit: 'explains' }],
  ['papers', 'limit', { limit: 'papers' }],
  ['upgrade', 'upgrade', {}],
]

beforeEach(() => {
  credits.closePaywall()
  seedSummary({ username: 'Aiko', level: 12, xp: 640, xpPrevLevel: 0, xpForNext: 1000, motive: 'trip', jlptLevel: 'N4' })
  credits.seedCredits({ balance: 0, cap: 30, dailyRefill: 30, nextCreditAt: '2026-10-01T14:32:00Z',
                        plan: 'free', unlimited: false, enforced: true })
  credits.seedOfferWeek({
    days: [22, 30, 30, 30, 18, 30, 28].map((reviewed, i) => ({ date: `2026-09-2${i + 1}`, reviewed, waited: [0, 8, 0, 15, 0, 11, 0][i] })),
    cap: 30, stops: 3, waited: 34,
  })
})

describe('the three offers on a phone', () => {
  for (const [name, door, detail] of DOORS) {
    it(`draws ${name} whole on the glass, its answer docked in view`, async () => {
      await render(<LangProvider><OfferScreen /></LangProvider>)
      credits.openPaywall(door, detail)
      await settle()
      await Promise.all($('.ofr').getAnimations().map(a => a.finished))

      const ofr = rect('.ofr')
      const glass = viewport()
      expect(ofr.top).toBe(glass.top)
      expect(ofr.left).toBe(glass.left)
      expect(ofr.width).toBe(glass.width)
      expect(ofr.height).toBe(glass.height)

      // The stage across the top, at the canvas's height.
      const hero = rect('.ofr__hero')
      expect(hero.width).toBe(ofr.width)
      expect(hero.height).toBe(name === 'upgrade' ? 252 : 344)

      // Whole without a scroll, and nothing wider than the phone.
      const scroll = $('.ofr__scroll')
      expect(scroll.scrollHeight).toBeLessThanOrEqual(scroll.clientHeight)
      expect($('.ofr').scrollWidth).toBeLessThanOrEqual(ofr.width)
      expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(glass.width)

      // The gate on the glass, at a thumb's reach, the way out over it.
      const gate = rect('.ofr__gate')
      expect(gate.bottom).toBeLessThanOrEqual(glass.bottom)
      expect(gate.height).toBeGreaterThanOrEqual(66)
      expect(rect('.ofr__quiet').bottom).toBeLessThanOrEqual(gate.top)
      expect(rect('.ofr__quiet').height).toBeGreaterThanOrEqual(44)
      // The ticket fits its words: the price never breaks.
      expect(rect('.ofr-tkt__price').height).toBeLessThan(48)
    })
  }
})
