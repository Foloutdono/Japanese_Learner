import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { LangProvider } from '../../LangContext'
import '../../index.css'

// ── 案内 — the guide over a gate (plan 100) ──────────────────────
// On fixture markup carrying the learn gate's anchors: the spot frames
// the anchor, Next walks the stops, a missing anchor is skipped in
// silence, Escape and Skip end it as a skip, Done as not.

const track = vi.fn()
vi.mock('../../lib/track', () => ({ track: (...a) => track(...a), flush: vi.fn() }))
vi.mock('../../lib/audio', async (o) => ({ ...(await o()), playClick: vi.fn() }))
globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })

const { Guide } = await import('./Guide')
const { default: fr } = await import('../../locales/fr/index.js')

const settle = (ms = 80) => new Promise(r => setTimeout(r, ms))
const guideEl = () => [...document.querySelectorAll('.guide')].at(-1)
const rect = el => el.getBoundingClientRect()

function Fixture({ shelf = true }) {
  return (
    <main style={{ padding: 16 }}>
      <div className="plate" data-guide="learn.plate" style={{ height: 120, margin: '80px 0 12px' }}>
        <span className="plate__foot" data-guide="learn.stops" style={{ display: 'block', height: 24 }}>N5 · N4 · N3</span>
      </div>
      {shelf && <div className="plate" data-guide="learn.shelf" style={{ height: 120 }} />}
    </main>
  )
}

function mount(props = {}, fixture = {}) {
  return render(
    <LangProvider>
      <Fixture {...fixture} />
      <Guide gate="learn" {...props} />
    </LangProvider>
  )
}

beforeEach(() => { track.mockReset() })

describe('Guide', () => {
  it('frames each stop in turn and ends on Done as not skipped', async () => {
    const onEnd = vi.fn()
    await mount({ onEnd })
    await settle(900)
    const spot = guideEl().querySelector('.guide__spot')
    const note = guideEl().querySelector('.guide-callout--live')
    expect(spot).toBeTruthy()
    expect(note.getAttribute('role')).toBe('dialog')
    // The spot sits around the plate, a little wider than it.
    const plate = document.querySelector('[data-guide="learn.plate"]')
    expect(rect(spot).top).toBeLessThanOrEqual(rect(plate).top)
    expect(rect(spot).bottom).toBeGreaterThanOrEqual(rect(plate).bottom)
    expect(note.querySelector('.guide-callout__text').textContent).toBe(fr.guideLearnPlate)
    // Counted over the stops on the screen: the library's panel is the
    // desk's, and this gate draws the phone's three.
    expect(note.querySelector('.guide-callout__count').textContent).toBe('1/3')
    expect(note.querySelector('[data-action="guide-next"]').textContent).toBe(fr.guideNext)

    note.querySelector('[data-action="guide-next"]').click()
    await settle(150)
    expect(guideEl().dataset.stop).toBe('learn.stops')
    note.querySelector('[data-action="guide-next"]').click()
    await settle(150)
    expect(guideEl().dataset.stop).toBe('learn.shelf')
    const done = guideEl().querySelector('[data-action="guide-next"]')
    expect(done.textContent).toBe(fr.guideDone)
    done.click()
    await settle(50)
    expect(onEnd).toHaveBeenCalledWith(false, 3)
    const steps = track.mock.calls.filter(([n]) => n === 'guide_step').map(([, p]) => p.stop)
    expect(steps).toEqual(['learn.plate', 'learn.stops', 'learn.shelf'])
    expect(track.mock.calls.find(([n]) => n === 'guide_done')[1]).toMatchObject({ gate: 'learn', skipped: false, stops: 3 })
  })

  it('takes focus itself on open, and Tab reaches Skip then Next', async () => {
    await mount({ onEnd: vi.fn() })
    await settle(900)
    const note = guideEl().querySelector('.guide-callout--live')
    expect(document.activeElement).toBe(note)
    // No control wears the ring on open; the note shows none of its own.
    expect(getComputedStyle(note).outlineStyle).toBe('none')
    note.querySelector('[data-action="guide-skip"]').focus()
    expect(document.activeElement.dataset.action).toBe('guide-skip')
  })

  it('skips a stop whose anchor is not on the screen', async () => {
    const onEnd = vi.fn()
    await mount({ onEnd }, { shelf: false })
    await settle(900)
    expect(guideEl().querySelector('.guide-callout__count').textContent).toBe('1/2')
    guideEl().querySelector('[data-action="guide-next"]').click()
    await settle(150)
    expect(guideEl().querySelector('[data-action="guide-next"]').textContent).toBe(fr.guideDone)
  })

  it('Skip and Escape end it as a skip, with how far it got', async () => {
    let onEnd = vi.fn()
    let screen = await mount({ onEnd })
    await settle(900)
    guideEl().querySelector('[data-action="guide-next"]').click()
    await settle(150)
    guideEl().querySelector('[data-action="guide-skip"]').click()
    await settle(50)
    expect(onEnd).toHaveBeenCalledWith(true, 3)
    expect(track.mock.calls.find(([n]) => n === 'guide_done')[1]).toMatchObject({ skipped: true, stops: 1 })
    screen.unmount()

    onEnd = vi.fn()
    track.mockReset()
    screen = await mount({ onEnd })
    await settle(900)
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await settle(50)
    expect(onEnd).toHaveBeenCalledWith(true, 3)
    screen.unmount()
  })
})
