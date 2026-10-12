import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { MemoryRouter } from 'react-router-dom'
import { LangProvider } from '../../LangContext'
import '../../index.css'

// ── 一目 — the day at 390px (plan 199) ──────────────────────────
// The owner's pick A2 of the canvas "Tsuji — Today at a glance": the
// gate is read at a glance -- the run as a dial (a ring of the lines
// round the count, the minutes and the hour they end), the legend, one
// row saying what the run is and opening the services, and the gate at
// the thumb. The services sheet holds the two choices (no title over
// either), the lines with their modes behind a chevron, and the day in
// four figures. Plan 166 had drawn the day as one card with the two
// choices on it.

vi.mock('../../lib/audio', async o => ({
  ...(await o()), playUi: vi.fn(), playClick: vi.fn(), playAnnouncement: vi.fn(),
}))
const creditsRef = vi.hoisted(() => ({ current: null }))
vi.mock('../../stores/credits', () => ({ useCredits: () => creditsRef.current }))
vi.mock('../../stores/departure', () => ({ beginDeparture: vi.fn(), useDeparture: () => null }))
vi.mock('../../stores/profileSummary', async o => ({
  ...(await o()),
  useProfileSummary: () => ({ level: 12, streak: 3, week: [] }),
}))
vi.mock('../../stores/agenda', () => ({ useAgenda: () => ({ blocks: null, failed: false }) }))
globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })

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
  lanes: LANES, by_source: {}, next_due: null, seconds_per_review: 12,
  pace: { target: 10, newToday: 4, remaining: 6 },
}
const PASS = { balance: null, cap: 50, unlimited: true, enforced: false }

const settle = (ms = 60) => new Promise(r => setTimeout(r, ms))

async function gate(today = TODAY) {
  const screen = await render(
    <LangProvider>
      <MemoryRouter>
        <main className="today" style={{ padding: '0 14px' }}>
          <GateCard today={{ ...today, total: today.total ?? today.lanes.reduce((n, l) => n + l.due, 0) }} />
        </main>
      </MemoryRouter>
    </LangProvider>
  )
  await settle()
  return screen
}

const count = () => Number(document.querySelector('.tdy-dial__count').textContent)
const text = el => el.textContent.replace(/\s+/g, ' ').trim()
// The words as read: each text node apart, so two elements side by side
// read as two words.
const words = el => {
  const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
  const out = []
  while (walk.nextNode()) out.push(walk.currentNode.textContent.trim())
  return out.filter(Boolean).join(' ').replace(/\s+/g, ' ')
}
const MAIN = LANES.filter(l => l.mode.endsWith('.flashcard.f2b')).reduce((n, l) => n + l.due, 0)
const RIDING = LANES.filter(l => l.mode.endsWith('.flashcard.f2b')).length
const ALL = TODAY.total

// The sheet portals to the body.
async function services(screen) {
  screen.container.querySelector('.tdy-door').click()
  await settle()
  return [...document.querySelectorAll('.tdy-sheet .tdy-line')]
}

beforeEach(() => {
  localStorage.clear()
  creditsRef.current = PASS
})

// The main flashcards are the gate's default (plan 199). A test about
// the switches themselves starts where every lane rides: the learner
// who chose every mode.
const everyMode = () => localStorage.setItem('tsuji.gateMain', '0')

describe('the fare gate at phone width', () => {
  it('draws the day as a dial over its legend, the row and the gate, and no switch on the screen', async () => {
    const screen = await gate()
    // The main flashcards, by default: the count, what it is, the
    // minutes at the learner's pace and the hour they end.
    expect(count()).toBe(MAIN)
    expect(text(document.querySelector('.tdy-dial__unit'))).toBe('à réviser')
    expect(text(document.querySelector('.tdy-dial__time'))).toBe(`≈ ${Math.round((MAIN * 12) / 60)} min`)
    expect(text(document.querySelector('.tdy-dial__end'))).toMatch(/^fini vers \d\d:\d\d$/)
    // A ring of the lines that ride, in their order, none cut.
    const arcs = [...document.querySelectorAll('.tdy-dial__ring g')]
    expect(arcs).toHaveLength(5)
    expect(document.querySelector('.tdy-dial__arc--dim')).toBeNull()
    // A pass is not asked to pay: the legend is the lines' shares.
    const keys = [...document.querySelectorAll('.tdy-key--lines .tdy-key__item')]
    expect(keys.map(k => text(k).replace(/\s*\d+$/, ''))).toEqual(['Kana', 'Vocabulaire JLPT', 'Kanji', 'Grammaire', 'Mes decks'])
    expect(keys.reduce((n, k) => n + Number(k.querySelector('b').textContent), 0)).toBe(MAIN)
    // No switch on the screen: they are behind the row.
    expect(document.querySelector('.lane, .tdy-line, [role="radiogroup"]')).toBeNull()
    expect(words(screen.container.querySelector('.tdy-door'))).toBe(`Principales · tout · ${RIDING} services Ajuster`)
    // The dial, the row, then the gate, on the screen and on one axis.
    const dial = document.querySelector('.tdy-dial').getBoundingClientRect()
    const door = screen.container.querySelector('.tdy-door').getBoundingClientRect()
    const go = screen.container.querySelector('.btn-depart--gate').getBoundingClientRect()
    expect(door.top).toBeGreaterThan(dial.bottom)
    expect(go.top).toBeGreaterThan(door.bottom)
    expect(go.bottom).toBeLessThanOrEqual(window.innerHeight)
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth)
  })

  it('opens the services with no title over either choice, and every mode is one tap and remembered', async () => {
    const screen = await gate()
    await services(screen)
    const groups = [...document.querySelectorAll('.tdy-sheet [role="radiogroup"]')]
    // Named for a screen reader, captioned for nobody.
    expect(groups.map(g => g.getAttribute('aria-label'))).toEqual(['Quelles cartes', 'Combien'])
    expect(document.querySelector('.tdy-sheet .gate-card__ask-label, .tdy-sheet .cap')).toBeNull()
    const [main, every] = groups[0].querySelectorAll('.seg__opt')
    expect(words(main)).toBe(`Principales ${MAIN}`)
    expect(words(every)).toBe(`Tous les modes ${ALL}`)
    expect(main.getAttribute('aria-checked')).toBe('true')
    every.click()
    await settle()
    expect(count()).toBe(ALL)
    expect(text(screen.container.querySelector('.tdy-door'))).toContain(`Tous les modes · tout · ${LANES.length} services`)
    expect(localStorage.getItem('tsuji.gateMain')).toBe('0')
    // Each choice holds one line, the whole option's width.
    for (const opt of document.querySelectorAll('.tdy-sheet .seg__opt')) {
      expect(opt.scrollWidth).toBeLessThanOrEqual(opt.clientWidth + 1)
    }
  })

  it('cuts the run to a length, each length with the minutes it takes, the dial lighting its share', async () => {
    const screen = await gate()
    await services(screen)
    const lengths = [...document.querySelectorAll('.tdy-seg--two .seg__opt')]
    expect(lengths.map(words)).toEqual(['20 4 min', '50 10 min', '100 20 min', `Tout ${Math.round((MAIN * 12) / 60)} min`])
    lengths[1].click()
    await settle()
    expect(count()).toBe(50)
    expect(text(document.querySelector('.tdy-dial__unit'))).toBe(`sur ${MAIN}`)
    // What the run leaves of each line dims; what it takes is drawn over it.
    expect(document.querySelectorAll('.tdy-dial__arc--dim').length).toBeGreaterThan(0)
    const shares = [...document.querySelectorAll('.tdy-key--lines b')].map(el => Number(el.textContent))
    expect(shares.reduce((n, x) => n + x, 0)).toBe(50)
    expect(text(screen.container.querySelector('.tdy-door'))).toContain('Principales · 50 ·')
    expect(localStorage.getItem('tsuji.gateTake')).toBe('50')
  })

  it('lists a line\'s modes behind its chevron, the deck before the mode', async () => {
    const screen = await gate()
    const lines = await services(screen)
    expect(lines.map(l => text(l.querySelector('.tdy-line__name')))).toEqual(['Kana', 'Vocabulaire JLPT', 'Kanji', 'Grammaire', 'Mes decks'])
    // A line says what rides of it, until its modes are opened.
    const kana = lines[0]
    expect(text(kana.querySelector('.tdy-line__sub'))).toContain('Kana → romaji')
    kana.querySelector('.tdy-line__more').click()
    await settle()
    const rows = [...kana.querySelectorAll('.tdy-line__lanes .lane')]
    expect(rows).toHaveLength(3)
    expect(kana.querySelector('.tdy-line__sub')).toBeNull()
    // The main flashcard rides; the other modes wait on the platform.
    expect(rows.map(r => r.getAttribute('aria-pressed'))).toEqual(['true', 'false', 'false'])
    for (const row of rows) {
      expect(row.getBoundingClientRect().height).toBeGreaterThanOrEqual(44)
      expect(row.querySelector('.lane__mode').textContent.trim()).not.toBe('')
    }
    // The line of one mode has no chevron: its head is its switch.
    expect(lines[4].querySelector('.tdy-line__more')).toBeNull()
  })

  // ── 路線ごと — one switch per line ──
  // Lit while any of the line rides, so a tap takes the line out of
  // the day; unlit, a tap puts back what the choice of cards boards.
  it('takes a line out of the day while any of it rides, and puts back what the choice boards', async () => {
    const screen = await gate()
    const [kana] = await services(screen)
    const head = kana.querySelector('.tdy-line__head')
    expect(head.getAttribute('aria-pressed')).toBe('true')
    head.click()
    await settle()
    expect(head.getAttribute('aria-pressed')).toBe('false')
    expect(count()).toBe(MAIN - 18)
    expect(text(kana.querySelector('.tdy-line__sub'))).toBe('Aucun service aujourd’hui')
    head.click()
    await settle()
    // Under Principales the line comes back as its main flashcard.
    expect(count()).toBe(MAIN)
    expect(localStorage.getItem('tsuji.gateMain')).toBeNull()
  })

  it('takes every line out, and every line off is not a run', async () => {
    everyMode()
    const screen = await gate()
    for (const line of await services(screen)) {
      line.querySelector('.tdy-line__head').click()
      await settle(20)
    }
    await settle()
    expect(count()).toBe(0)
    expect(screen.container.querySelector('.btn-depart').disabled).toBe(true)
  })

  it('holds the day in figures under the lines, and the gate at the sheet\'s foot', async () => {
    const screen = await gate()
    await services(screen)
    const cells = [...document.querySelectorAll('.tdy-sheet .tdy-day__cell')]
    // The streak and the day's new cards: an even lattice, no seam bare.
    expect(cells.map(c => text(c.querySelector('.tdy-day__what')))).toEqual(['jours de suite', 'nouveautés aujourd’hui'])
    expect(text(cells[1].querySelector('.tdy-day__fig'))).toBe('4/ 10')
    expect(document.querySelector('.tdy-day--odd')).toBeNull()
    const foot = document.querySelector('.tdy-sheet__foot .btn-depart--gate')
    const sheet = document.querySelector('.tdy-sheet').getBoundingClientRect()
    expect(foot.getBoundingClientRect().width).toBeGreaterThan(sheet.width * 0.8)
    expect(foot.getBoundingClientRect().bottom).toBeLessThanOrEqual(window.innerHeight)
  })

  it('draws what boards and what waits while the balance is short', async () => {
    creditsRef.current = { balance: 20, cap: 50, unlimited: false, enforced: false, nextCreditAt: '2026-09-07T22:48:00+00:00' }
    await gate()
    // The kana's main flashcard rides free: 18 + 20 board.
    const [rides, waits] = [...document.querySelectorAll('.tdy-key--fare b')].map(b => Number(b.textContent))
    expect(rides).toBe(38)
    expect(waits).toBe(MAIN - 38)
    expect(document.querySelector('.tdy-dial__fare-ride')).toBeTruthy()
    expect(document.querySelector('.tdy-dial__fare-end')).toBeTruthy()
  })
})

// ── 済 — a day with nothing due ──────────────────────────────────
describe('the gate with nothing due', () => {
  const at = new Date(Date.now() + 2 * 3600_000).toISOString()
  it('closes the dial round the day\'s seal, the day said under it and the gate shut until it opens', async () => {
    await gate({
      total: 0, lanes: [], next_due: at,
      reviewed: { total: 31, by_line: { vocab: 20, kanji: 11 } },
      tomorrow: { cards: 9, minutes: 3 },
    })
    expect(document.querySelectorAll('.tdy-dial__ring g')).toHaveLength(2)
    expect(document.querySelector('.clrk-seal')).toBeTruthy()
    expect(text(document.querySelector('.tdy-recap'))).toBe('31 cartes aujourd’hui')
    expect(document.querySelectorAll('.tdy-rally .clrk-slot')).toHaveLength(7)
    expect(words(document.querySelector('.tdy-next'))).toBe('Demain 9 cartes ≈ 3 min')
    const go = document.querySelector('.btn-depart--gate')
    expect(go.disabled).toBe(true)
    expect(text(go)).toMatch(/^Ouvre à \d\d:\d\d$/)
  })

  it('stamps nothing on a day nothing was reviewed', async () => {
    await gate({ total: 0, lanes: [], next_due: null, reviewed: { total: 0, by_line: {} } })
    expect(document.querySelector('.clrk-seal')).toBeNull()
    expect(text(document.querySelector('.tdy-dial__clear'))).toBe('À jour')
    expect(document.querySelector('.tdy-dial__track')).toBeTruthy()
    expect(document.querySelector('.btn-depart--gate').disabled).toBe(true)
  })
})
