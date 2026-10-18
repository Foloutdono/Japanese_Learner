import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { MemoryRouter } from 'react-router-dom'
import { LangProvider } from '../../LangContext'
import '../../index.css'

// ── The fare gate prices the run (plan 069) ───────────────────
// What boards and what waits, said only when the balance is under the
// fare (the dial's inner ring and its legend since plan 199); the gate
// closed at zero ONLY under enforcement — shadow mode says so and lets
// the train leave.

const creditsRef = { current: null }
vi.mock('../../stores/credits', () => ({
  useCredits: () => creditsRef.current,
  openBalance: vi.fn(),
}))
vi.mock('../../stores/departure', () => ({ beginDeparture: vi.fn(), useDeparture: () => null }))
vi.mock('../../lib/audio', async (o) => ({ ...(await o()), playAnnouncement: vi.fn() }))
globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })

const { default: GateCard } = await import('./GateCard')

const LANES = [
  { id: 's~kanji~N4~kanji.flashcard.f2b', kind: 'section', source: 'kanji', deck: 'N4', mode: 'kanji.flashcard.f2b', due: 14 },
  { id: 's~vocab~N5~vocab.flashcard.f2b', kind: 'section', source: 'vocab', deck: 'N5', mode: 'vocab.flashcard.f2b', due: 10 },
]
// 無料 — the kana line rides free (core/credits.py). The server says so
// on the lane; the gate has to mark the row AND leave it out of what
// the balance is asked to cover.
const KANA_LANE = { id: 's~kana~hiragana_base~kana.flashcard.f2b', kind: 'section', source: 'kana', deck: 'hiragana_base', mode: 'kana.flashcard.f2b', due: 12, free: true }
const TODAY = { total: 24, lanes: LANES, next_due: null }
const FREE = { balance: 30, pending: 0, cap: 50, dailyRefill: 30, refillEvery: 2880, nextCreditAt: '2026-09-07T22:48:00+00:00', plan: 'free', unlimited: false, enforced: false }

function mount(today = TODAY) {
  return render(
    <LangProvider>
      <MemoryRouter>
        <GateCard today={today} failed={false} />
      </MemoryRouter>
    </LangProvider>
  )
}

beforeEach(() => { creditsRef.current = FREE })

// The switches stand in the services sheet since plan 166, opened from
// the row under the dial (plan 199); the sheet portals to the body. A
// line of one mode is switched by its head.
async function services(screen) {
  screen.container.querySelector('.tdy-door').click()
  await new Promise(r => setTimeout(r, 60))
  return [...document.querySelectorAll('.tdy-sheet .tdy-line')]
}
const line = (lines, word) => lines.find(l => l.querySelector('.tdy-line__name').textContent.includes(word))
const count = screen => screen.container.querySelector('.tdy-dial__count').textContent
const fare = screen => screen.container.querySelector('.tdy-key--fare')

// A fare line stood over the notice — Fare · n credits · a hairline ·
// Balance · the figure in gold — printing the count the card already
// sets in figures three times the size, beside a balance the HUD's
// pass carries a thumb's width up the same screen. Owner's call: the
// gate says nothing about credits while the balance covers the run.
// Since plan 199 what the balance does not cover is the dial's inner
// ring and its legend: what boards, and what waits until when.
describe('GateCard — the fare', () => {
  it('says nothing about credits while the balance covers the run', async () => {
    const screen = await mount()
    expect(fare(screen)).toBeNull()
    expect(screen.container.querySelector('.tdy-dial__fare-wait')).toBeNull()
    // The count is still the dial's own figure, and the gate is open.
    expect(count(screen)).toBe('24')
    expect(screen.container.querySelector('.btn-depart').disabled).toBe(false)
  })

  it('says what boards and what waits when the balance is short, and draws it inside the dial', async () => {
    creditsRef.current = { ...FREE, balance: 12 }
    // The fare is the chosen lanes' due (plan 070), so the lanes carry
    // the 42, not `total`.
    const screen = await mount({ ...TODAY, total: 42, lanes: [{ ...LANES[0], due: 30 }, { ...LANES[1], due: 12 }] })
    const [rides, waits] = [...fare(screen).querySelectorAll('b')].map(b => b.textContent)
    expect([rides, waits]).toEqual(['12', '30'])
    expect(fare(screen).textContent).toContain('+1')
    // The inner ring: solid to the share that boards, dashed for the rest.
    const ride = screen.container.querySelector('.tdy-dial__fare-ride')
    // Round the fare's ring as the print draws it (plan 205: the radius
    // is the print's, and the frame chooses the print).
    const c = 2 * Math.PI * Number(ride.getAttribute('r'))
    expect(Number.parseFloat(ride.getAttribute('stroke-dasharray'))).toBeCloseTo((12 / 42) * c, 3)
    expect(screen.container.querySelector('.tdy-dial__fare-wait')).toBeTruthy()
    // The legend gives the line keys' place to it.
    expect(screen.container.querySelector('.tdy-key--lines')).toBeNull()
    expect(screen.container.querySelector('.btn-depart').disabled).toBe(false)
  })

  // One render per test: vitest-browser-react cleans up between
  // tests, and a manual unmount() mid-test detaches the next render.
  // The refill lands a credit at a time now (plan 141): the legend
  // names the next one, not a lump at midnight.
  it('at zero names the next credit and keeps the gate open in shadow mode', async () => {
    creditsRef.current = { ...FREE, balance: 0 }
    const screen = await mount()
    expect(fare(screen).textContent).toContain('+1')
    expect(fare(screen).querySelector('b').textContent).toBe('0')
    expect(screen.container.querySelector('.btn-depart').disabled).toBe(false)
  })

  it('closes the gate at zero only under enforcement', async () => {
    creditsRef.current = { ...FREE, balance: 0, enforced: true }
    const screen = await mount()
    const gate = screen.container.querySelector('.btn-depart')
    expect(gate.disabled).toBe(true)
    // Closed is the gate's outline (改札, plan 164), not a faded fill:
    // full strength, the gold layer gone, the word in the second ink.
    expect(getComputedStyle(gate).opacity).toBe('1')
    expect(getComputedStyle(gate, '::before').opacity).toBe('0')
    expect(gate.classList.contains('btn-depart--gate')).toBe(true)
  })

  it('prints no fare on a pass', async () => {
    creditsRef.current = { ...FREE, balance: null, unlimited: true }
    const screen = await mount()
    expect(fare(screen)).toBeNull()
    expect(screen.container.querySelector('.tdy-key--lines')).toBeTruthy()
    expect(screen.container.querySelector('.btn-depart').disabled).toBe(false)
  })

  it('a line switched off comes out of the count, and the fare follows (plan 070)', async () => {
    creditsRef.current = { ...FREE, balance: 12 }
    const screen = await mount()
    expect(fare(screen)).toBeTruthy()
    const kanji = line(await services(screen), 'Kanji').querySelector('.tdy-line__head')
    expect(kanji.getAttribute('aria-pressed')).toBe('true')
    kanji.click()
    await new Promise(r => setTimeout(r, 60))
    expect(kanji.getAttribute('aria-pressed')).toBe('false')
    expect(count(screen)).toBe('10')
    // Ten ride on twelve credits: nothing waits any more.
    expect(fare(screen)).toBeNull()
  })

  it('marks a free line and leaves it out of what the balance covers', async () => {
    // 22 due, 12 of them free, 10 credits: the whole run rides.
    creditsRef.current = { ...FREE, balance: 10 }
    const screen = await mount({ ...TODAY, total: 22, lanes: [LANES[1], KANA_LANE] })
    expect(count(screen)).toBe('22')
    expect(fare(screen)).toBeNull()
    const lines = await services(screen)
    const free = lines.filter(l => l.querySelector('.tdy-line__tag'))
    expect(free).toHaveLength(1)
    expect(free[0].querySelector('.tdy-line__n').textContent).toBe('12')
    expect(screen.container.querySelector('.btn-depart').disabled).toBe(false)
  })

  it('counts only the paid reviews against the balance when it is short', async () => {
    // 22 due, 12 free, 4 credits: 16 ride, 6 vocab wait.
    creditsRef.current = { ...FREE, balance: 4 }
    const screen = await mount({ ...TODAY, total: 22, lanes: [LANES[1], KANA_LANE] })
    expect([...fare(screen).querySelectorAll('b')].map(b => b.textContent)).toEqual(['16', '6'])
  })

  it('keeps the gate open at zero under enforcement while anything rides free', async () => {
    creditsRef.current = { ...FREE, balance: 0, enforced: true }
    const screen = await mount({ ...TODAY, total: 22, lanes: [LANES[1], KANA_LANE] })
    // The 12 kana still go: the legend says they board.
    expect(fare(screen).querySelector('b').textContent).toBe('12')
    expect(screen.container.querySelector('.btn-depart').disabled).toBe(false)
  })

  it('closes again once the free line is switched off', async () => {
    creditsRef.current = { ...FREE, balance: 0, enforced: true }
    const screen = await mount({ ...TODAY, total: 22, lanes: [LANES[1], KANA_LANE] })
    const kana = (await services(screen)).find(l => l.querySelector('.tdy-line__tag'))
    kana.querySelector('.tdy-line__head').click()
    await new Promise(r => setTimeout(r, 60))
    expect(fare(screen).querySelector('b').textContent).toBe('0')
    expect(screen.container.querySelector('.btn-depart').disabled).toBe(true)
  })

  it('marks nothing free on a pass, where nothing costs anything', async () => {
    creditsRef.current = { ...FREE, balance: null, unlimited: true }
    const screen = await mount({ ...TODAY, total: 22, lanes: [LANES[1], KANA_LANE] })
    expect(await services(screen)).toHaveLength(2)
    expect(document.querySelector('.tdy-line__tag')).toBeNull()
    expect(fare(screen)).toBeNull()
  })

  it('holds the fare back until the balance is known', async () => {
    creditsRef.current = null
    const screen = await mount()
    expect(fare(screen)).toBeNull()
    expect(screen.container.querySelector('.btn-depart')).toBeTruthy()
  })
})

// ── 新規 — the day's ration on the gate (plan 098) ───────────────
// A lane's figure is what it puts in the run: the reviews it owes and
// the new cards the server drew for it against the pace. The new part
// is said on the line, counted in every sum, and priced like a review.
describe('GateCard — the ration', () => {
  it('counts a lane\'s new cards into its figure, the line and the run, and names them on the line', async () => {
    const rationed = { ...LANES[1], due: 0, new: 5 }
    const screen = await mount({ ...TODAY, total: 19, lanes: [LANES[0], rationed] })
    expect(count(screen)).toBe('19')
    const lines = await services(screen)
    const vocab = line(lines, 'Vocabulaire')
    expect(vocab.querySelector('.tdy-line__n').textContent).toBe('5')
    expect(vocab.querySelector('.tdy-line__sub').textContent).toContain('5 nouv.')
    // The kanji lane owes reviews only: no tag.
    const kanji = line(lines, 'Kanji')
    expect(kanji.querySelector('.tdy-line__sub').textContent).not.toContain('nouv.')
    expect(kanji.querySelector('.tdy-line__n').textContent).toBe('14')
  })

  it('names the figure "new" when the whole run is the day\'s ration', async () => {
    const { default: fr } = await import('../../locales/fr/index.js')
    const screen = await mount({ ...TODAY, total: 10, lanes: [{ ...KANA_LANE, due: 0, new: 10 }] })
    expect(count(screen)).toBe('10')
    expect(screen.container.querySelector('.tdy-dial__unit').textContent).toBe(fr.newUnit)
  })

  it('keeps "due" while any of the run is owed', async () => {
    const { default: fr } = await import('../../locales/fr/index.js')
    const screen = await mount({ ...TODAY, total: 13, lanes: [{ ...KANA_LANE, due: 3, new: 10 }] })
    expect(screen.container.querySelector('.tdy-dial__unit').textContent).toBe(fr.dueUnit)
  })

  it('a line switched off takes its new cards out of the run with it', async () => {
    const rationed = { ...LANES[1], due: 3, new: 4 }
    const screen = await mount({ ...TODAY, total: 21, lanes: [LANES[0], rationed] })
    expect(count(screen)).toBe('21')
    line(await services(screen), 'Vocabulaire').querySelector('.tdy-line__head').click()
    await new Promise(r => setTimeout(r, 50))
    expect(count(screen)).toBe('14')
  })
})
