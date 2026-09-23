import { describe, it, expect, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { LangProvider } from './LangContext'
import { Sheet } from './components/chrome/Sheet'
import './index.css'

// ── 札 — a sheet is a centred dialog on the desk (plan 113) ─────
// On a phone the sheet rises from the bottom edge
// (chrome.phone.test.jsx pins that, and it does not move). On the desk
// the same component is set in the middle of the screen: every corner
// rounded, no handle, the card column's width — and still a modal that
// holds focus and closes on Escape.

const settle = (ms = 260) => new Promise(r => setTimeout(r, ms))

function mount({ sumi = false, onClose = vi.fn() } = {}) {
  return render(
    <LangProvider>
      <button type="button" id="opener">open</button>
      <Sheet open onClose={onClose} jp="残高" cap="Balance" sumi={sumi}>
        <button type="button" id="first">one</button>
        <button type="button" id="last">two</button>
      </Sheet>
    </LangProvider>
  )
}

describe('the sheet on the desk', () => {
  it('sits in the middle of the screen, at the card column\'s width', async () => {
    await mount()
    await settle()
    const sheet = document.querySelector('.sheet')
    const box = sheet.getBoundingClientRect()
    // The scrim is `inset: 0` in the same containing block — the
    // viewport less the page's stable scrollbar gutter — so it is the
    // frame the sheet centres in.
    const frame = document.querySelector('.scrim').getBoundingClientRect()
    expect(getComputedStyle(sheet).position).toBe('fixed')
    expect(box.width).toBe(640)
    expect(Math.abs((box.left - frame.left) - (frame.right - box.right))).toBeLessThanOrEqual(1)
    expect(Math.abs((box.top - frame.top) - (frame.bottom - box.bottom))).toBeLessThanOrEqual(1)
    // Not on the bottom edge, as the phone's is.
    expect(Math.round(box.bottom)).toBeLessThan(frame.bottom)
  })

  it('is a panel with four corners and no handle', async () => {
    await mount()
    await settle()
    const sheet = document.querySelector('.sheet')
    const cs = getComputedStyle(sheet)
    for (const corner of ['borderTopLeftRadius', 'borderTopRightRadius', 'borderBottomLeftRadius', 'borderBottomRightRadius']) {
      expect(cs[corner]).toBe('8px')
    }
    expect(cs.borderBottomWidth).toBe('1px')
    expect(cs.borderBottomColor).toBe(cs.borderTopColor)
    expect(getComputedStyle(document.querySelector('.sheet__handle')).display).toBe('none')
  })

  it('keeps the pass\'s edge on all four sides when it is sumi', async () => {
    await mount({ sumi: true })
    await settle()
    const cs = getComputedStyle(document.querySelector('.sheet'))
    expect(cs.borderBottomColor).toBe(cs.borderTopColor)
    expect(cs.borderLeftColor).toBe(cs.borderTopColor)
  })

  it('holds focus and closes on Escape', async () => {
    const onClose = vi.fn()
    await mount({ onClose })
    await settle()
    const sheet = document.querySelector('.sheet')
    expect(sheet.getAttribute('role')).toBe('dialog')
    expect(document.querySelector('.scrim')).toBeTruthy()
    expect(sheet.contains(document.activeElement)).toBe(true)
    document.activeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
