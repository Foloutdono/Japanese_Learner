import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { LangProvider } from './LangContext'
import './index.css'

// ── 定期券 — the three offers on the desk (plan 171) ────────────────
// The desk keeps the offer as a dialog (docs/design/desk/README.md,
// "Dialogs on the desk"): in the window's middle at the width its
// stage was drawn for, the scrim dimming the page, never taller than
// the window -- and a window too short for it scrolls the stage and
// the words while the answer stays docked at its foot.

vi.mock('./lib/supabase', () => ({
  supabase: { auth: { getSession: async () => ({ data: { session: null } }) } },
}))
vi.mock('./lib/track', () => ({ track: () => {}, EVENTS: {} }))

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

beforeEach(() => credits.closePaywall())

describe('the three offers on the desk', () => {
  for (const [door, detail] of [['balance', {}], ['runout', {}], ['limit', { limit: 'explains' }], ['upgrade', {}]]) {
    it(`sets ${door}'s offer in the window's middle, at its stage's width`, async () => {
      await render(<LangProvider><OfferScreen /></LangProvider>)
      credits.openPaywall(door, detail)
      await settle()
      await Promise.all($('.ofr').getAnimations().map(a => a.finished))

      const ofr = rect('.ofr')
      const glass = viewport()
      expect(ofr.width).toBe(390)
      expect(Math.abs(ofr.left + ofr.width / 2 - (glass.left + glass.width / 2))).toBeLessThanOrEqual(1)
      expect(ofr.top).toBeGreaterThanOrEqual(glass.top + 44)
      expect(ofr.bottom).toBeLessThanOrEqual(glass.bottom - 44)
      expect(getComputedStyle($('.ofr-scrim')).backgroundColor).not.toBe('rgba(0, 0, 0, 0)')

      // The stage is drawn at its own width, centred in the dialog.
      const stage = rect('.ofr__stage')
      expect(stage.width).toBe(390)
      expect(stage.left).toBe(ofr.left)

      // The answer docked at the foot, in the window.
      const gate = rect('.ofr__gate')
      expect(gate.bottom).toBeLessThanOrEqual(ofr.bottom)
      expect(gate.top).toBeGreaterThan(ofr.top)
    })
  }
})
