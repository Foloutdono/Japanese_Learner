import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { userEvent } from 'vitest/browser'
import { MemoryRouter } from 'react-router-dom'
import { LangProvider } from './LangContext'
import './index.css'

// ── 机 — the gate's lanes two across, on a laptop (plan 116) ───────
// At 1440 one lane per row ran ~704px, the name at one end and its
// figure at the other, and the bounded box hid half the day's switches
// under its cut. Two across, a lane is a phone's width again and the
// day is in view. The desk's tightest width keeps one lane to a row
// (today.desktop.test.jsx), and a phone keeps its own box
// (deskfree.phone.test.jsx).

vi.mock('./lib/api', () => ({
  api: p => p,
  apiFetch: vi.fn(async () => ({ ok: true, status: 200, json: async () => ({}) })),
  apiJson: vi.fn(async () => ({})),
  apiJsonWithTimeout: vi.fn(), apiUpload: vi.fn(),
  ApiError: class extends Error {},
}))
vi.mock('./lib/audio', async o => ({ ...(await o()), playUi: vi.fn(), playClick: vi.fn(), playAnnouncement: vi.fn() }))
const departure = vi.hoisted(() => ({ begin: vi.fn(), current: null }))
vi.mock('./stores/departure', () => ({
  beginDeparture: (...a) => departure.begin(...a),
  endDeparture: vi.fn(),
  useDeparture: () => departure.current,
}))
const lane = (source, deck, mode, due) => ({ id: `${source}:${deck}:${mode}`, kind: 'section', source, deck, mode, due, new: 0 })
// Eight lanes over four lines, two of them odd: the day a learner a few
// weeks in actually has.
const EIGHT = [
  lane('kana', 'hiragana_basic', 'kana.flashcard.f2b', 18),
  lane('kana', 'katakana_basic', 'kana.flashcard.f2b', 9),
  lane('vocab', 'N5', 'vocab.flashcard.f2b', 30),
  lane('vocab', 'N5', 'vocab.word_reading', 12),
  lane('vocab', 'N4', 'vocab.flashcard.b2f', 7),
  lane('kanji', 'N5', 'kanji.flashcard.f2b', 14),
  lane('kanji', 'N5', 'kanji.readings', 6),
  lane('grammar', 'N5', 'grammar.flashcard.f2b', 5),
]
const todayOf = lanes => ({
  total: lanes.reduce((n, l) => n + l.due, 0), by_source: {}, next_due: null,
  pace: { target: 10, newToday: 4, remaining: 6 }, lanes,
})
const todayRef = vi.hoisted(() => ({ current: null }))
vi.mock('./stores/today', () => ({
  useTodaySummary: () => ({ data: todayRef.current, failed: false }),
  refreshToday: vi.fn(), seedTodaySummary: vi.fn(),
}))
vi.mock('./stores/journey', () => ({
  useJourneyStatus: () => ({ data: null, failed: false }),
  useVolumes: () => ({ data: null }),
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
const press = key => window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }))
const $ = s => document.querySelector(s)
const $$ = s => [...document.querySelectorAll(s)]
const token = name => parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name))

beforeEach(() => {
  departure.begin.mockReset()
  departure.current = null
  todayRef.current = todayOf(EIGHT)
})

async function mount() {
  const screen = await render(
    <LangProvider>
      <MemoryRouter initialEntries={['/today']}>
        <div className="phone phone--desk">
          <div className="phone__content"><TodayScreen session={{}} /></div>
        </div>
      </MemoryRouter>
    </LangProvider>
  )
  await settle()
  return screen
}

describe('the gate\'s lanes on a laptop', () => {
  it('go two across, in the list\'s own order, each at least as wide as a phone draws it', async () => {
    await mount()
    const box = $('.gate-card__lanes')
    expect(getComputedStyle(box).display).toBe('grid')
    const rows = $$('.lane').map(el => el.getBoundingClientRect())
    expect(rows).toHaveLength(8)
    // Left to right, then down: the sorted order is the reading order.
    expect(Math.round(rows[1].top)).toBe(Math.round(rows[0].top))
    expect(rows[1].left).toBeGreaterThan(rows[0].right)
    expect(rows[2].top).toBeGreaterThan(rows[0].bottom)
    expect(Math.round(rows[2].left)).toBe(Math.round(rows[0].left))
    // Four rows, two columns: never a third.
    expect(new Set(rows.map(r => Math.round(r.left))).size).toBe(2)
    expect(new Set(rows.map(r => Math.round(r.top))).size).toBe(4)
    // No narrower than a phone draws a lane, no wider than a phone's
    // whole content: the figure stands a phone's width from its name.
    const floor = token('--desk-side-w') - 2 * token('--sp-5')
    for (const r of rows) {
      expect(r.width).toBeGreaterThanOrEqual(floor)
      expect(r.width).toBeLessThanOrEqual(token('--desk-side-w'))
    }
  })

  it('stand the line chips and Depart across both columns', async () => {
    await mount()
    const rows = $$('.lane').map(el => el.getBoundingClientRect())
    const left = Math.min(...rows.map(r => r.left))
    const right = Math.max(...rows.map(r => r.right))
    for (const sel of ['.gate-card__lines', '.btn-depart']) {
      const r = $(sel).getBoundingClientRect()
      expect(r.left, sel).toBeLessThanOrEqual(left + 1)
      expect(r.right, sel).toBeGreaterThanOrEqual(right - 1)
    }
  })

  it('show an eight-lane day whole, with nothing under the cut', async () => {
    await mount()
    const box = $('.gate-card__lanes')
    expect(box.scrollHeight).toBeLessThanOrEqual(box.clientHeight)
  })

  it('keep a single lane the whole row', async () => {
    todayRef.current = todayOf([EIGHT[2]])
    await mount()
    const box = $('.gate-card__lanes')
    const style = getComputedStyle(box)
    const content = box.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight)
    expect(Math.round($('.lane').getBoundingClientRect().width)).toBe(Math.round(content))
  })
})

describe('Enter, with the lanes two across', () => {
  it('departs with the whole day when every lane is on', async () => {
    await mount()
    press('Enter')
    await settle(60)
    expect(departure.begin).toHaveBeenCalledTimes(1)
    expect(departure.begin.mock.calls[0][0].path).toBe('/today/run')
  })

  it('departs with the choice made in the second column', async () => {
    await mount()
    const second = $$('.lane')[3]
    expect(second.getBoundingClientRect().left).toBeGreaterThan($$('.lane')[2].getBoundingClientRect().right)
    // A real click, which leaves the focus on the lane, as Chrome does.
    // The page's Enter departs from there: a lane pressed by the pointer
    // does not own the key (plan 123) -- it used to press the lane again
    // and turn it back on, which the blur this test once made hid.
    await userEvent.click(second)
    await settle(60)
    expect(second.getAttribute('aria-pressed')).toBe('false')
    expect(document.activeElement).toBe(second)
    await userEvent.keyboard('{Enter}')
    await settle(60)
    expect(second.getAttribute('aria-pressed')).toBe('false')
    expect(departure.begin).toHaveBeenCalledTimes(1)
    const path = departure.begin.mock.calls[0][0].path
    const chosen = decodeURIComponent(path.split('lanes=')[1] ?? '').split(',')
    expect(path.startsWith('/today/run?lanes=')).toBe(true)
    expect(chosen).toHaveLength(7)
    expect(chosen).not.toContain(EIGHT[3].id)
  })
})
