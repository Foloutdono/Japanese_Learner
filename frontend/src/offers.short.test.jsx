import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { LangProvider } from './LangContext'
import './index.css'

// ── 定期券 — the offers on a short desk (plans 169, 171) ─────────────
// 1280×600, a laptop's window less its browser. The dialog keeps to the
// window: never past its foot, the stage whole in its pane, and the
// answer docked in view -- only the words scroll, when 3C's table needs
// more height than the window has.

vi.mock('./lib/supabase', () => ({
  supabase: { auth: { getSession: async () => ({ data: { session: null } }) } },
}))
vi.mock('./lib/track', () => ({ track: () => {}, EVENTS: {} }))

const credits = await import('./stores/credits')
const { OfferScreen } = await import('./components/offers/OfferScreen')

const settle = (ms = 350) => new Promise(r => setTimeout(r, ms))
const $ = sel => document.querySelector(sel)
const rect = sel => $(sel).getBoundingClientRect()

beforeEach(() => credits.closePaywall())

describe('the three offers on a short desk', () => {
  for (const [door, detail] of [['balance', {}], ['runout', {}], ['limit', { limit: 'papers' }], ['upgrade', {}]]) {
    it(`keeps ${detail.limit ?? door}'s offer in the window, its answer in view`, async () => {
      await render(<LangProvider><OfferScreen /></LangProvider>)
      credits.openPaywall(door, detail)
      await settle()
      await Promise.all($('.ofr').getAnimations().map(a => a.finished))

      const ofr = rect('.ofr')
      expect(ofr.top).toBeGreaterThanOrEqual(0)
      expect(ofr.bottom).toBeLessThanOrEqual(window.innerHeight)
      const hero = rect('.ofr__hero')
      const stage = rect('.ofr__stage')
      expect(stage.top).toBeGreaterThanOrEqual(hero.top)
      expect(stage.bottom).toBeLessThanOrEqual(hero.bottom)
      const gate = rect('.ofr__gate')
      expect(gate.bottom).toBeLessThanOrEqual(ofr.bottom)
      expect(rect('.ofr__quiet').top).toBeGreaterThan(ofr.top)
    })
  }
})
