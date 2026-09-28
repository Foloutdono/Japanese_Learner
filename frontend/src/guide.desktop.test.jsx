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

  it('walks Today down the rail first, then the gate', async () => {
    await render(
      <LangProvider>
        <div className="phone phone--desk">
          <div className="phone__content">
            {['tabbar', 'hud.level', 'hud.status', 'hud.pass', 'today.gate', 'today.take', 'today.fare', 'today.strip', 'today.journey', 'today.week'].map(a => (
              <div key={a} data-guide={a} style={{ height: 40 }}>{a}</div>
            ))}
          </div>
        </div>
        <Guide gate="today" onEnd={() => {}} />
      </LangProvider>
    )
    await settle()
    const walked = []
    for (let i = 0; i < 2; i++) {
      walked.push(stopOf())
      await userEvent.keyboard('{ArrowRight}')
      await settle(120)
    }
    expect(walked).toEqual(['tabbar', 'today.gate'])
    // Every other part of Today is on the page, and walked no more
    // (2026-09-28): the first gate after the first ride says how to
    // start and where the rest is.
    expect(stopOf()).toBeNull()
  })

  // The owner's report: the fare gate takes the window's height on the
  // desk (plan 135), so neither over it nor under it has room, and the
  // note was drawn under the window's floor with only its top showing.
  it('stands the note inside a spot as tall as the window', async () => {
    await render(
      <LangProvider>
        <div className="phone phone--desk">
          <div className="phone__content">
            <div data-guide="today.gate" style={{ position: 'fixed', top: 24, left: 200, width: 640, height: window.innerHeight - 48 }}>gate</div>
          </div>
        </div>
        <Guide gate="today" onEnd={() => {}} />
      </LangProvider>
    )
    await settle()
    expect(stopOf()).toBe('today.gate')
    const note = box($('.guide-callout--live'))
    expect(note.top).toBeGreaterThanOrEqual(0)
    expect(note.bottom).toBeLessThanOrEqual(window.innerHeight)
    const gate = box($('[data-guide="today.gate"]'))
    expect(note.top).toBeGreaterThan(gate.top)
    expect(note.bottom).toBeLessThan(gate.bottom)
    expect($('.guide-callout--live').dataset.place).toBe('over')
  })

  it('keeps a note beside a low side-column anchor inside the window', async () => {
    await render(
      <LangProvider>
        <div className="phone phone--desk">
          <div className="phone__content">
            <div className="desk-side" style={{ position: 'fixed', right: 0, top: 0, width: 360, height: '100%' }}>
              <div data-guide="run.side" style={{ position: 'absolute', bottom: 8, left: 0, right: 0, height: 60 }}>side</div>
            </div>
          </div>
        </div>
        <Guide gate="ride" stops={[{ anchor: 'run.side', key: 'LearnShelf', radius: 'card' }]} onEnd={() => {}} />
      </LangProvider>
    )
    await settle()
    expect(stopOf()).toBe('run.side')
    const note = box($('.guide-callout--live'))
    expect(note.top).toBeGreaterThanOrEqual(0)
    expect(note.bottom).toBeLessThanOrEqual(window.innerHeight)
    expect(note.right).toBeLessThanOrEqual(box($('[data-guide="run.side"]')).left)
  })

  it('sets each key cap apart from its word', async () => {
    await render(<Learn onEnd={() => {}} />)
    await settle()
    for (const action of ['guide-skip', 'guide-next']) {
      const button = $(`[data-action="${action}"]`)
      const cap = box(button.querySelector('.desk-kbd'))
      const range = document.createRange()
      range.selectNodeContents(button.firstChild)
      expect(cap.left - range.getBoundingClientRect().right, action).toBeGreaterThanOrEqual(8)
      expect(cap.right).toBeLessThanOrEqual(box(button).right)
    }
  })
})
