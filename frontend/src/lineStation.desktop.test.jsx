import { describe, it, expect, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { LangProvider } from './LangContext'
import { parkPointer } from './testing/parkPointer'
import './index.css'

// ── 号車 — a line's station on the narrowest desk (plan 251) ─────────
// At 1100px the page under the line is about 800px: grammar's seven
// cars take three to a row, the ladder across the first, and the rows
// keep their floor -- the page scrolls rather than crush a car. The
// line's names keep one line each, cut short where they must be, and a
// face that would overflow its well steps down a rung until it fits
// (lineStation.wide is the full station).

vi.mock('./lib/audio', async o => ({
  ...(await o()),
  playUi: vi.fn(), playClick: vi.fn(), playAnnouncement: vi.fn(), startAmbiance: vi.fn(), stopAmbiance: vi.fn(),
}))
vi.mock('./lib/api', () => ({
  api: p => p,
  apiFetch: vi.fn(async () => ({ ok: true, status: 200, json: async () => ({}) })),
  apiJson: vi.fn(async () => ({ points: [], learned: 0, started: 0, total: 91, totals: {} })),
  apiJsonWithTimeout: vi.fn(), apiUpload: vi.fn(),
  ApiError: class extends Error {},
}))
vi.mock('./stores/boarding', () => ({ board: commit => commit() }))
const SUMMARY = { level: 3, jlptLevel: 'N5', streak: 1 }
vi.mock('./stores/profileSummary', async o => ({ ...(await o()),
  useProfileSummary: () => SUMMARY,
  useProfileSummaryState: () => ({ summary: SUMMARY, failed: false }),
}))
const STATS = {
  vocab: { N5: { 'vocab.flashcard.f2b': { total: 674, new: 643, learning: 31, mastered: 0, due_now: 3, reviews: 90, correct: 70 } } },
  items: { vocab: { N5: { total: 674, learned: 0, started: 31, score: 0 } }, grammar: { N5: { total: 91, learned: 0, started: 0, score: 0 } } },
}
vi.mock('./stores/stats', () => ({ useStats: () => ({ data: STATS, failed: false }), refreshStats: vi.fn() }))
// A meaning long enough to run to two lines, under a sentence too long
// for one: the faces that must step down.
const SAMPLES = {
  vocab: { N5: { sample: ['何', '私'], card: { jp: '何', reading: 'なん', meaning: 'quoi' } } },
  grammar: {
    N5: {
      sample: ['が'],
      card: {
        jp: 'が', meaning: 'marque le sujet grammatical de la proposition', sentence: '花がきれいです。',
        blank: { before: 'どのバスが駅へ行きますか、それとも', after: 'あのバスが駅へ行きますか。', choices: ['は', 'を', 'が'] },
      },
    },
  },
}
vi.mock('./stores/stationSamples', () => ({
  useStationSamples: (source, enabled = true) => (enabled ? SAMPLES[source] ?? null : null),
}))
globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })

const { default: VocabScreen } = await import('./screens/VocabScreen')
const { default: GrammarScreen } = await import('./screens/GrammarScreen')
// Past the timer, the cars' arrival itself (@keyframes arrive, a 10px
// rise): the timer fires before it has ended, and a car read in flight
// is not where it stands.
const settle = async (ms = 300) => {
  await new Promise(r => setTimeout(r, ms))
  await Promise.all(document.getAnimations()
    .filter(a => a.effect?.getComputedTiming().iterations !== Infinity)
    .map(a => a.finished.catch(() => {})))
}
const rect = el => el.getBoundingClientRect()
const cars = () => [...document.querySelectorAll('.desk-platforms > .platform-grid .platform-card')]

function mount(entry, route) {
  return render(
    <LangProvider>
      <MemoryRouter initialEntries={[entry]}>
        <div className="phone phone--desk">
          <div className="phone__content"><Routes>{route}</Routes></div>
        </div>
      </MemoryRouter>
    </LangProvider>
  )
}

describe('a line\'s station at 1100px (plan 251)', () => {
  it('stands grammar\'s seven cars three to a row, at their floor, and lets the page scroll', async () => {
    await mount('/learn/grammar/N5', <Route path="/learn/grammar/:level" element={<GrammarScreen session={null} />} />)
    // Under no pointer: the lane's pointer is shared, a file before this
    // one may have left it where a car now stands, and a hovered car
    // lifts a pixel -- one row's cars read 356 and 357, and three rows
    // counted four.
    await parkPointer()
    await settle()
    const all = cars()
    expect(all).toHaveLength(7)
    expect(document.querySelector('.desk-platforms').style.getPropertyValue('--cars')).toBe('3')
    // The ladder takes the first row whole; two rows of three under it.
    const tops = [...new Set(all.map(c => Math.round(rect(c).top)))]
    expect(tops).toHaveLength(3)
    expect(Math.abs(rect(all[0]).width - rect(document.querySelector('.desk-platforms > .platform-grid')).width)).toBeLessThan(2)
    for (const c of all) expect(rect(c).height).toBeGreaterThanOrEqual(5 * 52 - 1)
    expect(document.documentElement.scrollHeight).toBeGreaterThan(window.innerHeight)
  })

  it('fits every face to its well, a rung down where it must', async () => {
    await mount('/learn/grammar/N5', <Route path="/learn/grammar/:level" element={<GrammarScreen session={null} />} />)
    await settle()
    for (const car of cars()) {
      const well = car.querySelector('.desk-spec')
      const face = car.querySelector('.desk-spec__face')
      if (!face) continue
      const pad = parseFloat(getComputedStyle(well).paddingTop)
      expect(face.scrollHeight, car.textContent).toBeLessThanOrEqual(rect(well).height - 2 * pad + 1)
      expect(face.scrollWidth, car.textContent).toBeLessThanOrEqual(rect(well).width - 2 * pad + 1)
    }
  })

  it('keeps each stop\'s name to one line, cut short where the line is narrow', async () => {
    await mount('/learn/vocab/N5', <Route path="/learn/vocab/:level" element={<VocabScreen session={null} />} />)
    await settle()
    const names = [...document.querySelectorAll('.desk-station__line .route-stop__jp')]
    expect(names).toHaveLength(5)
    for (const n of names) {
      expect(getComputedStyle(n).whiteSpace).toBe('nowrap')
      expect(getComputedStyle(n).textOverflow).toBe('ellipsis')
    }
    const stop = rect(document.querySelector('.desk-station__line .route-stop'))
    for (const s of document.querySelectorAll('.desk-station__line .route-stop')) {
      expect(Math.abs(rect(s).height - stop.height)).toBeLessThan(2)
    }
    // Three vocab cars: two to a row, the first across.
    expect(document.querySelector('.desk-platforms').style.getPropertyValue('--cars')).toBe('2')
    expect(cars()[0].querySelector('.desk-mode-fig__due').textContent).toBe('3 à réviser')
    expect(document.querySelector('.desk-platforms__foot .platform-card__title').textContent).toBe('Révision rapide')
  })
})
