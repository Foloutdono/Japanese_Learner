import { describe, it, expect, vi, afterEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { MemoryRouter } from 'react-router-dom'
import { LangProvider } from './LangContext'
import './index.css'

// ── 机 — Today on the desk (plan 114) ────────────────────────────
// The fare gate is the work and takes the width; beside it stands what
// the work is FOR — the pass at strip size and the pass's back (the
// journey, the status sheet's own body), always open. On a phone the
// strip heads the gate and the back is a tap on the HUD away
// (deskfree.phone.test.jsx holds that side).

vi.mock('./lib/api', () => ({
  api: p => p,
  apiFetch: vi.fn(async () => ({ ok: true, status: 200, json: async () => ({}) })),
  apiJson: vi.fn(async () => ({})),
  apiJsonWithTimeout: vi.fn(), apiUpload: vi.fn(),
  ApiError: class extends Error {},
}))
vi.mock('./lib/audio', async o => ({ ...(await o()), playUi: vi.fn(), playClick: vi.fn() }))
const lane = (source, deck, mode, due) => ({ id: `${source}:${deck}:${mode}`, kind: 'section', source, deck, mode, due, new: 0 })
const TODAY = {
  total: 48, by_source: { vocab: 30, kanji: 18 }, next_due: null, pace: { target: 10, newToday: 4, remaining: 6 },
  lanes: [lane('vocab', 'N5', 'vocab.flashcard.f2b', 30), lane('kanji', 'N5', 'kanji.flashcard.f2b', 18)],
}
vi.mock('./stores/today', () => ({
  useTodaySummary: () => ({ data: TODAY, failed: false }),
  refreshToday: vi.fn(), seedTodaySummary: vi.fn(),
}))
const journeyRef = { current: null }
vi.mock('./stores/journey', () => ({
  useJourneyStatus: () => ({ data: journeyRef.current, failed: false }),
  useVolumes: () => ({ data: { vocab: { N5: 800, N4: 600 }, kanji: { N5: 100, N4: 200 }, grammar: { N5: 80, N4: 80 }, kana: 104 } }),
  refreshJourney: vi.fn(), seedJourneyStatus: vi.fn(), openStatus: vi.fn(),
}))
vi.mock('./stores/profileSummary', async o => ({ ...(await o()),
  useProfileSummary: () => ({ level: 12, jlptLevel: 'N5', streak: 3, week: [], guided: { today: true } }),
}))
vi.mock('./stores/credits', async o => ({ ...(await o()),
  useCredits: () => ({ balance: 30, cap: 50, unlimited: false }),
}))
globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })

const { default: TodayScreen } = await import('./screens/TodayScreen')

const settle = (ms = 300) => new Promise(r => setTimeout(r, ms))
const BEHIND = {
  goalStartLevel: 'N5', goalLevel: 'N4', goalTargetDate: '2027-03-14', goalSetAt: '2026-09-01T00:00:00Z',
  dailyDeparture: 'am', plannedPerDay: 10, itemsTotal: 1860, itemsDone: 410, actual14: 70, days14: 14,
}

afterEach(() => { journeyRef.current = null })

function mount() {
  return render(
    <LangProvider>
      <MemoryRouter initialEntries={['/today']}>
        <div className="phone phone--desk">
          <div className="phone__content"><TodayScreen session={{}} /></div>
        </div>
      </MemoryRouter>
    </LangProvider>
  )
}

describe('Today on the desk', () => {
  it('sets the gate on the left and the pass beside it, at the same top', async () => {
    journeyRef.current = BEHIND
    await mount()
    await settle()
    const main = document.querySelector('main.today')
    // The strip left the gate's head for the side column.
    expect(main.querySelector(':scope > .pass--strip')).toBeNull()
    const side = main.querySelector(':scope > .desk-side')
    expect(side.querySelector('.pass--strip')).not.toBeNull()
    const gate = main.querySelector(':scope > .gate-card').getBoundingClientRect()
    const s = side.getBoundingClientRect()
    expect(Math.round(gate.top)).toBe(Math.round(s.top))
    expect(s.left).toBeGreaterThan(gate.right)
    expect(Math.round(s.width)).toBe(360)
    expect(getComputedStyle(side).position).toBe('sticky')
  })

  it('stands the pass\'s back open beside the gate: distance, track, pace and arrival, and the moves', async () => {
    journeyRef.current = BEHIND
    await mount()
    await settle()
    const panel = document.querySelector('.desk-side .desk-journey')
    expect(panel).not.toBeNull()
    expect(panel.querySelector('.desk-journey__head').textContent.length).toBeGreaterThan(0)
    expect(panel.querySelector('.jour-dist__count').textContent).toMatch(/410/)
    expect(panel.querySelector('.jour-track')).not.toBeNull()
    expect(panel.querySelectorAll('.jour-cmp')).toHaveLength(2)
    expect(panel.querySelectorAll('.jour-act').length).toBeGreaterThan(0)
    // No dialog: the back is standing, not opened.
    expect(document.querySelector('[role="dialog"]')).toBeNull()
  })

  // Plan 116 sets the lanes two across once the gate holds two lanes at
  // a phone's width (today.wide.test.jsx). At the desk's tightest the
  // gate is ~430px and holds one: the lanes stay one to a row.
  it('keeps the lanes one to a row where the gate holds only one', async () => {
    await mount()
    await settle()
    const box = document.querySelector('.gate-card__lanes')
    const [a, b] = [...box.querySelectorAll('.lane')].map(el => el.getBoundingClientRect())
    expect(b.top).toBeGreaterThanOrEqual(a.bottom)
    expect(Math.round(b.left)).toBe(Math.round(a.left))
    expect(Math.round(a.width)).toBe(box.clientWidth)
  })

  it('stands nothing where there is no journey to judge', async () => {
    await mount()
    await settle()
    expect(document.querySelector('.desk-journey')).toBeNull()
    expect(document.querySelector('.desk-side .pass--strip')).not.toBeNull()
  })
})
