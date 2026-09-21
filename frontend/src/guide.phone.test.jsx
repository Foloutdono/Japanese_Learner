import { describe, it, expect, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { LangProvider } from './LangContext'
import './index.css'

// ── 案内 at phone width (plan 100) ───────────────────────────────
// The note never leaves the viewport: under a spot on the HUD at the
// top edge, above a spot on the tab bar at the bottom edge; the two
// controls are 44 px targets.

vi.mock('./lib/track', () => ({ track: vi.fn(), flush: vi.fn() }))
vi.mock('./lib/audio', async (o) => ({ ...(await o()), playClick: vi.fn() }))
globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })

const { Guide } = await import('./components/guide/Guide')
const settle = (ms = 120) => new Promise(r => setTimeout(r, ms))
const rect = el => el.getBoundingClientRect()

describe('the guide at 390×844', () => {
  it('keeps the note in the viewport at both edges, with thumb-sized controls', async () => {
    expect(window.innerWidth).toBe(390)
    await render(
      <LangProvider>
        <div className="phone">
          <header className="hud" style={{ position: 'fixed', top: 0, left: 0, right: 0 }}><div className="hud__inner">
            <button type="button" className="hud__level" data-guide="hud.level"><span>1</span></button>
          </div></header>
          <div className="phone__content"><main style={{ height: 1200 }} /></div>
          <nav className="tabbar" data-guide="tabbar" style={{ position: 'fixed', bottom: 0, left: 0, right: 0 }}><div className="tabbar__inner" /></nav>
        </div>
        <Guide gate="today" onEnd={() => {}} />
      </LangProvider>
    )
    await settle(900)
    // hud.level is the first stop of today's guide: the spot is at the
    // top edge and the note is under it, inside the screen.
    let note = document.querySelector('.guide-callout--live')
    expect(document.querySelector('.guide').dataset.stop).toBe('hud.level')
    expect(note.dataset.place).toBe('below')
    expect(rect(note).top).toBeGreaterThanOrEqual(rect(document.querySelector('.guide__spot')).bottom - 1)
    expect(rect(note).bottom).toBeLessThanOrEqual(window.innerHeight)
    expect(rect(note).left).toBeGreaterThanOrEqual(0)
    expect(rect(note).right).toBeLessThanOrEqual(window.innerWidth)
    for (const sel of ['[data-action="guide-next"]', '[data-action="guide-skip"]']) {
      expect(rect(note.querySelector(sel)).height).toBeGreaterThanOrEqual(44)
    }
    // The other today stops are not on this fixture; Next reaches the
    // tab bar, whose note sits above it.
    document.querySelector('[data-action="guide-next"]').click()
    await settle(900)
    expect(document.querySelector('.guide').dataset.stop).toBe('tabbar')
    note = document.querySelector('.guide-callout--live')
    expect(note.dataset.place).toBe('above')
    expect(rect(note).bottom).toBeLessThanOrEqual(rect(document.querySelector('.guide__spot')).top + 1)
    expect(rect(note).top).toBeGreaterThanOrEqual(0)
  })
})
