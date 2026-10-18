import { describe, it, expect, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { MemoryRouter } from 'react-router-dom'
import { LangProvider } from './LangContext'
// The faces the app draws in (main.jsx), so Practice's wells are
// measured as a learner sees them.
import '@fontsource/space-grotesk/latin-700.css'
import '@fontsource/noto-sans-jp/400.css'
import '@fontsource/noto-sans-jp/700.css'
import './index.css'

// ── 低 — the gates on a laptop's short window (plan 169) ────────────
// At 1280×600 each of Learn's four line plates was 19px shorter than
// its line, the figures under its stops cut at every foot: they come in
// a rung and hold whole. Practice's plates (plans 165, 254) stand three
// to a row, each at its row's floor -- the room a well needs for its
// compact face -- and the window scrolls to the exam's paper: every
// platform's card whole at every grade.

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
vi.mock('./stores/boarding', () => ({ board: commit => commit() }))
// The learner's grade: N4, unless a test walks them all.
const learner = vi.hoisted(() => ({ grade: 'N4' }))
vi.mock('./stores/profileSummary', async (o) => ({
  ...(await o()),
  useProfileSummary: () => ({ jlptLevel: 'N4' }),
  useProfileSummaryState: () => ({ summary: { jlptLevel: learner.grade }, failed: false }),
}))
vi.mock('./stores/departure', async (o) => ({ ...(await o()), beginDeparture: vi.fn() }))
// The distance on each line (plan 130's upright foot): kana finished,
// vocab N5 met but not yet learned.
const STATS = {
  items: {
    kana: Object.fromEntries(['hiragana_basic', 'hiragana_combos', 'katakana_basic', 'katakana_combos'].map(k => [k, { total: 40, learned: 40, started: 40, score: 1 }])),
    vocab: { N5: { total: 600, learned: 60, started: 180, score: 0.2 }, N4: { total: 640 }, N3: { total: 1700 }, N2: { total: 1760 }, N1: { total: 3200 } },
  },
}
vi.mock('./stores/stats', async (o) => ({ ...(await o()), useStats: () => ({ data: STATS, failed: false }) }))
globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })

const { default: PracticeScreen } = await import('./screens/PracticeScreen')
const { default: LearnScreen } = await import('./screens/LearnScreen')

const settle = async (ms = 700) => {
  await new Promise(r => setTimeout(r, ms))
  await Promise.all(document.getAnimations()
    .filter(a => a.effect?.getComputedTiming().iterations !== Infinity)
    .map(a => a.finished.catch(() => {})))
}
function framed(path, screen) {
  return render(
    <LangProvider>
      <MemoryRouter initialEntries={[path]}>
        <div className="phone phone--desk">
          <div className="phone__content">{screen}</div>
        </div>
      </MemoryRouter>
    </LangProvider>
  )
}
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)]
const box = el => el.getBoundingClientRect()

describe('the gates on a short window', () => {
  it('holds each of Learn\'s line plates whole, its figures in the window', async () => {
    await framed('/learn', <LearnScreen session={{ access_token: 'tok' }} />)
    await settle()
    const plates = $$('.learn-desk .plate--line')
    expect(plates).toHaveLength(4)
    for (const plate of plates) expect(plate.scrollHeight).toBeLessThanOrEqual(plate.clientHeight + 1)
    expect(box(plates.at(-1)).bottom).toBeLessThanOrEqual(window.innerHeight)
  })

  it('stands Practice\'s plates three to a row at their floor, every card whole at every grade', async () => {
    try {
      for (const grade of ['N5', 'N4', 'N3', 'N2', 'N1']) {
        learner.grade = grade
        const screen = await framed('/practice', <PracticeScreen />)
        await new Promise(r => setTimeout(r, 400))
        await document.fonts.ready
        const plates = $$('.practice > .plates > .plate')
        expect(plates).toHaveLength(7)
        const tops = plates.map(p => box(p).top).reduce((acc, t) => (acc.some(r => Math.abs(r - t) <= 1) ? acc : [...acc, t]), [])
        expect(tops, grade).toHaveLength(3)
        // A row never gives a well less than its compact face: the
        // window scrolls the paper instead.
        for (const plate of plates) expect(box(plate).height, grade).toBeGreaterThanOrEqual(240 - 1)
        expect(document.scrollingElement.scrollHeight).toBeGreaterThan(window.innerHeight)
        for (const plate of plates) {
          const well = plate.querySelector('.prc-spec--plate')
          const what = `${grade} ${plate.querySelector('.plate__title').textContent}`
          expect(well.classList.contains('prc-spec--compact'), what).toBe(true)
          expect(well.textContent, what).not.toBe('')
          expect(well.scrollHeight, what).toBeLessThanOrEqual(well.clientHeight + 1)
          expect(well.scrollWidth, what).toBeLessThanOrEqual(well.clientWidth + 1)
        }
        await screen.unmount()
      }
    } finally {
      learner.grade = 'N4'
    }
  })
})
