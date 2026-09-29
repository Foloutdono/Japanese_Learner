import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { LangProvider } from '../../LangContext'
import '../../index.css'

// ── 改札 — the day at 390px ─────────────────────────────────
// Since plan 070 the lanes are the run's picker. Plan 166 (the owner's
// pick C of the canvas "Tsuji — Today on the phone") draws the phone's
// gate in one gesture: the day as one card -- the count and minutes, a
// bar of each line's share, which cards and how many -- the gate under
// it, and the switches behind one row that opens them in a sheet. The
// card had scrolled twelve lanes inside itself, under a row of chips
// that said the same thing by line.

vi.mock('../../lib/audio', async o => ({
  ...(await o()), playUi: vi.fn(), playAnnouncement: vi.fn(),
}))
vi.mock('../../stores/credits', () => ({
  useCredits: () => ({
    balance: 50, cap: 200, dailyRefill: 50, nextCreditAt: null,
    unlimited: false, enforced: false,
  }),
}))

const { default: GateCard } = await import('./GateCard')

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
      <main className="today" style={{ padding: '0 14px' }}>
        <GateCard today={{ ...TODAY, lanes, total: lanes.reduce((n, l) => n + l.due, 0) }} />
      </main>
    </LangProvider>
  )
  await settle()
  return screen
}

const count = () => Number(document.querySelector('.gate-card__count').textContent)
const text = el => el.textContent.replace(/\s+/g, ' ').trim()
const MAIN = LANES.filter(l => l.mode.endsWith('.flashcard.f2b')).reduce((n, l) => n + l.due, 0)
const ALL = TODAY.total

// The sheet portals to the body.
async function services(screen) {
  screen.container.querySelector('.gate-one__services').click()
  await settle()
  return [...document.querySelectorAll('.gate-sheet .lane')]
}

beforeEach(() => { localStorage.clear() })

describe('the fare gate at phone width', () => {
  it('draws the day as one card, the gate under it and no switch on the screen', async () => {
    const screen = await gate()
    const card = screen.container.querySelector('.gate-card--one')
    expect(card).not.toBeNull()
    expect(count()).toBe(ALL)
    // No second scroll: the switches are behind the row, not on the card.
    expect(document.querySelector('.lane')).toBeNull()
    expect(screen.container.querySelector('.gate-card__lanes, .gate-card__lines')).toBeNull()
    // Each line's share, in the lines' order, adding up to the run.
    const keys = [...screen.container.querySelectorAll('.gate-mix__key')]
    expect(keys.map(k => text(k).replace(/\s*\d+$/, ''))).toEqual(['Kana', 'Vocabulaire JLPT', 'Kanji', 'Grammaire', 'Mes decks'])
    expect(keys.reduce((n, k) => n + Number(k.querySelector('.gate-mix__n').textContent), 0)).toBe(ALL)
    expect(screen.container.querySelectorAll('.gate-mix__part')).toHaveLength(5)
    // The two questions, each a radio group across the card.
    const groups = [...card.querySelectorAll('[role="radiogroup"]')]
    expect(groups.map(g => g.getAttribute('aria-label'))).toEqual(['Quelles cartes', 'Combien'])
    for (const g of groups) expect(Math.round(g.getBoundingClientRect().width)).toBe(Math.round(card.querySelector('.gate-card__asks').getBoundingClientRect().width))
    // The row to the services says how many ride.
    expect(text(screen.container.querySelector('.gate-one__services'))).toContain(`${LANES.length} sur ${LANES.length}`)
    // The card, the row, then the gate, on the screen and on one axis.
    const go = screen.container.querySelector('.btn-depart--gate')
    expect(go.getBoundingClientRect().top).toBeGreaterThan(card.getBoundingClientRect().bottom)
    expect(go.getBoundingClientRect().bottom).toBeLessThanOrEqual(window.innerHeight)
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth)
  })

  it('boards the main flashcards alone, and says so on the row', async () => {
    const screen = await gate()
    const [, main] = screen.container.querySelectorAll('.gate-card__modes .seg__opt')
    expect(text(main)).toBe(`Principales · ${MAIN}`)
    main.click()
    await settle()
    expect(count()).toBe(MAIN)
    const riding = LANES.filter(l => l.mode.endsWith('.flashcard.f2b')).length
    expect(text(screen.container.querySelector('.gate-one__services'))).toContain(`${riding} sur ${LANES.length}`)
    expect(localStorage.getItem('tsuji.gateMain')).toBe('1')
  })

  it('cuts the run to a length, dealt over the lines', async () => {
    const screen = await gate()
    const lengths = [...screen.container.querySelectorAll('.gate-card__take .seg__opt')]
    expect(lengths.map(text)).toEqual(['20', '50', '100', `Tout · ${ALL}`])
    lengths[1].click()
    await settle()
    expect(count()).toBe(50)
    expect(text(screen.container.querySelector('.gate-card__unit'))).toBe(`sur ${ALL}`)
    const shares = [...screen.container.querySelectorAll('.gate-mix__n')].map(el => Number(el.textContent))
    expect(shares.reduce((n, x) => n + x, 0)).toBe(50)
  })

  it('opens the switches in a sheet, the deck over the mode', async () => {
    const screen = await gate()
    const rows = await services(screen)
    expect(rows).toHaveLength(LANES.length)
    expect(document.querySelector('.gate-sheet[role="dialog"]')).not.toBeNull()
    for (const row of rows) {
      const where = row.querySelector('.lane__where').getBoundingClientRect()
      const mode = row.querySelector('.lane__mode').getBoundingClientRect()
      // Under, not beside: one line for both ellipsised the mode away,
      // and two lanes of one deck differ only by their mode.
      expect(mode.top).toBeGreaterThanOrEqual(where.bottom - 1)
      expect(mode.width).toBeGreaterThan(0)
      expect(row.querySelector('.lane__mode').textContent.trim()).not.toBe('')
      expect(mode.right).toBeLessThanOrEqual(row.getBoundingClientRect().right)
    }
    document.querySelector('.gate-sheet__done').click()
    await settle()
    expect(document.querySelector('.gate-sheet')).toBeNull()
  })

  // ── 路線ごと — one switch per line ──
  // Twenty lanes is five taps to say "just the kanji" and fifteen to
  // say it the other way round. A line's head is lit when the WHOLE
  // line rides, which makes the tap unambiguous both ways: lit switches
  // the line off, unlit switches all of it on.
  it('switches a whole line, and lights only while all of it rides', async () => {
    const screen = await gate()
    await services(screen)
    const heads = () => [...document.querySelectorAll('.gate-sheet__head')]

    // One per line in today's queue, in the lines' order, each carrying
    // what its line owes.
    expect(heads()).toHaveLength(5)
    expect(heads().map(c => c.getAttribute('aria-pressed'))).toEqual(Array(5).fill('true'))
    const kanaDue = LANES.filter(l => l.source === 'kana').reduce((n, l) => n + l.due, 0)
    expect(heads()[0].textContent).toContain(String(kanaDue))

    // Lit → the line comes out whole, and so does its share of the day.
    heads()[0].click()
    await settle()
    expect(count()).toBe(ALL - kanaDue)
    expect(heads()[0].getAttribute('aria-pressed')).toBe('false')
    expect(document.querySelectorAll('.gate-sheet .lane--off')).toHaveLength(LANES.filter(l => l.source === 'kana').length)

    // One of its lanes back on by hand: the line is not whole, so the
    // head stays unlit and its tap switches all of the line on.
    document.querySelector('.gate-sheet .lane--off').click()
    await settle()
    expect(heads()[0].getAttribute('aria-pressed')).toBe('false')
    heads()[0].click()
    await settle()
    expect(heads()[0].getAttribute('aria-pressed')).toBe('true')
    expect(count()).toBe(ALL)
  })

  it('takes a lane out of the day, and the count with it; every line off is not a run', async () => {
    const screen = await gate()
    const [first] = await services(screen)
    expect(first.getAttribute('aria-pressed')).toBe('true')
    first.click()
    await settle()
    expect(first.getAttribute('aria-pressed')).toBe('false')
    expect(count()).toBe(ALL - LANES[0].due)

    // The kana head is unlit (half its line): one tap makes the line
    // whole, a second takes it away; every other head, one tap.
    for (const head of document.querySelectorAll('.gate-sheet__head')) {
      if (head.getAttribute('aria-pressed') === 'false') {
        head.click()
        await settle(20)
      }
      head.click()
      await settle(20)
    }
    await settle()
    expect(count()).toBe(0)
    const go = screen.container.querySelector('.btn-depart')
    expect(go.disabled).toBe(true)
  })
})
