import { describe, it, expect, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { MemoryRouter } from 'react-router-dom'
import { LangProvider } from './LangContext'
import './index.css'

// ── 低 — Today on a laptop's short window (plan 169) ────────────────
// The side column beside the gate runs the window's height and scrolls
// when it holds more; nothing in it gives way to fit. On a 600px window
// the pass's strip at its top, which clips its own sheen, had been
// crushed to a 26px sliver. And a lane's tile holds its name and its
// count apart: three tiles of 93px across a laptop's gate read "Hi…"
// with GRATUIT printed over the count.

vi.mock('./lib/api', () => ({
  api: p => p,
  apiFetch: vi.fn(async () => ({ ok: true, status: 200, json: async () => ({}) })),
  apiJson: vi.fn(async () => ({})),
  apiJsonWithTimeout: vi.fn(), apiUpload: vi.fn(),
  ApiError: class extends Error {},
}))
vi.mock('./lib/audio', async o => ({ ...(await o()), playUi: vi.fn(), playClick: vi.fn() }))
const TODAY = {
  total: 10, by_source: { kana: 10 }, next_due: null, pace: { target: 10, newToday: 0, remaining: 10 },
  lanes: [{ id: 'kana:hiragana_basic:kana.flashcard.f2b', kind: 'section', source: 'kana', deck: 'hiragana_basic', mode: 'kana.flashcard.f2b', due: 10, new: 10 }],
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
  it('keeps every block of the side column whole, the column scrolling instead', async () => {
    await mount()
    await settle()
    const side = document.querySelector('.today > .desk-side')
    // The pass's sheen reaches under its floor on purpose, so it is
    // measured by its height: its whole strip, not the sliver.
    for (const block of [...side.children].filter(b => !b.classList.contains('pass'))) {
      expect(block.scrollHeight, block.className).toBeLessThanOrEqual(block.clientHeight + 1)
    }
    expect(box(side.querySelector('.pass--strip')).height).toBeGreaterThan(85)
    expect(getComputedStyle(side).overflowY).toBe('auto')
  })

  it('holds a lane\'s name and its count apart on the tile', async () => {
    await mount()
    await settle()
    const tile = document.querySelector('.lane--tile')
    const where = box(tile.querySelector('.lane__where'))
    const due = box(tile.querySelector('.lane__due'))
    const tags = box(tile.querySelector('.lane__tags'))
    expect(where.right).toBeLessThanOrEqual(due.left)
    expect(tags.top).toBeGreaterThanOrEqual(due.bottom - 1)
    // The one lane of its band takes the band's row.
    expect(Math.round(box(tile).width)).toBe(Math.round(box(tile.parentElement).width))
  })
})
