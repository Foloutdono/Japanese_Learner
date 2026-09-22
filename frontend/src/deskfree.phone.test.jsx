import { describe, it, expect, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { LangProvider } from './LangContext'
import ModeSelector from './components/selection/ModeSelector'
import { RouteStops } from './components/selection/RouteStops'
import './index.css'

// ── 机 — nothing of the desk's second round reaches a phone (plan 113) ──
// The desk's layouts are written in one media block that a phone never
// matches (src/desk.css.test.js) and rendered only when hooks/useDesk
// says so. This file is the phone's side of each of them, one block per
// phase: at 390px every screen the desk re-lays keeps the phone's own
// arrangement. The existing phone contracts are not edited; these are
// additions.

vi.mock('./lib/audio', async o => ({ ...(await o()), playUi: vi.fn(), playClick: vi.fn() }))
globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })

const settle = (ms = 120) => new Promise(r => setTimeout(r, ms))

describe('the canvas and the lattices (P1)', () => {
  it('keeps the phone\'s column and its upright route', async () => {
    const stops = ['N5', 'N4', 'N3'].map(k => ({ key: k, code: k, name: k, total: 10, learned: 1 }))
    await render(
      <LangProvider>
        <div className="phone">
          <div className="phone__content">
            <main className="learn"><RouteStops stops={stops} here="N4" onSelect={() => {}} /></main>
          </div>
        </div>
      </LangProvider>
    )
    await settle()
    expect(getComputedStyle(document.querySelector('.phone__content')).maxWidth).toBe('none')
    expect(getComputedStyle(document.querySelector('.route')).flexDirection).toBe('column')
    const [a, b] = [...document.querySelectorAll('.route-stop')].map(el => el.getBoundingClientRect())
    expect(b.top).toBeGreaterThan(a.bottom)
  })

  it('keeps the platforms one to a row, the odd one not spanning', async () => {
    await render(
      <LangProvider>
        <main className="learn">
          <ModeSelector modes={[1, 2, 3].map(i => ({ key: `m${i}`, label: `M${i}` }))} onSelect={() => {}} />
        </main>
      </LangProvider>
    )
    await settle()
    const slots = [...document.querySelectorAll('.platform-slot')]
    expect(getComputedStyle(slots[2]).gridColumnStart).toBe('auto')
    const [a, b] = slots.map(el => el.getBoundingClientRect())
    expect(b.top).toBeGreaterThan(a.bottom - 1)
  })
})

describe('the gates (P2)', () => {
  it('keeps the Learn plate\'s three-stop foot', async () => {
    const { Plate, StopsFoot } = await import('./components/station/LinePlate')
    const stops = ['N5', 'N4', 'N3', 'N2', 'N1'].map((k, i) => ({ key: k, label: k, jp: false, score: i === 0 ? 0.4 : 0 }))
    await render(
      <LangProvider>
        <main className="learn">
          <div className="plates">
            <Plate section={{ path: '/learn/vocab', title: 'Vocab', color: 'var(--line-vocab)' }} foot={<StopsFoot stops={stops} />} />
          </div>
        </main>
      </LangProvider>
    )
    await settle()
    expect(document.querySelector('.plate__foot--stops')).not.toBeNull()
    expect(document.querySelector('.desk-line')).toBeNull()
  })
})

describe('the stations (P3)', () => {
  it('draws no split and marks no stop open', async () => {
    const { RouteStops } = await import('./components/selection/RouteStops')
    const stops = ['N5', 'N4'].map(k => ({ key: k, code: k, name: k }))
    await render(
      <LangProvider>
        <main className="learn"><RouteStops stops={stops} here="N4" onSelect={() => {}} /></main>
      </LangProvider>
    )
    await settle()
    expect(document.querySelector('.desk-split, .desk-stop--open, [aria-current="page"]')).toBeNull()
    expect(document.querySelector('[aria-current="location"]')).not.toBeNull()
  })
})
