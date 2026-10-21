import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { LangProvider } from '../../LangContext'
import { sampleStroke } from '../../domain/strokePath'
import { strokesOf } from '../../domain/kanjivg'
import '../../index.css'

// ── 辻 — the stroke order, big, and the calque (plan 267) ──
// A tap on the animation opens it at the width of the screen, and the
// trace board beside it: the glyph's strokes, in the file's order, each
// traced from its dot to its ring.
vi.mock('../../lib/audio', async o => ({ ...(await o()), playClick: vi.fn() }))

const { StrokeZoom } = await import('./StrokeStudy')

const KVG = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.0//EN" "http://www.w3.org/TR/2001/REC-SVG-20010904/DTD/svg10.dtd" [
<!ATTLIST path xmlns:kvg CDATA #FIXED "http://kanjivg.tagaini.net" >
]>
<svg xmlns="http://www.w3.org/2000/svg" width="109" height="109" viewBox="0 0 109 109">
<g id="kvg:StrokePaths_04e00" style="fill:none;stroke:#000000;stroke-width:3;">
<path id="kvg:04e00-s1" d="M20,30c20,0 40,0 60,0"/>
<path id="kvg:04e00-s2" d="M20,70c20,0 40,0 60,0"/>
</g>
<g id="kvg:StrokeNumbers_04e00" style="font-size:8;fill:#808080">
<text transform="matrix(1 0 0 1 12 29)">1</text>
</g>
</svg>`

const settle = (ms = 80) => new Promise(r => setTimeout(r, ms))
const dialog = () => document.querySelector('[role="dialog"]')

async function mount() {
  globalThis.fetch = vi.fn(async () => ({ ok: true, status: 200, text: async () => KVG }))
  const screen = await render(
    <LangProvider>
      <StrokeZoom src="/kanjivg/04e00.svg" className="dict-form__sheet">
        <div className="probe">drawing</div>
      </StrokeZoom>
    </LangProvider>,
  )
  await settle()
  return screen
}

async function open(screen) {
  screen.container.querySelector('.stroke-zoom__open').click()
  await settle()
}

const option = name => [...dialog().querySelectorAll('[role="radio"]')].find(b => b.textContent === name)

function draw(board, points) {
  const pen = board.querySelector('.gt-pen')
  const box = pen.getBoundingClientRect()
  const at = ([x, y]) => ({
    clientX: box.left + (x / 109) * box.width,
    clientY: box.top + (y / 109) * box.height,
    bubbles: true, pointerId: 7, button: 0,
  })
  pen.dispatchEvent(new PointerEvent('pointerdown', at(points[0])))
  for (const p of points.slice(1)) pen.dispatchEvent(new PointerEvent('pointermove', at(p)))
  pen.dispatchEvent(new PointerEvent('pointerup', at(points[points.length - 1])))
}

describe('the stroke order, enlarged', () => {
  beforeEach(() => { document.body.innerHTML = ''; localStorage.setItem('lang', 'en') })
  afterEach(() => { localStorage.removeItem('lang') })

  it('leaves what it wraps where it is, and opens nothing until it is tapped', async () => {
    const screen = await mount()
    expect(screen.container.querySelector('.probe')).not.toBe(null)
    expect(screen.container.querySelector('.stroke-zoom__open').getAttribute('aria-label')).toBe('Enlarge the stroke order')
    expect(dialog()).toBe(null)
    // (the language provider's own fetches aside) the file is not fetched until wanted
    expect(globalThis.fetch.mock.calls.some(([u]) => String(u).includes('kanjivg'))).toBe(false)
  })

  it('opens the animation big on a tap, headed by the character', async () => {
    const screen = await mount()
    await open(screen)
    expect(dialog().querySelector('.sheet__jp').textContent).toBe('一')
    const glyph = dialog().querySelector('.ss-paper__glyph svg')
    expect(glyph).not.toBe(null)
    expect(glyph.getBoundingClientRect().width).toBeGreaterThan(200)
    expect([...dialog().querySelectorAll('[role="radio"]')].map(b => b.textContent)).toEqual(['Watch', 'Trace'])
  })

  it('closes on Escape', async () => {
    const screen = await mount()
    await open(screen)
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await settle()
    expect(dialog()).toBe(null)
  })

  it('traces the strokes in the file\'s order, then offers to trace again', async () => {
    const screen = await mount()
    await open(screen)
    option('Trace').click()
    await settle()
    const board = dialog().querySelector('.gt-board')
    expect(board.getAttribute('aria-label')).toBe('Trace 一, stroke 1 of 2')
    const [first, second] = strokesOf(KVG)

    draw(board, sampleStroke(first, 24))
    await settle()
    expect(board.getAttribute('aria-label')).toBe('Trace 一, stroke 2 of 2')

    draw(board, sampleStroke(second, 24))
    await settle()
    expect(dialog().querySelector('.ss-said').textContent).toBe('Traced first time.')
    const again = dialog().querySelector('.ss-act')
    expect(again.textContent).toBe('Trace again')

    again.click()
    await settle()
    expect(dialog().querySelector('.gt-board').getAttribute('aria-label')).toBe('Trace 一, stroke 1 of 2')
  })

  it('draws the rest on « Show me »', async () => {
    const screen = await mount()
    await open(screen)
    option('Trace').click()
    await settle()
    dialog().querySelector('.ss-act').click()
    await settle()
    expect(dialog().querySelector('.ss-said').textContent).toBe('That is how it is written.')
    expect(dialog().querySelector('.ss-act').textContent).toBe('Trace again')
  })

  it('says it is not available when the file will not load', async () => {
    globalThis.fetch = vi.fn(async () => ({ ok: false, status: 404, text: async () => '' }))
    const screen = await render(
      <LangProvider><StrokeZoom src="/kanjivg/04e00.svg"><span /></StrokeZoom></LangProvider>,
    )
    await open(screen)
    expect(dialog().querySelector('.ss-fallback').textContent).toBe('Not available')
  })
})
