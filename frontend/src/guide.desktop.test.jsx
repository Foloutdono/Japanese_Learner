import { describe, it, expect, vi, afterEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { userEvent } from 'vitest/browser'
import { LangProvider } from './LangContext'
import './index.css'

// ── 机 — the guide at a desk (plan 123, P13) ───────────────────────
// Three things the guide did as a phone does:
//   - a note under an anchor in the page stood on the canvas's middle,
//     half over the neighbour of a plate in a grid of two, and 640px
//     wide under a 400px plate; it now stands on its anchor, as wide as
//     the anchor between a column and a card;
//   - Next took no key and printed none -- Tab, Tab, Enter at every
//     stop; → is Next anywhere and Enter on the note, and neither
//     reaches the page under it, while Enter on a focused Skip skips;
//   - Today's stops walked the rail's foot, the side's top, the gate
//     and the rail's top; the desk walks them down the rail, then the
//     gate and the strip.

vi.mock('./lib/track', () => ({ track: vi.fn(), flush: vi.fn() }))
vi.mock('./lib/audio', async o => ({ ...(await o()), playClick: vi.fn() }))

const { Guide } = await import('./components/guide/Guide')
const { default: en } = await import('./locales/en/index.js')
const { default: fr } = await import('./locales/fr/index.js')

const settle = (ms = 200) => new Promise(r => setTimeout(r, ms))
const $ = s => document.querySelector(s)
const box = el => el.getBoundingClientRect()
const mid = r => (r.left + r.right) / 2
const stopOf = () => $('.guide')?.dataset.stop ?? null

function Learn({ onEnd }) {
  return (
    <LangProvider>
      <div className="phone phone--desk">
        <div className="phone__content">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 22 }}>
            <div data-guide="learn.plate" style={{ height: 180 }}>plate</div>
            <div style={{ height: 180 }}>the next plate</div>
          </div>
          <div data-guide="learn.stops" style={{ height: 60 }}>stops</div>
        </div>
      </div>
      <Guide gate="learn" onEnd={onEnd} />
    </LangProvider>
  )
}

const heard = vi.fn()
const listen = e => heard(e.key)
afterEach(() => { window.removeEventListener('keydown', listen); heard.mockReset() })

describe('the guide on the desk', () => {
  it('stands a note on its anchor, as wide as the anchor, worded for a pointer', async () => {
    await render(<Learn onEnd={() => {}} />)
    await settle()
    expect(stopOf()).toBe('learn.plate')
    const note = $('.guide-callout--live')
    const plate = box($('[data-guide="learn.plate"]'))
    expect(Math.abs(mid(box(note)) - mid(plate))).toBeLessThan(1.5)
    expect(Math.round(box(note).width)).toBe(Math.round(Math.max(plate.width, 360)))
    expect([en.guideLearnPlateDesk, fr.guideLearnPlateDesk]).toContain(note.querySelector('.guide-callout__text').textContent)
    expect($('[data-action="guide-next"]').getAttribute('aria-keyshortcuts')).toBe('Enter ArrowRight')
    expect($('[data-action="guide-next"] .desk-kbd')).not.toBeNull()
    expect($('[data-action="guide-skip"] .desk-kbd')).not.toBeNull()
  })

  it('goes on with → anywhere and Enter on the note, and the page hears neither', async () => {
    const onEnd = vi.fn()
    await render(<Learn onEnd={onEnd} />)
    await settle()
    window.addEventListener('keydown', listen)
    expect(document.activeElement).toBe($('.guide-callout--live'))
    await userEvent.keyboard('{ArrowRight}')
    await settle()
    expect(stopOf()).toBe('learn.stops')
    await userEvent.keyboard('{Enter}')
    await settle()
    expect(onEnd).toHaveBeenCalledWith(false, 2)
    expect(heard).not.toHaveBeenCalled()
  })

  it('leaves a focused Skip its own Enter', async () => {
    const onEnd = vi.fn()
    await render(<Learn onEnd={onEnd} />)
    await settle()
    $('[data-action="guide-skip"]').focus()
    await userEvent.keyboard('{Enter}')
    await settle()
    expect(onEnd).toHaveBeenCalledWith(true, 2)
  })

  it('walks Today down the rail first, then the gate and the strip', async () => {
    await render(
      <LangProvider>
        <div className="phone phone--desk">
          <div className="phone__content">
            {['hud.level', 'hud.status', 'hud.pass', 'today.strip', 'today.gate', 'tabbar'].map(a => (
              <div key={a} data-guide={a} style={{ height: 40 }}>{a}</div>
            ))}
          </div>
        </div>
        <Guide gate="today" onEnd={() => {}} />
      </LangProvider>
    )
    await settle()
    const walked = []
    for (let i = 0; i < 6; i++) {
      walked.push(stopOf())
      await userEvent.keyboard('{ArrowRight}')
      await settle(120)
    }
    expect(walked).toEqual(['tabbar', 'hud.level', 'hud.status', 'hud.pass', 'today.gate', 'today.strip'])
  })
})
