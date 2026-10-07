import { describe, it, expect, vi, afterEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { page } from 'vitest/browser'
import { MemoryRouter } from 'react-router-dom'
import { LangProvider } from './LangContext'
import { contentBox } from './testing/contentBox'
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

// 時間割 (plan 181): an empty week unless a test fills it, so the gate
// stands as it did for every test that is not about the agenda.
const agenda = vi.hoisted(() => ({ blocks: [] }))
vi.mock('./stores/agenda', () => ({ useAgenda: () => ({ blocks: agenda.blocks, failed: false }), saveAgenda: vi.fn() }))
const WEEK = [
  { id: 1, subject: 'kanji', days: [0, 1, 2, 3, 4], start: 540, end: 660, notify: true, lead: 10 },
  { id: 2, subject: 'dictation', days: [2], start: 780, end: 840, notify: true, lead: 15 },
  { id: 3, subject: 'reading', days: [5], start: 840, end: 960, notify: false, lead: 0 },
]
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
    const s = contentBox(side)
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

  // Plan 135 draws each line as a band, its switch beside its lanes
  // (today.wide.test.jsx). At the desk's tightest nothing may leave the
  // gate: a band that cannot hold both drops its lanes under the switch.
  it('holds every band inside the gate at the desk\'s tightest', async () => {
    await mount()
    await settle()
    const gate = document.querySelector('.gate-card--desk').getBoundingClientRect()
    for (const el of document.querySelectorAll('.gate-band__line, .gate-band .lane')) {
      const r = el.getBoundingClientRect()
      expect(r.left).toBeGreaterThanOrEqual(gate.left)
      expect(r.right).toBeLessThanOrEqual(gate.right)
    }
    for (const band of document.querySelectorAll('.gate-band')) {
      const line = band.querySelector('.gate-band__line').getBoundingClientRect()
      const tile = band.querySelector('.lane').getBoundingClientRect()
      expect(tile.left > line.right || tile.top >= line.bottom).toBe(true)
    }
  })

  // A laptop's short window (plan 123, kept by plan 135): the gate is
  // bounded by the window, the bands scroll inside it, and Depart and
  // the fare stay in view.
  it('scrolls the bands in a short window, Depart still in view', async () => {
    const lanes = TODAY.lanes
    TODAY.lanes = ['N5', 'N4', 'N3', 'N2'].flatMap(d => [
      lane('vocab', d, 'vocab.flashcard.f2b', 5), lane('kanji', d, 'kanji.flashcard.f2b', 5),
    ])
    await page.viewport(1100, 650)
    try {
      await mount()
      await settle()
      const go = document.querySelector('.btn-depart').getBoundingClientRect()
      expect(go.bottom).toBeLessThanOrEqual(window.innerHeight)
      expect(document.querySelector('.gate-card__fare-parts').getBoundingClientRect().bottom).toBeLessThanOrEqual(window.innerHeight)
      const box = document.querySelector('.gate-card__bands')
      expect(getComputedStyle(box).overflowY).toBe('auto')
      expect(box.getBoundingClientRect().bottom).toBeLessThanOrEqual(go.top)
    } finally {
      TODAY.lanes = lanes
      await page.viewport(1100, 800)
    }
  })

  it('stands nothing where there is no journey to judge', async () => {
    await mount()
    await settle()
    expect(document.querySelector('.desk-journey')).toBeNull()
    expect(document.querySelector('.desk-side .pass--strip')).not.toBeNull()
  })
})

// ── plan 123 — one panel, one word; the finish keeps the strip ──
describe('Today\'s side, called and finished (plan 123)', () => {
  // The rail's status is the stub of its pass since plan 127; the walk
  // is the same one, off the same anchor.
  it('walks the rail\'s status chip to the panel beside the gate, with no dialog', async () => {
    journeyRef.current = BEHIND
    const { DeskPass } = await import('./components/chrome/DeskPass')
    const { openStatus } = await import('./stores/journey')
    openStatus.mockClear()
    await render(
      <LangProvider>
        <MemoryRouter initialEntries={['/today']}>
          <div className="phone phone--desk">
            <aside className="desk-rail"><DeskPass /></aside>
            <div className="phone__content"><TodayScreen session={{}} /></div>
          </div>
        </MemoryRouter>
      </LangProvider>
    )
    await settle()
    document.querySelector('.desk-rail [data-guide="hud.status"]').click()
    await settle(60)
    expect(openStatus).not.toHaveBeenCalled()
    expect(document.querySelector('[aria-modal="true"]')).toBeNull()
    expect(document.activeElement).toBe(document.querySelector('.desk-journey'))
  })

  it('prints no finish (plan 191): a run ends on /today/clear', async () => {
    journeyRef.current = BEHIND
    await render(
      <LangProvider>
        <MemoryRouter initialEntries={[{ pathname: '/today', state: { run: { cleared: 12, xp: 40 } } }]}>
          <div className="phone phone--desk">
            <div className="phone__content"><TodayScreen session={{}} /></div>
          </div>
        </MemoryRouter>
      </LangProvider>
    )
    await settle()
    expect(document.querySelector('main.today > .today-clear')).toBeNull()
    expect(document.querySelector('main.today > .desk-side .pass--strip')).not.toBeNull()
  })
})


// ── 時間割 (plan 181) — what is next on the agenda, beside the gate ──
describe('the agenda beside the gate', () => {
  afterEach(() => { agenda.blocks = []; vi.useRealTimers() })

  it('stands under the strip, over the journey, with the two blocks after it', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 9, 7, 10, 0))
    agenda.blocks = WEEK
    journeyRef.current = BEHIND
    await mount()
    await settle()
    const side = document.querySelector('.today > .desk-side')
    const kids = [...side.children]
    const card = side.querySelector(':scope > .agd-now')
    expect(card).not.toBeNull()
    expect(kids.indexOf(card)).toBe(kids.indexOf(side.querySelector(':scope > .pass--strip')) + 1)
    expect(kids.indexOf(card)).toBeLessThan(kids.indexOf(side.querySelector(':scope > .desk-journey')))
    expect(card.querySelectorAll('.agd-now__then li')).toHaveLength(2)
    // The card stays inside the column.
    const s = side.getBoundingClientRect()
    const c = card.getBoundingClientRect()
    expect(c.left).toBeGreaterThanOrEqual(s.left)
    expect(c.right).toBeLessThanOrEqual(s.right)
  })

  it('stands nothing for a learner with no agenda', async () => {
    await mount()
    await settle()
    expect(document.querySelector('.desk-side .agd-now')).toBeNull()
  })
})
