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

// ── plan 123 — the kept dialogs, drawn for a desk ──
// A confirm opens on its way out, so an Enter held or pressed twice does
// not act; the actions share a row; a dialog with no way out in its body
// draws a ✕; the pass's rail doors stand beside the rail's foot; the
// CSV import wears the dialog's width and material.
const box = el => el.getBoundingClientRect()
const token = n => parseFloat(getComputedStyle(document.documentElement).getPropertyValue(n))

function Confirm({ onClose = () => {}, labels = ['Delete', 'Cancel'], ...rest }) {
  return (
    <LangProvider>
      <Sheet open onClose={onClose} jp="Voyage" cap="Delete deck" {...rest}>
        <span className="sheet__q">Delete this deck?</span>
        <button type="button" className="btn-primary btn-primary--danger">{labels[0]}</button>
        {labels.slice(1, -1).map(l => <button key={l} type="button" className="btn-secondary">{l}</button>)}
        <button type="button" className="btn-secondary">{labels.at(-1)}</button>
      </Sheet>
    </LangProvider>
  )
}

describe('the kept dialogs on the desk (plan 123)', () => {
  it('opens a confirm on its way out, not on the act', async () => {
    await render(<Confirm initialFocus=".btn-secondary" />)
    await settle()
    expect(document.activeElement.textContent).toBe('Cancel')
  })

  it('sets its actions on one row, in the order they are written', async () => {
    await render(<Confirm />)
    await settle()
    const [act, out] = [...document.querySelectorAll('.sheet button')].map(box)
    expect(Math.round(act.top)).toBe(Math.round(out.top))
    expect(act.right).toBeLessThan(out.left)
    const q = box(document.querySelector('.sheet__q'))
    expect(q.bottom).toBeLessThanOrEqual(act.top)
  })

  it('fits three actions to a row in French without a clipped label', async () => {
    await render(<Confirm labels={['Rendre quand même', 'Revoir les blancs', 'Continuer']} />)
    await settle()
    const buttons = [...document.querySelectorAll('.sheet button')]
    expect(new Set(buttons.map(b => Math.round(box(b).top))).size).toBe(1)
    for (const b of buttons) expect(b.scrollWidth).toBeLessThanOrEqual(b.clientWidth)
  })

  it('draws a ✕ where the body holds no way out, last in the tab order', async () => {
    const onClose = vi.fn()
    await render(
      <LangProvider>
        <Sheet open onClose={onClose} jp="駅" cap="Choose a deck" dismiss>
          <button type="button" className="probe-row">Voyage</button>
        </Sheet>
      </LangProvider>
    )
    await settle()
    const x = document.querySelector('.desk-sheet__close')
    expect(x).not.toBeNull()
    expect(document.activeElement.className).toBe('probe-row')
    const buttons = [...document.querySelectorAll('.sheet button')]
    expect(buttons.at(-1)).toBe(x)
    expect(box(x).right).toBeGreaterThan(box(document.querySelector('.sheet__cap')).right)
    x.click()
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('draws no ✕ on a dialog that ends on its own way out', async () => {
    await render(<Confirm />)
    await settle()
    expect(document.querySelector('.desk-sheet__close')).toBeNull()
  })

  it('stands the pass\'s rail doors beside the rail\'s foot, at a column\'s width', async () => {
    document.documentElement.dataset.chrome = 'shell'
    try {
      await render(
        <LangProvider>
          <Sheet open onClose={() => {}} sumi className="status-sheet" label="Status"><p>the pass's back</p></Sheet>
        </LangProvider>
      )
      await settle()
      const sheet = box(document.querySelector('.sheet'))
      expect(Math.round(sheet.left)).toBe(token('--desk-rail-w') + token('--sp-3'))
      expect(Math.round(sheet.width)).toBe(token('--desk-side-w'))
      expect(Math.round(window.innerHeight - sheet.bottom)).toBe(token('--sp-5'))
    } finally {
      delete document.documentElement.dataset.chrome
    }
  })

  it('gives the CSV import the dialog\'s width and material', async () => {
    await render(<div className="import-overlay"><div className="import-modal">csv</div></div>)
    await settle(60)
    const modal = document.querySelector('.import-modal')
    expect(Math.round(box(modal).width)).toBeLessThanOrEqual(token('--card-w'))
    expect(parseFloat(getComputedStyle(modal).borderTopLeftRadius)).toBe(token('--r-panel'))
    const probe = document.createElement('span')
    probe.style.color = 'var(--surface)'
    document.body.appendChild(probe)
    expect(getComputedStyle(modal).backgroundColor).toBe(getComputedStyle(probe).color)
    probe.remove()
  })
})
