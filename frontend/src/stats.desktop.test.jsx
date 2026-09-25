import { describe, it, expect, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { MemoryRouter } from 'react-router-dom'
import { LangProvider } from './LangContext'
import './index.css'
import { parkPointer } from './testing/parkPointer'

// ── 机 — the statistics as a dashboard (plan 114) ────────────────
// On a phone the service record is one column read top to bottom, its
// two drill-downs (a line's levels, the trouble cards past six) behind
// sheets, and its chart a 326-unit drawing scaled to the card. On the
// desk it is two columns — what holds beside where it leaks — with no
// sheet at all: the chart drawn 1:1 at the card's own width, a line's
// levels opened in place, every trouble card on the page. The phone's
// side is deskfree.phone.

vi.mock('./lib/audio', async o => ({ ...(await o()), playUi: vi.fn(), playClick: vi.fn() }))

const bucket = (total, mastered, learning) => ({ total, new: total - mastered - learning, learning, mastered, due_now: 3, reviews: mastered * 6 + learning * 3, correct: mastered * 5 + learning * 2 })
const STATS = {
  kana: {
    hiragana_basic: { 'kana.flashcard.f2b': bucket(46, 40, 6) },
    katakana_basic: { 'kana.flashcard.f2b': bucket(46, 10, 20) },
  },
  vocab: { N5: { 'vocab.flashcard.f2b': bucket(665, 120, 80) }, N4: { 'vocab.flashcard.f2b': bucket(632, 10, 20) } },
  kanji: { N5: { 'kanji.flashcard.f2b': bucket(80, 30, 20) } },
  grammar: {},
}
function iso(daysAgo) {
  const d = new Date()
  d.setDate(d.getDate() - daysAgo)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const REPORT = {
  days: Array.from({ length: 60 }, (_, i) => ({ date: iso(59 - i), reviews: 40, good: 30 + (i % 7) })),
  strength: [{ days: 0, count: 120 }, { days: 3, count: 80 }, { days: 12, count: 140 }, { days: 45, count: 90 }],
  weakest: Array.from({ length: 12 }, (_, i) => ({
    card_id: `c${i}`, raw_id: `vocab_N5_語${i}_ご`, category: 'vocab', key: 'N5', mode: 'vocab.flashcard.f2b',
    accuracy: 30 + i * 3, lapses: 6 - (i % 5),
  })),
}
vi.mock('./lib/api', () => ({
  api: p => p,
  apiFetch: vi.fn(),
  apiJson: vi.fn(),
  apiJsonWithTimeout: vi.fn(async path => (path === '/api/stats' ? STATS : REPORT)),
  apiUpload: vi.fn(),
  ApiError: class extends Error {},
}))

const { default: StatsScreen } = await import('./screens/StatsScreen')

const settle = (ms = 250) => new Promise(r => setTimeout(r, ms))
const $ = s => document.querySelector(s)
const $$ = s => [...document.querySelectorAll(s)]

async function mount() {
  await render(
    <LangProvider>
      <MemoryRouter initialEntries={['/profile/stats']}>
        <div className="phone phone--desk">
          <div className="phone__content"><StatsScreen session={null} /></div>
        </div>
      </MemoryRouter>
    </LangProvider>
  )
  await settle()
}

describe('the statistics on the desk', () => {
  it('reads what holds beside where it leaks', async () => {
    await mount()
    const holds = $('.desk-stats__holds').getBoundingClientRect()
    const leaks = $('.desk-stats__leaks').getBoundingClientRect()
    expect(leaks.left).toBeGreaterThan(holds.right)
    expect(Math.abs(leaks.top - holds.top)).toBeLessThan(2)
    expect(leaks.width).toBe(360)
    expect($('.desk-stats__holds .rep-line__svg')).not.toBeNull()
    expect($('.desk-stats__leaks .trouble')).not.toBeNull()
    expect(document.body.scrollWidth).toBeLessThanOrEqual(window.innerWidth)
  })

  it('draws the retention line 1:1', async () => {
    await mount()
    const svg = $('.rep-line__svg')
    const box = svg.getBoundingClientRect()
    const [, , w, h] = svg.getAttribute('viewBox').split(' ').map(Number)
    expect(w).toBeGreaterThan(326)
    expect(Math.abs(w - box.width)).toBeLessThanOrEqual(1)
    expect(h).toBe(160)
    expect(Math.abs(box.height - 160)).toBeLessThanOrEqual(1)
  })

  it('opens a line\'s levels in place, one line at a time, bars aligned', async () => {
    await mount()
    const [kana, vocab] = $$('.desk-lines .rep-line-row[aria-expanded]')
    expect(kana.getAttribute('aria-expanded')).toBe('true')
    expect($$('.desk-lines__levels .rep-line-row--level')).toHaveLength(2)

    vocab.click()
    await settle(60)
    expect(kana.getAttribute('aria-expanded')).toBe('false')
    expect(vocab.getAttribute('aria-expanded')).toBe('true')
    expect($$('.desk-lines__levels')).toHaveLength(1)
    expect($('[role="dialog"]')).toBeNull()

    // One table: every composition bar starts on the same line.
    const lefts = $$('.desk-lines .composition').map(el => Math.round(el.getBoundingClientRect().left))
    expect(new Set(lefts).size).toBe(1)

    vocab.click()
    await settle(60)
    expect($('.desk-lines__levels')).toBeNull()
  })

  it('shows every trouble card, with no foot row and no sheet', async () => {
    await mount()
    expect($$('.trouble__row')).toHaveLength(12)
    expect($('.trouble__more')).toBeNull()
  })
})

// ── plan 123, P19 — the line asked by a mouse ──
// The chart picked a week on a press, and on a move only while pressed:
// a mouse over it -- the cursor a pointer -- was shown nothing. On the
// desk the week under the mouse is asked as it passes, the pressed week
// comes back when it leaves, and a click still pins one.
describe('the retention line under a mouse', () => {
  it('previews the week under the pointer, and a click pins it', async () => {
    const { userEvent } = await import('vitest/browser')
    await mount()
    const asked = () => $$('.rep-caps .rep-cap')[1]?.textContent
    const ring = () => Number($('.rep-line__sel').getAttribute('cx'))
    const now = [asked(), ring()]
    await userEvent.hover($('.rep-line__svg'))
    await settle(60)
    expect(asked()).not.toBe(now[0])
    expect(ring()).toBeLessThan(now[1])
    const middle = [asked(), ring()]
    await userEvent.hover($('.rep-head'))
    await settle(60)
    expect([asked(), ring()]).toEqual(now)
    await userEvent.click($('.rep-line__svg'))
    await userEvent.hover($('.rep-head'))
    await settle(60)
    expect([asked(), ring()]).toEqual(middle)
    // The lane's pointer is shared: parked, not over the next file's page.
    await parkPointer()
  })
})
