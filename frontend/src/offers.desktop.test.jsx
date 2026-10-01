import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { userEvent } from 'vitest/browser'
import { LangProvider } from './LangContext'
import './index.css'

// ── 定期券 — the three offers on the desk (plan 171) ────────────────
// The owner's pick A 対 of the canvas's Desktop page: the offer is a
// dialog in the window's middle, the stage beside the words. The
// phone's stage drawing stands whole in the left pane, scaled; the
// words and the foot stand in the right pane at the phone's width, so
// they wrap as on a phone. The desk prints its keys: Enter on the gate,
// which has the focus, and Esc at the dialog's corner.

vi.mock('./lib/supabase', () => ({
  supabase: { auth: { getSession: async () => ({ data: { session: null } }) } },
}))
const track = vi.fn()
vi.mock('./lib/track', () => ({ track: (...a) => track(...a), EVENTS: {} }))

const credits = await import('./stores/credits')
const { OfferScreen } = await import('./components/offers/OfferScreen')

const settle = (ms = 350) => new Promise(r => setTimeout(r, ms))
const $ = sel => document.querySelector(sel)
const rect = sel => $(sel).getBoundingClientRect()

// What a fixed box is laid out in: the window less the scrollbar gutter
// the root keeps stable.
function viewport() {
  const probe = document.createElement('div')
  probe.style.cssText = 'position: fixed; inset: 0'
  document.body.appendChild(probe)
  const box = probe.getBoundingClientRect()
  probe.remove()
  return box
}

beforeEach(() => {
  credits.closePaywall()
  track.mockClear()
})

const DOORS = [['balance', {}], ['runout', {}], ['limit', { limit: 'practice' }], ['limit', { limit: 'explains' }], ['upgrade', {}]]

describe('the three offers on the desk', () => {
  for (const [door, detail] of DOORS) {
    it(`sets ${detail.limit ?? door}'s offer in the window's middle, the stage beside the words`, async () => {
      await render(<LangProvider><OfferScreen /></LangProvider>)
      credits.openPaywall(door, detail)
      await settle()
      await Promise.all($('.ofr').getAnimations().map(a => a.finished))

      const ofr = rect('.ofr')
      const glass = viewport()
      expect(ofr.width).toBe(920)
      expect(Math.abs(ofr.left + ofr.width / 2 - (glass.left + glass.width / 2))).toBeLessThanOrEqual(1)
      expect(Math.abs(ofr.top + ofr.height / 2 - (glass.top + glass.height / 2))).toBeLessThanOrEqual(1)
      expect(ofr.bottom).toBeLessThanOrEqual(glass.bottom)
      expect(getComputedStyle($('.ofr-scrim')).backgroundColor).not.toBe('rgba(0, 0, 0, 0)')

      // The stage pane: the dialog's left, its whole height.
      const hero = rect('.ofr__hero')
      expect(hero.left).toBe(ofr.left + 1)
      expect(Math.round(hero.height)).toBe(Math.round(ofr.height - 2))
      // The drawing centred in it, scaled up from the phone's, and its
      // subject whole: the stage's box, or the pass that turns over
      // (3C's box is wider than the pane, its edges only the light).
      const stage = rect('.ofr__stage')
      expect(stage.width).toBeGreaterThan(390)
      expect(Math.abs(stage.left + stage.width / 2 - (hero.left + hero.width / 2))).toBeLessThanOrEqual(1)
      const subject = rect($('.ofr-turn__hold') ? '.ofr-turn__hold' : '.ofr__stage')
      expect(subject.left).toBeGreaterThanOrEqual(hero.left)
      expect(subject.right).toBeLessThanOrEqual(hero.right + 1)
      expect(subject.top).toBeGreaterThanOrEqual(hero.top)
      expect(subject.bottom).toBeLessThanOrEqual(hero.bottom)

      // The words and the answer beside it, at the phone's width.
      const body = rect('.ofr__body')
      expect(body.left).toBeGreaterThanOrEqual(hero.right)
      expect(body.width).toBe(390)
      const gate = rect('.ofr__gate')
      expect(gate.left).toBeGreaterThanOrEqual(hero.right)
      expect(gate.bottom).toBeLessThanOrEqual(ofr.bottom)
      expect(rect('.ofr__quiet').bottom).toBeLessThanOrEqual(gate.top)

      // The keys: Enter on the gate, Esc at the corner.
      expect($('.ofr__gate .desk-kbd')).not.toBeNull()
      const esc = rect('.ofr__esc')
      expect(esc.right).toBeLessThanOrEqual(ofr.right)
      expect(esc.top).toBeGreaterThanOrEqual(ofr.top)
    })
  }

  it('opens with the gate in hand: Enter takes the offer, Esc puts it away', async () => {
    await render(<LangProvider><OfferScreen /></LangProvider>)
    credits.openPaywall('balance')
    await settle()
    expect(document.activeElement).toBe($('.ofr__gate'))
    await userEvent.keyboard('{Enter}')
    await settle()
    expect(track.mock.calls.map(c => c[0])).toEqual(['offer_view', 'offer_intent'])
    expect($('.ofr__thanks')).not.toBeNull()
    await userEvent.keyboard('{Escape}')
    await settle()
    expect($('.ofr')).toBeNull()
  })

  it('prints no key on the phone\'s DOM it does not hold', async () => {
    await render(<LangProvider><OfferScreen /></LangProvider>)
    credits.openPaywall('runout')
    await settle()
    // The way out is the phone's: no key inside it.
    expect($('.ofr__quiet .desk-kbd')).toBeNull()
  })
})
