import { describe, it, expect, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { MemoryRouter } from 'react-router-dom'
import { LangProvider } from './LangContext'
import './index.css'

// ── 低 — Today on a laptop's short window (plans 169, 199) ──────────
// The column beside the dial runs the window's height and scrolls when
// it holds more; nothing in it gives way to fit (plan 169's lesson: on
// a 600px window the pass's strip that stood there had been crushed to
// a 26px sliver). The dial gives way instead, to a smaller size, and
// the gate stays under it. And a row holds its name and its count
// apart: a tile of 93px had read "Hi…" with GRATUIT over the count.

vi.mock('./lib/api', () => ({
  api: p => p,
  apiFetch: vi.fn(async () => ({ ok: true, status: 200, json: async () => ({}) })),
  apiJson: vi.fn(async () => ({})),
  apiJsonWithTimeout: vi.fn(), apiUpload: vi.fn(),
  ApiError: class extends Error {},
}))
vi.mock('./lib/audio', async o => ({ ...(await o()), playUi: vi.fn(), playClick: vi.fn() }))
const TODAY = {
  total: 16, by_source: { kana: 16 }, next_due: null, pace: { target: 10, newToday: 0, remaining: 10 },
  lanes: [
    { id: 'kana:hiragana_basic:kana.flashcard.f2b', kind: 'section', source: 'kana', deck: 'hiragana_basic', mode: 'kana.flashcard.f2b', due: 10, new: 10 },
    { id: 'kana:katakana_basic:kana.write_romaji', kind: 'section', source: 'kana', deck: 'katakana_basic', mode: 'kana.write_romaji', due: 6, new: 0 },
  ],
}
vi.mock('./stores/today', () => ({
  useTodaySummary: () => ({ data: TODAY, failed: false }),
  refreshToday: vi.fn(), seedTodaySummary: vi.fn(),
}))
vi.mock('./stores/journey', () => ({
  useJourneyStatus: () => ({ data: {
    goalStartLevel: 'N5', goalLevel: 'N4', goalTargetDate: '2027-03-14', goalSetAt: '2026-09-01T00:00:00Z',
    dailyDeparture: 'am', plannedPerDay: 10, itemsTotal: 1860, itemsDone: 410, actual14: 70, days14: 14,
  }, failed: false }),
  useVolumes: () => ({ data: { vocab: { N5: 800, N4: 600 }, kanji: { N5: 100, N4: 200 }, grammar: { N5: 80, N4: 80 }, kana: 104 } }),
  refreshJourney: vi.fn(), seedJourneyStatus: vi.fn(), openStatus: vi.fn(),
}))
vi.mock('./stores/profileSummary', async o => ({ ...(await o()),
  useProfileSummary: () => ({ level: 12, jlptLevel: 'N5', streak: 3, week: [], guided: { today: true } }),
}))
vi.mock('./stores/credits', async o => ({ ...(await o()),
  useCredits: () => ({ balance: 200, cap: 50, unlimited: false }),
}))
globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })

const { default: TodayScreen } = await import('./screens/TodayScreen')
const settle = (ms = 400) => new Promise(r => setTimeout(r, ms))
const box = el => el.getBoundingClientRect()

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

describe('Today on a short window', () => {
  it('keeps every panel of the column whole, the column scrolling instead', async () => {
    await mount()
    await settle()
    const col = document.querySelector('.today .tdy-desk__col')
    for (const panel of col.children) {
      expect(panel.scrollHeight, panel.className).toBeLessThanOrEqual(panel.clientHeight + 1)
    }
    expect(getComputedStyle(col).overflowY).toBe('auto')
    expect(box(col).bottom).toBeLessThanOrEqual(window.innerHeight)
  })

  // 一枚 (plan 199b, the owner's pick A3·1): a five-line day, every
  // figure of the day and the week ahead, and still no scroll.
  it('holds a five-line day on the board with no scroll, nothing clipped', async () => {
    const lanes = TODAY.lanes
    const lane = (source, deck, mode, due) => ({ id: `${source}:${deck}:${mode}`, kind: 'section', source, deck, mode, due, new: 0 })
    TODAY.lanes = [
      lane('kana', 'hiragana_basic', 'kana.flashcard.f2b', 8),
      lane('vocab', 'N5', 'vocab.flashcard.f2b', 158),
      lane('kanji', 'N5', 'kanji.flashcard.f2b', 51), lane('kanji', 'N4', 'kanji.flashcard.f2b', 35), lane('kanji', 'N5', 'kanji.readings', 33),
      lane('grammar', 'N5', 'grammar.ladder', 14),
      { id: 'personal:3:vocab.flashcard.f2b', kind: 'personal', deck_id: 3, deck_name: 'Mots', mode: 'vocab.flashcard.f2b', due: 11, new: 0 },
    ]
    TODAY.total = TODAY.lanes.reduce((n, l) => n + l.due, 0)
    try {
      await mount()
      await settle()
      expect(document.querySelectorAll('.tdy-desk .tdy-line')).toHaveLength(5)
      const col = document.querySelector('.tdy-desk__col')
      expect(col.scrollHeight).toBeLessThanOrEqual(col.clientHeight)
      for (const el of document.querySelectorAll('.tdy-desk__svc .seg__opt, .tdy-day__fig, .tdy-day__what')) {
        expect(el.scrollWidth, el.textContent).toBeLessThanOrEqual(el.clientWidth + 1)
      }
    } finally {
      TODAY.lanes = lanes
      TODAY.total = 16
    }
  })

  it('gives the dial way to the window, the gate under it and in view', async () => {
    await mount()
    await settle()
    const dial = box(document.querySelector('.tdy-dial--desk'))
    const go = box(document.querySelector('.tdy-desk__go .btn-depart'))
    expect(Math.round(dial.width)).toBeLessThanOrEqual(280)
    expect(dial.top).toBeGreaterThanOrEqual(box(document.querySelector('.tdy-desk__hero')).top)
    expect(dial.bottom).toBeLessThanOrEqual(go.top)
    expect(go.bottom).toBeLessThanOrEqual(window.innerHeight)
  })

  it('holds a line\'s name and its count apart, and a mode\'s', async () => {
    await mount()
    await settle()
    const head = document.querySelector('.tdy-desk .tdy-line__head')
    expect(box(head.querySelector('.tdy-line__name')).right).toBeLessThanOrEqual(box(head.querySelector('.tdy-line__n')).left)
    document.querySelector('.tdy-desk .tdy-line__more').click()
    await settle(60)
    expect(document.querySelectorAll('.tdy-desk .tdy-line__lanes .lane')).toHaveLength(2)
    for (const row of document.querySelectorAll('.tdy-desk .tdy-line__lanes .lane')) {
      const where = box(row.querySelector('.lane__names'))
      const due = box(row.querySelector('.lane__due'))
      expect(where.right).toBeLessThanOrEqual(due.left)
      const free = row.querySelector('.lane__free')
      if (free) expect(box(free).right).toBeLessThanOrEqual(due.left)
    }
  })
})
