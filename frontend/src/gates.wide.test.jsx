import { describe, it, expect, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { MemoryRouter } from 'react-router-dom'
import { LangProvider } from './LangContext'
// The shipped face (main.jsx), so a platform's name is measured in the
// font it is drawn in: since plan 174 the names are the display face,
// and the runner's fallback for it (DejaVu Sans) sets « Entraînement à
// la lecture » 45px wider than Space Grotesk does.
import '@fontsource/space-grotesk/latin-700.css'
import './index.css'

// ── 机 — the Practice gate three across (plan 130) ───────────────
// The `wide` lane: a laptop's 1440×900. Once three plates hold a French
// platform name whole, Practice's six stand three across in two rows,
// and the two rows still take the window: each plate's body shares its
// height -- since plan 165 the platform's specimen -- and the page does
// not scroll. At the desk's tightest (gates.desktop.test) they stay two
// across in three rows.

const { default: CARDS } = await import('./testing/practiceCards.json')
vi.mock('./lib/api', () => ({
  api: p => p,
  apiFetch: vi.fn(async path => {
    const line = path.match(/^\/api\/station\/(\w+)\/samples/)?.[1]
    return { ok: true, status: 200, json: async () => (line ? { stops: CARDS[line] } : {}) }
  }),
  apiJson: vi.fn(async () => ({})),
  apiJsonWithTimeout: vi.fn(async () => ({})),
  apiUpload: vi.fn(),
  ApiError: class extends Error {},
}))
vi.mock('./lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: async () => ({ data: { session: { access_token: 'tok' } } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    },
  },
}))
vi.mock('./lib/audio', async o => ({
  ...(await o()), playUi: vi.fn(), playAnnouncement: vi.fn(), playClick: vi.fn(),
}))
const learner = vi.hoisted(() => ({ grade: 'N5' }))
vi.mock('./stores/profileSummary', async (o) => ({
  ...(await o()),
  useProfileSummary: () => ({ jlptLevel: 'N5' }),
  useProfileSummaryState: () => ({ summary: { jlptLevel: learner.grade }, failed: false }),
}))
globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })

const { default: PracticeScreen } = await import('./screens/PracticeScreen')

// Past the timer, the plates' staggered arrivals themselves: a plate a
// fraction of a pixel short of its place is a row out of line.
const settle = async (ms = 620) => {
  await new Promise(r => setTimeout(r, ms))
  await document.fonts.ready
  await Promise.all(document.getAnimations()
    .filter(a => a.effect?.getComputedTiming().iterations !== Infinity)
    .map(a => a.finished.catch(() => {})))
}
const box = el => el.getBoundingClientRect()
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)]
const gate = () => render(
  <LangProvider>
    <MemoryRouter initialEntries={['/practice']}>
      <div className="phone phone--desk">
        <div className="phone__content"><PracticeScreen /></div>
      </div>
    </MemoryRouter>
  </LangProvider>
)

describe('the Practice gate on a laptop (plan 130)', () => {
  it('stands its six plates three across in two rows, filling the window', async () => {
    await gate()
    await settle()
    const plates = [...document.querySelectorAll('.practice > .plates > .plate')].map(box)
    expect(plates).toHaveLength(6)
    // Two rows of three, a row's tops within a pixel of each other (the
    // rows share the window, so a row can start on a half pixel).
    const first = plates.filter(p => Math.abs(p.top - plates[0].top) <= 1)
    const second = plates.filter(p => Math.abs(p.top - plates[0].top) > 1)
    expect(first).toHaveLength(3)
    expect(second).toHaveLength(3)
    expect(Math.max(...second.map(p => p.top)) - Math.min(...second.map(p => p.top))).toBeLessThanOrEqual(1)
    expect(Math.min(...second.map(p => p.top))).toBeGreaterThan(Math.max(...first.map(p => p.bottom)))
    expect(Math.max(...plates.map(p => p.width)) - Math.min(...plates.map(p => p.width))).toBeLessThanOrEqual(1)
    // Three across, and every French name still whole.
    for (const title of document.querySelectorAll('.plate__title')) {
      expect(title.scrollWidth).toBeLessThanOrEqual(title.clientWidth)
    }
    expect(document.scrollingElement.scrollHeight).toBeLessThanOrEqual(window.innerHeight + 1)
    const gutter = parseFloat(getComputedStyle(document.querySelector('.practice')).paddingBottom)
    expect(Math.abs(Math.max(...plates.map(p => p.bottom)) - (window.innerHeight - gutter))).toBeLessThanOrEqual(2)
  })
})

// ── plan 165 — every platform's specimen, with room ─────────────
// Two rows of plates leave each body its room: the line saying what
// the run asks is drawn over the well, and comprehension's text stands
// over its question and four choices, each on one line -- at every
// grade, with nothing cut and no scroll.
describe('every platform\'s specimen on a laptop (plan 165)', () => {
  it('draws the line over each well, and comprehension\'s text over its question', async () => {
    for (const grade of ['N5', 'N4', 'N3', 'N2', 'N1']) {
      learner.grade = grade
      const screen = await gate()
      await settle(300)
      expect(document.scrollingElement.scrollHeight, grade).toBeLessThanOrEqual(window.innerHeight + 1)
      const plates = $$('.practice > .plates > .plate')
      for (const plate of plates) {
        const how = plate.querySelector('.plate__how')
        expect(how.hidden, grade).toBe(false)
        expect(box(how).height, grade).toBeGreaterThan(0)
        const well = plate.querySelector('.prc-spec--plate')
        expect(well.classList.contains('prc-spec--compact'), grade).toBe(false)
        expect(box(well).top, grade).toBeGreaterThan(box(how).bottom)
        expect(well.scrollHeight, `${grade} ${plate.querySelector('.plate__title').textContent}`).toBeLessThanOrEqual(well.clientHeight + 1)
      }
      const comprehension = plates[1].querySelector('.prc-spec--plate')
      const card = CARDS.comprehension[grade].card
      expect(comprehension.querySelector('.prc-spec__title').textContent).toBe(card.title)
      // The text keeps a line or two under its title, above the question.
      const text = comprehension.querySelector('.prc-spec__text')
      expect(box(text).height).toBeGreaterThan(2 * box(comprehension.querySelector('.prc-spec__title')).height)
      expect(box(comprehension.querySelector('.prc-spec__q')).top).toBeGreaterThanOrEqual(box(text).bottom)
      expect(comprehension.querySelector('.prc-spec__q').textContent).toBe(card.question)
      const choices = $$('.prc-spec__opt', comprehension)
      expect(choices.map(c => c.querySelector('.prc-spec__label').textContent)).toEqual(card.options)
      // Each on one line, however long the sentence.
      const heights = choices.map(c => Math.round(box(c).height))
      expect(Math.max(...heights) - Math.min(...heights)).toBeLessThanOrEqual(1)
      await screen.unmount()
    }
    learner.grade = 'N5'
  })
})

