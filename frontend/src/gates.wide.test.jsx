import { describe, it, expect, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { MemoryRouter } from 'react-router-dom'
import { LangProvider } from './LangContext'
// The shipped face (main.jsx), so a platform's name is measured in the
// font it is drawn in: since plan 174 the names are the display face,
// and the runner's fallback for it (DejaVu Sans) sets « Entraînement à
// la lecture » 45px wider than Space Grotesk does.
import '@fontsource/space-grotesk/latin-700.css'
// ... and the wells' Japanese in the app's own face, so a sentence
// breaks where a learner sees it break.
import '@fontsource/noto-sans-jp/400.css'
import '@fontsource/noto-sans-jp/700.css'
import './index.css'

// ── 机 — the Practice gate on a laptop (plans 165, 254) ──────────────
// The `wide` lane: a laptop's 1440×900. The seven plates stand three to
// a row, the exam's paper the whole last row, and the gate holds the
// window whole: every name on its plate (a long one in two lines) and
// every platform's card whole in its well at every grade. At the desk's
// tightest (screens/PracticeScreen.desktop.test.jsx) the rows go two
// across and the window scrolls a row.

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
const LEVELS = ['N5', 'N4', 'N3', 'N2', 'N1']

const settle = async (ms = 400) => {
  await new Promise(r => setTimeout(r, ms))
  await document.fonts.ready
}
const box = el => el.getBoundingClientRect()
const $ = sel => document.querySelector(sel)
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
const plates = () => $$('.practice > .plates > .plate')
const nameOf = plate => plate.querySelector('.plate__title').textContent

describe('the Practice gate on a laptop (plans 165, 254)', () => {
  it('stands the seven three to a row in the window, every card whole at every grade', async () => {
    try {
      for (const level of LEVELS) {
        learner.grade = level
        const screen = await gate()
        await settle()
        expect(document.scrollingElement.scrollHeight, level).toBeLessThanOrEqual(window.innerHeight + 1)
        const boxes = plates().map(box)
        expect(boxes).toHaveLength(7)
        // Three rows: the first two of three plates, the paper the third
        // (a row's plates within a pixel: the rows share the window).
        const rows = boxes.reduce((acc, b) => (acc.some(r => Math.abs(r - b.top) <= 1) ? acc : [...acc, b.top]), [])
        expect(rows).toHaveLength(3)
        expect(boxes.filter(b => Math.abs(b.top - rows[0]) <= 1)).toHaveLength(3)
        expect(boxes.filter(b => Math.abs(b.top - rows[1]) <= 1)).toHaveLength(3)
        const whole = box($('.practice > .plates'))
        expect(Math.abs(boxes[6].width - whole.width), level).toBeLessThanOrEqual(1)
        for (const plate of plates()) {
          const what = `${level} ${nameOf(plate)}`
          const well = plate.querySelector('.prc-spec--plate')
          expect(well.textContent, what).not.toBe('')
          expect(well.scrollHeight, what).toBeLessThanOrEqual(well.clientHeight + 1)
          expect(well.scrollWidth, what).toBeLessThanOrEqual(well.clientWidth + 1)
          const title = plate.querySelector('.plate__title')
          expect(title.scrollWidth, what).toBeLessThanOrEqual(title.clientWidth)
        }
        expect(plates()[0].querySelector('.prc-spec__jp').textContent).toBe(CARDS.reading[level].card.jp)
        await screen.unmount()
      }
    } finally {
      learner.grade = 'N5'
    }
  })
})
