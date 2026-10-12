import { describe, it, expect, vi, afterEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { page } from 'vitest/browser'
import { MemoryRouter } from 'react-router-dom'
import { LangProvider } from './LangContext'
import { contentBox } from './testing/contentBox'
import './index.css'

// ── 机 — Today on a laptop (plan 199) ────────────────────────────
// The owner's pick A2 of the canvas "Tsuji — Today at a glance": the
// dial on a panel that takes the width, and beside it a column of what
// the services sheet holds on a phone, open, over the day's figures.
// Plan 114 stood the pass's strip and its back there; the rail's pass
// is the journey's on the desk, and its stub opens the status sheet.
// The wide desk is today.wide.test.jsx's, and a phone keeps its own
// gate (deskfree.phone.test.jsx).

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

// 時間割 (plan 181): an empty week unless a test fills it, so the day
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

describe('Today on a laptop', () => {
  it('sets the dial\'s panel on the left and the column beside it, at the same top', async () => {
    await mount()
    await settle()
    const main = document.querySelector('main.today')
    // Plan 114's side is gone: the pass is the rail's.
    expect(main.querySelector('.desk-side, .pass--strip, .desk-journey')).toBeNull()
    const hero = main.querySelector(':scope > .tdy-desk > .tdy-desk__hero').getBoundingClientRect()
    const col = main.querySelector(':scope > .tdy-desk > .tdy-desk__col')
    // Its content, inside the gutter it keeps for a row's focus ring.
    const c = contentBox(col)
    expect(Math.round(c.top)).toBe(Math.round(hero.top))
    expect(c.left).toBeGreaterThan(hero.right)
    // The column at the entry's width at most, the side's at least.
    expect(Math.round(c.width)).toBeGreaterThanOrEqual(360)
    expect(Math.round(c.width)).toBeLessThanOrEqual(440)
    expect(getComputedStyle(col).overflowY).toBe('auto')
  })

  // At the desk's tightest nothing may leave its panel: the dial gives
  // way to the panel's width, and the lines to the column's.
  it('holds the dial in its panel and every line and mode in the column at the desk\'s tightest', async () => {
    await mount()
    await settle()
    const inside = (el, box) => {
      const r = el.getBoundingClientRect()
      expect(r.left).toBeGreaterThanOrEqual(box.left)
      expect(r.right).toBeLessThanOrEqual(box.right)
    }
    const hero = document.querySelector('.tdy-desk__hero').getBoundingClientRect()
    inside(document.querySelector('.tdy-dial--desk'), hero)
    inside(document.querySelector('.tdy-desk__go .btn-depart'), hero)
    // Every line's modes opened, the column at its fullest.
    for (const more of document.querySelectorAll('.tdy-desk .tdy-line__more')) more.click()
    await settle(60)
    const col = contentBox(document.querySelector('.tdy-desk__col'))
    for (const el of document.querySelectorAll('.tdy-desk__col .tdy-line__head, .tdy-desk__col .lane, .tdy-desk__col .seg__opt')) inside(el, col)
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth)
  })

  // The lines' key, named, at the desk's tightest: four lines across
  // left the fourth alone on a second row. Two across, every line paired
  // and inside the panel.
  it('keys four lines two across inside the dial\'s panel, none alone on a row', async () => {
    const lanes = TODAY.lanes
    TODAY.lanes = [
      lane('kana', 'hiragana_basic', 'kana.flashcard.f2b', 8),
      lane('vocab', 'N5', 'vocab.flashcard.f2b', 158),
      lane('kanji', 'N5', 'kanji.flashcard.f2b', 86),
      lane('grammar', 'N5', 'grammar.ladder', 14),
    ]
    try {
      await mount()
      await settle()
      const hero = document.querySelector('.tdy-desk__hero').getBoundingClientRect()
      const keys = [...document.querySelectorAll('.tdy-desk__keys .tdy-key--lines .tdy-key__item')]
      expect(keys).toHaveLength(4)
      const rows = new Map()
      for (const k of keys) {
        const r = k.getBoundingClientRect()
        expect(r.left).toBeGreaterThanOrEqual(hero.left)
        expect(r.right).toBeLessThanOrEqual(hero.right)
        const top = Math.round(r.top)
        rows.set(top, (rows.get(top) ?? 0) + 1)
      }
      expect([...rows.values()]).toEqual([2, 2])
    } finally {
      TODAY.lanes = lanes
    }
  })

  it('keys a lone line on the panel\'s axis', async () => {
    const lanes = TODAY.lanes
    TODAY.lanes = [lane('vocab', 'N5', 'vocab.flashcard.f2b', 30)]
    try {
      await mount()
      await settle()
      const hero = document.querySelector('.tdy-desk__hero').getBoundingClientRect()
      const key = document.querySelector('.tdy-desk__keys .tdy-key--lines .tdy-key__item').getBoundingClientRect()
      expect(Math.abs(key.left + key.width / 2 - (hero.left + hero.width / 2))).toBeLessThan(2)
    } finally {
      TODAY.lanes = lanes
    }
  })

  // A laptop's short window (plan 123, kept by plans 135 and 199): the
  // gate is bounded by the window, the column scrolls inside it, and
  // the gate stays in view under the dial.
  it('scrolls the column in a short window, the gate still in view under the dial', async () => {
    const lanes = TODAY.lanes
    TODAY.lanes = ['N5', 'N4', 'N3', 'N2'].flatMap(d => [
      lane('vocab', d, 'vocab.flashcard.f2b', 5), lane('kanji', d, 'kanji.flashcard.f2b', 5),
    ])
    await page.viewport(1100, 650)
    try {
      await mount()
      await settle()
      const go = document.querySelector('.tdy-desk__go .btn-depart').getBoundingClientRect()
      expect(go.bottom).toBeLessThanOrEqual(window.innerHeight)
      expect(document.querySelector('.tdy-dial--desk').getBoundingClientRect().bottom).toBeLessThanOrEqual(go.top)
      // The modes closed, the column fits; opened, it scrolls on its own.
      const col = document.querySelector('.tdy-desk__col')
      expect(col.scrollHeight).toBeLessThanOrEqual(col.clientHeight)
      for (const more of document.querySelectorAll('.tdy-desk .tdy-line__more')) more.click()
      await settle(60)
      expect(col.getBoundingClientRect().bottom).toBeLessThanOrEqual(window.innerHeight)
      expect(col.scrollHeight).toBeGreaterThan(col.clientHeight)
    } finally {
      TODAY.lanes = lanes
      await page.viewport(1100, 800)
    }
  })
})

// ── plan 123's walk, retired by plan 199 ──
describe('Today\'s journey, called and finished', () => {
  // Plan 123 walked the rail's status chip to the journey's panel beside
  // the gate; the dial's column took that place, so the chip opens the
  // status sheet on Today as everywhere.
  it('opens the status sheet from the rail\'s status chip', async () => {
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
    expect(openStatus).toHaveBeenCalledTimes(1)
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
    expect(document.querySelector('main.today > .tdy-desk')).not.toBeNull()
  })
})

// ── 時間割 (plan 181) — what is next on the agenda, in the day ──
describe('the agenda in the day\'s figures', () => {
  afterEach(() => { agenda.blocks = []; vi.useRealTimers() })

  it('stands the block under way as a door to the agenda, inside the column', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 9, 7, 10, 0))
    agenda.blocks = WEEK
    await mount()
    await settle()
    const cell = document.querySelector('.tdy-desk__day .tdy-day__cell--door')
    expect(cell).not.toBeNull()
    expect(cell.getAttribute('href')).toMatch(/agenda/)
    expect(cell.querySelector('.tdy-day__fig').textContent).toBe('En cours')
    expect(cell.querySelector('.tdy-day__what').textContent).toMatch(/Kanji/)
    // The cell stays inside the column.
    const s = contentBox(document.querySelector('.tdy-desk__col'))
    const c = cell.getBoundingClientRect()
    expect(c.left).toBeGreaterThanOrEqual(s.left)
    expect(c.right).toBeLessThanOrEqual(s.right)
  })

  it('stands nothing for a learner with no agenda', async () => {
    await mount()
    await settle()
    expect(document.querySelector('.tdy-day__cell--door')).toBeNull()
  })
})
