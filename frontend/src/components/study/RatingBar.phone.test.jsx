import { describe, it, expect, vi, afterEach } from 'vitest'
import { render } from 'vitest-browser-react'
import '@fontsource/space-grotesk/latin-700.css'
import { LangProvider } from '../../LangContext'
import RatingBar from './RatingBar'
import '../../index.css'

// ── 券売機 — the rating bar's keys on a phone (plan 202) ──────────────
// The owner's pick G of the canvas "Tsuji — the rating bar, new
// directions": every verdict a key of the one make, raised on a foot and
// a gap apart, a miss dark with its lamp in its ink, a pass moulded in
// its own. The gaps are width the words had when the misses were one
// instrument, so the French words -- the app's longest, Difficile and
// Trou noir -- are measured whole at a phone's widths, in the real face.

vi.mock('../../lib/audio', async importOriginal => ({
  ...(await importOriginal()),
  playCorrect: () => {},
  playWrong: () => {},
}))
globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })

const settle = (ms = 60) => new Promise(r => setTimeout(r, ms))

async function dock(width, scale) {
  document.documentElement.dataset.chrome = 'stage'
  const screen = await render(
    <LangProvider>
      <div style={{ width }}>
        <div className="screen">
          <main className="container stage">
            <div className="prompt-card"><div className="prompt-card__body">音楽</div></div>
            <RatingBar active scale={scale} onRate={() => {}} />
          </main>
        </div>
      </div>
    </LangProvider>
  )
  await document.fonts.load('700 13px "Space Grotesk"', 'DifficileTrou noir')
  await document.fonts.ready
  await settle()
  return screen.container
}

afterEach(() => { delete document.documentElement.dataset.chrome })

// Each shadow's blur: the foot and the top's light are edges, never a glow.
const blurs = shadow => [...shadow.matchAll(/(-?[\d.]+)px (-?[\d.]+)px (-?[\d.]+)px/g)].map(m => m[3])

const clipped = root => [...root.querySelectorAll('.rating-bar__btn-label')]
  .filter(l => l.scrollWidth > l.clientWidth)
  .map(l => l.textContent)

describe('the rating bar\'s keys on a phone', () => {
  it('holds every word whole at 390, 360 and 320 on the four, and at 360 and 320 on the six', async () => {
    for (const width of ['390px', '360px', '320px']) {
      const c = await dock(width, 'simple')
      expect([...c.querySelectorAll('.rating-bar__btn-label')].map(l => l.textContent))
        .toEqual(['Raté', 'Presque', 'Difficile', 'Correct'])
      expect(clipped(c), width).toEqual([])
      document.body.innerHTML = ''
    }
    for (const width of ['360px', '320px']) {
      const six = await dock(width, 'full')
      expect(clipped(six), width).toEqual([])
      document.body.innerHTML = ''
    }
  })

  it('draws every verdict as a key of one make: a gap apart, a foot under each, 64px with it', async () => {
    const c = await dock('390px', 'simple')
    const keys = [...c.querySelectorAll('.rating-bar__btn')]
    const [miss, , , pass] = keys
    expect(getComputedStyle(c.querySelector('.rating-bar__misses')).columnGap).toBe('8px')
    expect(getComputedStyle(c.querySelector('.rating-bar__misses')).outlineStyle).toBe('none')
    for (const k of keys) {
      const s = getComputedStyle(k)
      expect(s.borderTopLeftRadius).toBe('8px')
      // The foot: no blur, 3px down, the key's own material a shade under.
      expect(s.boxShadow).toMatch(/0px 3px 0px 0px/)
      expect(Math.round(k.getBoundingClientRect().height)).toBe(61)
    }
    expect(Math.round(c.querySelector('.rating-bar__buttons').getBoundingClientRect().height)).toBe(64)
    // A miss: its own sumi, the panel ink on it, a lamp in its ink.
    expect(getComputedStyle(miss).backgroundImage).toContain('linear-gradient')
    expect(getComputedStyle(miss).color).toBe('rgb(243, 236, 223)')
    const lamp = getComputedStyle(miss.querySelector('.rating-bar__btn-lamp'))
    expect(lamp.width).toBe('8px')
    expect(lamp.height).toBe('8px')
    expect(lamp.borderRadius).toBe('999px')
    // The pass: moulded in its ink (新橋), the sumi type, no glow, half again as wide.
    expect(getComputedStyle(pass).backgroundImage).toContain('rgb(89, 185, 198)')
    expect(getComputedStyle(pass).color).toBe('rgb(28, 24, 17)')
    expect(blurs(getComputedStyle(pass).boxShadow)).toEqual(['0', '0'])
    expect(pass.getBoundingClientRect().width).toBeGreaterThan(miss.getBoundingClientRect().width * 1.3)
  })

  it('sends a pressed key down its foot', async () => {
    const c = await dock('390px', 'simple')
    const pass = c.querySelector('.rating-bar__btn--q4')
    pass.click()
    await settle(150)
    expect(pass.classList.contains('rating-bar__btn--pressed')).toBe(true)
    expect(getComputedStyle(pass).transform).toBe('matrix(1, 0, 0, 1, 0, 3)')
    expect(getComputedStyle(pass).boxShadow).toMatch(/0px 0px 0px 0px/)
  })
})
