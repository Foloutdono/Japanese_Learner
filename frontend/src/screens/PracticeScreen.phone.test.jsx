import { describe, it, expect, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { LangProvider } from '../LangContext'
import '../index.css'

// ── 実践 — the gate's platforms, at 390px ────────────────────
// Since plan 225 the phone's gate is the owner's painting of a
// platform, made live (components/practice/gate): a car at the
// platform, and on its side two roll signs -- the train's grade and
// where it goes -- where the plates' chips and heads were. The lit
// destination opens its station, as a plate's head did; the gold
// button boards the train to the run at the sign's grade, as a chip
// did. The desk's painted platform (plan 244) is
// PracticeScreen.desktop.test.jsx.

vi.mock('../lib/api', () => ({
  apiFetch: vi.fn(async () => ({ ok: true, status: 200, json: async () => ({}) })),
  apiJson: vi.fn(async () => ({})),
  apiJsonWithTimeout: vi.fn(async () => ({})),
  apiUpload: vi.fn(),
  ApiError: class extends Error {},
}))
vi.mock('../lib/audio', async o => ({
  ...(await o()), playUi: vi.fn(), playAnnouncement: vi.fn(), playClick: vi.fn(),
  playBoardFlap: vi.fn(), playGateChime: vi.fn(), playDoorChime: vi.fn(), playDoorSlide: vi.fn(),
  playPantograph: vi.fn(), playSpark: vi.fn(),
}))
vi.mock('../stores/profileSummary', async (o) => ({ ...(await o()), useProfileSummary: () => ({ jlptLevel: 'N4' }) }))
// The station's own departure is the cutscene's (stores/departure); here
// it only has to be asked for.
const beginDeparture = vi.hoisted(() => vi.fn())
vi.mock('../stores/departure', async o => ({ ...(await o()), beginDeparture }))
// The train's acts take seconds; most cases board under reduced motion,
// where the gold button opens the run at once.
const motion = vi.hoisted(() => ({ reduced: true }))
vi.mock('../components/dayclear/useReducedMotion', () => ({
  REDUCED_QUERY: '(prefers-reduced-motion: reduce)',
  useReducedMotion: () => motion.reduced,
}))

const { default: PracticeScreen } = await import('./PracticeScreen')
const { getSections } = await import('../config/tabs')
const { practiceHow } = (await import('../locales/fr/index.js')).default

const SECTIONS = getSections('practice', {})
const settle = (ms = 300) => new Promise(r => setTimeout(r, ms))

const here = { path: null }
function Probe() {
  const loc = useLocation()
  here.path = loc.pathname + loc.search
  return null
}

async function gate() {
  const screen = await render(
    <LangProvider>
      <MemoryRouter initialEntries={['/practice']}>
        <div className="phone">
          <div className="phone__content"><PracticeScreen /></div>
        </div>
        <Probe />
      </MemoryRouter>
    </LangProvider>
  )
  await settle()
  return screen
}

const main = root => root.querySelector('.pgate-sign--main')
const lit = (root, sign) => main(root).querySelector(`.pgate-roll--${sign} [aria-current="true"]`)
const rows = (root, sign) => [...main(root).querySelectorAll(`.pgate-roll--${sign} .pgate-roll__row`)]
// The row a step `k` from the lit one (-1 above, 1 below).
const at = (root, sign, k) => rows(root, sign).find(r => r.style.getPropertyValue('--k') === String(k))
const titles = SECTIONS.map(s => s.path)
const litPath = root => SECTIONS[rows(root, 'dest').indexOf(lit(root, 'dest'))].path

/** Roll the destination sign, a row at a time, until `path` is lit. */
async function rollTo(root, path) {
  for (let i = 0; i < SECTIONS.length && litPath(root) !== path; i++) {
    at(root, 'dest', 1).click()
    await settle(60)
  }
  expect(litPath(root)).toBe(path)
}

describe('the painted platform at phone width (plan 225)', () => {
  it('stands where the plates stood, the painting filling the screen', async () => {
    const screen = await gate()
    const root = screen.container
    expect(root.querySelector('.plates')).toBeNull()
    const frame = root.querySelector('.pgate__frame').getBoundingClientRect()
    const stage = root.querySelector('.pgate__stage').getBoundingClientRect()
    const phone = root.querySelector('.phone').getBoundingClientRect()
    // The whole width, edge to edge: the frame bleeds over the page's
    // gutters, and from under the HUD down to the tab bar.
    expect(frame.left).toBeCloseTo(phone.left, 0)
    expect(frame.width).toBeCloseTo(phone.width, 0)
    expect(frame.top).toBeCloseTo(phone.top, 0)
    expect(frame.bottom).toBeCloseTo(phone.bottom, 0)
    expect(stage.left).toBeLessThanOrEqual(frame.left + 0.5)
    expect(stage.right).toBeGreaterThanOrEqual(frame.right - 0.5)
    // The painting of the hour, its car and its pillars.
    const hour = [...root.querySelector('.pgate').classList].find(c => c.startsWith('pgate--')).slice(7)
    const lit = [...root.querySelectorAll('.pgate__layer.is-on')].map(img => img.getAttribute('src'))
    for (const layer of ['bg', 'car', 'near']) expect(lit.some(src => src.endsWith(`/${layer}-${hour}.webp`)), layer).toBe(true)
    // Nothing reaches past the screen's edge.
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(document.documentElement.clientWidth)
  })

  it('lights the learner\'s grade, with its dot, and says what the lit run asks', async () => {
    const screen = await gate()
    const root = screen.container
    expect(lit(root, 'grade').textContent).toBe('N4')
    expect(lit(root, 'grade').querySelector('.pgate-roll__here')).not.toBeNull()
    // Three rows show on each sign; the rest are off the drum.
    for (const sign of ['grade', 'dest']) {
      const shown = rows(root, sign).filter(r => !r.hasAttribute('aria-hidden'))
      expect(shown, sign).toHaveLength(3)
      for (const row of shown) {
        const box = row.getBoundingClientRect()
        const drum = row.closest('.pgate-roll').getBoundingClientRect()
        expect(box.top, sign).toBeGreaterThanOrEqual(drum.top - 0.5)
        expect(box.bottom, sign).toBeLessThanOrEqual(drum.bottom + 0.5)
      }
    }
    const key = { '/practice/reading': 'reading', '/practice/comprehension': 'comprehension', '/practice/translation': 'translation', '/practice/dictation': 'dictation', '/practice/composition': 'composition', '/practice/exam': 'exam', '/practice/conversation': 'conversation' }
    expect(root.querySelector('.pgate-led__page--how').textContent).toBe(practiceHow[key[litPath(root)]])
  })

  it('holds what every run asks in the LED, on its sign\'s width', async () => {
    const screen = await gate()
    const root = screen.container
    for (let i = 0; i < SECTIONS.length; i++) {
      const how = root.querySelector('.pgate-led__page--how')
      const led = root.querySelector('.pgate-sign--main .pgate-led').getBoundingClientRect()
      const range = document.createRange()
      range.selectNodeContents(how)
      const text = range.getBoundingClientRect()
      expect(text.top, litPath(root)).toBeGreaterThanOrEqual(led.top)
      expect(text.bottom, litPath(root)).toBeLessThanOrEqual(led.bottom)
      at(root, 'dest', 1).click()
      await settle(60)
    }
  })

  it('turns a sign a row at a tap, or an arrow, the stripe taking the line', async () => {
    const screen = await gate()
    const root = screen.container
    const before = litPath(root)
    const next = titles[(titles.indexOf(before) + 1) % titles.length]
    at(root, 'dest', 1).click()
    await settle(60)
    expect(litPath(root)).toBe(next)
    // The car's stripe and the leaves' take the lit line's pigment.
    const key = next.split('/').pop()
    expect(root.querySelector('.pgate').style.getPropertyValue('--pg-line')).toBe(`var(--pg-ink-${key})`)
    // The arrows turn it back, and the focus rides the lit row.
    lit(root, 'dest').focus()
    lit(root, 'dest').dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }))
    await settle(60)
    expect(litPath(root)).toBe(before)
    expect(document.activeElement).toBe(lit(root, 'dest'))
    // The grade turns the same way, and stops at its ends.
    at(root, 'grade', 1).click()
    await settle(60)
    expect(lit(root, 'grade').textContent).toBe('N3')
    at(root, 'grade', -1).click()
    await settle(60)
    expect(lit(root, 'grade').textContent).toBe('N4')
  })

  it('boards each platform\'s train at the grade on its sign', async () => {
    const screen = await gate()
    const root = screen.container
    const go = () => root.querySelector('.pgate__go')
    const board = async (path, steps, want) => {
      await rollTo(root, path)
      for (let i = 0; i < Math.abs(steps); i++) {
        at(root, 'grade', Math.sign(steps)).click()
        await settle(60)
      }
      go().click()
      await vi.waitFor(() => expect(here.path).toBe(want))
    }
    // From N4, the grade staying where the last train left it: the grade
    // is the run for those that run on one axis, the station's papers or
    // scenes for the two that are not a run.
    await board('/practice/reading', 1, '/practice/reading/level/N3')
    await board('/practice/comprehension', -2, '/practice/comprehension/N5')
    await board('/practice/translation', 0, '/practice/translation/level/N5')
    await board('/practice/dictation', 1, '/practice/dictation/N4')
    await board('/practice/composition', 1, '/practice/composition/N3')
    await board('/practice/exam', 1, '/practice/exam?level=N2')
    await board('/practice/conversation', 1, '/practice/conversation?level=N1')
  })

  it('opens the lit destination\'s station, as a plate\'s head did', async () => {
    const screen = await gate()
    const root = screen.container
    await rollTo(root, '/practice/translation')
    beginDeparture.mockClear()
    lit(root, 'dest').click()
    expect(beginDeparture).toHaveBeenCalledTimes(1)
    expect(beginDeparture.mock.calls[0][0].path).toBe('/practice/translation')
    expect(lit(root, 'dest').getAttribute('aria-label')).toMatch(/station/)
  })

  // Last: a departure leaves the next visit an arrival.
  it('closes its doors and pulls out before the run, and a tap goes straight there', async () => {
    motion.reduced = false
    try {
      const screen = await gate()
      const root = screen.container
      const pgate = root.querySelector('.pgate')
      // Woken, it raises its pantograph to the wire and opens its doors.
      await vi.waitFor(() => expect(root.querySelector('.pgate-door--open')).not.toBeNull(), { timeout: 4000 })
      await rollTo(root, '/practice/dictation')
      const level = lit(root, 'grade').textContent
      here.path = null
      root.querySelector('.pgate__go').click()
      await vi.waitFor(() => expect(pgate.dataset.phase).toBe('closing'))
      expect(here.path).toBeNull()
      window.dispatchEvent(new PointerEvent('pointerdown'))
      await vi.waitFor(() => expect(here.path).toBe(`/practice/dictation/${level}`))
    } finally {
      motion.reduced = true
    }
  })
})

// ── 案内 — the anchors the guide points at (plan 100) ────────────
describe('the practice gate\'s guide anchors', () => {
  it('marks the two signs and the gate, once each', async () => {
    const screen = await gate()
    const root = screen.container
    for (const anchor of ['practice.sign', 'practice.grade', 'practice.board']) {
      expect(root.querySelectorAll(`[data-guide="${anchor}"]`), anchor).toHaveLength(1)
    }
    // No pass tag is drawn while nothing is for sale: the guide skips
    // that stop rather than pointing at nothing.
    expect(root.querySelector('[data-guide="practice.pass"]')).toBeNull()
  })
})
