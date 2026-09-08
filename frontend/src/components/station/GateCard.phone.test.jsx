import { describe, it, expect, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { LangProvider, useLang } from '../../LangContext'
import '../../index.css'

// ── 改札 — the day's switches, at 390px ───────────────────────
// Since plan 070 the lanes ARE the run's picker, but a phone block
// left over from when they were a breakdown hid them — and the 内訳
// toggle that opened it had stopped being rendered, so below 560px the
// gate printed "select none" over nothing and the day could not be
// narrowed on the one device it is read on.
//
// Unhiding alone is not the fix either: twelve lanes is 594px of
// switch, which put Depart past the bottom of the screen. The list is
// bounded and scrolls; the half-row the cap leaves is what says so.

vi.mock('../../lib/audio', async o => ({
  ...(await o()), playUi: vi.fn(), playAnnouncement: vi.fn(),
}))
vi.mock('../../stores/credits', () => ({
  useCredits: () => ({
    balance: 50, cap: 200, dailyRefill: 50, refillAt: null,
    unlimited: false, enforced: false,
  }),
}))

const { default: GateCard } = await import('./GateCard')

// The locale's own strings, read from the provider rather than
// imported, so the cases hold in whichever language the lane runs.
let T
function Probe() { T = useLang().t; return null }

const lane = (source, deck, mode, due) => ({
  id: `${source}:${deck}:${mode}`, kind: 'section', source, deck, mode, due,
})
const LANES = [
  lane('kana', 'hiragana_basic', 'kana.flashcard.f2b', 18),
  lane('kana', 'hiragana_combos', 'kana.write_romaji', 9),
  lane('kana', 'katakana_combos', 'kana.write_kana', 6),
  lane('vocab', 'N5', 'vocab.flashcard.f2b', 42),
  lane('vocab', 'N5', 'vocab.word_reading', 27),
  lane('vocab', 'N4', 'vocab.flashcard.b2f', 31),
  lane('kanji', 'N5', 'kanji.flashcard.f2b', 25),
  lane('kanji', 'N5', 'kanji.write_kanji', 19),
  lane('kanji', 'N4', 'kanji.readings', 22),
  lane('grammar', 'N5', 'grammar.flashcard.f2b', 16),
  lane('grammar', 'N4', 'grammar.fill_in', 12),
  { id: 'personal:3:vocab.flashcard.f2b', kind: 'personal', deck_id: 3,
    deck_name: 'Mots du bureau', mode: 'vocab.flashcard.f2b', due: 11 },
]
const TODAY = {
  total: LANES.reduce((n, l) => n + l.due, 0),
  lanes: LANES, by_source: {}, next_due: null, pace: null,
}

const settle = (ms = 60) => new Promise(r => setTimeout(r, ms))

async function gate(lanes = LANES) {
  const screen = await render(
    <LangProvider>
      <Probe />
      <main className="today" style={{ padding: '0 14px' }}>
        <GateCard today={{ ...TODAY, lanes, total: lanes.reduce((n, l) => n + l.due, 0) }} />
      </main>
    </LangProvider>
  )
  await settle()
  return screen
}

describe('the fare gate at phone width', () => {
  it('shows the day as switches, bounded so the gate stays a card', async () => {
    const screen = await gate()
    const box = screen.container.querySelector('.gate-card__lanes')
    const rows = [...screen.container.querySelectorAll('.lane')]

    // Every lane is a switch, and every switch is on the card.
    expect(rows).toHaveLength(LANES.length)
    expect(getComputedStyle(box).display).not.toBe('none')
    expect(box.getBoundingClientRect().height).toBeGreaterThan(0)

    // Bounded and scrollable: the list is shorter than its content, so
    // the row the cap cuts is visibly cut.
    expect(getComputedStyle(box).overflowY).toBe('auto')
    expect(box.scrollHeight).toBeGreaterThan(box.clientHeight)
    expect(box.getBoundingClientRect().height).toBeLessThan(rows[0].getBoundingClientRect().height * 6)

    // And the one filled action is still on the screen with them.
    const depart = screen.container.querySelector('.btn-depart')
    expect(depart.getBoundingClientRect().bottom).toBeLessThan(window.innerHeight)
  })

  it('names the deck and the mode on their own lines', async () => {
    const screen = await gate()
    for (const row of screen.container.querySelectorAll('.lane')) {
      const where = row.querySelector('.lane__where').getBoundingClientRect()
      const mode = row.querySelector('.lane__mode').getBoundingClientRect()
      // Under, not beside: one line for both ellipsised the mode away,
      // and two lanes of one deck differ only by their mode.
      expect(mode.top).toBeGreaterThanOrEqual(where.bottom - 1)
      expect(mode.width).toBeGreaterThan(0)
      expect(row.querySelector('.lane__mode').textContent.trim()).not.toBe('')
      // Both inside the row that carries them.
      expect(mode.right).toBeLessThanOrEqual(row.getBoundingClientRect().right)
    }
  })

  // ── 路線ごと — one switch per line ──
  // Twenty lanes is five taps to say "just the kanji" and fifteen to
  // say it the other way round. A chip is lit when the WHOLE line
  // rides, which makes the tap unambiguous both ways: lit switches the
  // line off, unlit switches all of it on.
  it('switches a whole line, and lights only while all of it rides', async () => {
    const screen = await gate()
    const chips = () => [...screen.container.querySelectorAll('.gate-card__lines .chip')]
    const count = () => Number(screen.container.querySelector('.gate-card__count').textContent)
    const all = count()

    // One per line in today's queue, in the lines' order, each carrying
    // what its line owes.
    expect(chips()).toHaveLength(5)
    expect(chips().map(c => c.getAttribute('aria-pressed'))).toEqual(Array(5).fill('true'))
    const kanaDue = LANES.filter(l => l.source === 'kana').reduce((n, l) => n + l.due, 0)
    expect(chips()[0].textContent).toContain(String(kanaDue))

    // Lit → the line comes out whole, and so does its share of the day.
    chips()[0].click()
    await settle()
    expect(count()).toBe(all - kanaDue)
    expect(chips()[0].getAttribute('aria-pressed')).toBe('false')
    const off = [...screen.container.querySelectorAll('.lane--off')]
    expect(off).toHaveLength(LANES.filter(l => l.source === 'kana').length)

    // One of its lanes back on by hand: the line is not whole, so the
    // chip stays unlit and its tap switches all of the line on.
    screen.container.querySelector('.lane--off').click()
    await settle()
    expect(chips()[0].getAttribute('aria-pressed')).toBe('false')
    chips()[0].click()
    await settle()
    expect(chips()[0].getAttribute('aria-pressed')).toBe('true')
    expect(count()).toBe(all)
  })

  it('takes a lane out of the day, and the count with it', async () => {
    const screen = await gate()
    const count = () => Number(screen.container.querySelector('.gate-card__count').textContent)
    const all = count()
    const first = screen.container.querySelector('.lane')
    expect(first.getAttribute('aria-pressed')).toBe('true')

    first.click()
    await settle()
    expect(first.getAttribute('aria-pressed')).toBe('false')
    expect(count()).toBe(all - LANES[0].due)

    // With one off, the all/none switch offers the day back.
    const pick = screen.container.querySelector('.gate-card__pick')
    expect(pick.textContent).toBe(T.todaySelectAll)
    pick.click()
    await settle()
    expect(count()).toBe(all)

    // And from a full day it clears: nothing chosen is not a run.
    expect(pick.textContent).toBe(T.todaySelectNone)
    pick.click()
    await settle()
    expect(count()).toBe(0)
    expect(screen.container.querySelector('.btn-depart').disabled).toBe(true)
  })
})
