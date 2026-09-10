import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { MemoryRouter } from 'react-router-dom'
import { LangProvider } from '../../LangContext'
import '../../index.css'

// ── The fare gate prices the run (plan 069) ───────────────────
// Fare · n credits · Balance on every gate with a balance; the short
// notice when the balance is under the fare; the gate closed at zero
// ONLY under enforcement — shadow mode prints the line and lets the
// train leave.

const creditsRef = { current: null }
vi.mock('../../stores/credits', () => ({
  useCredits: () => creditsRef.current,
}))
vi.mock('../../stores/departure', () => ({ beginDeparture: vi.fn() }))
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
const FREE = { balance: 30, cap: 50, dailyRefill: 30, refillAt: '2026-09-07T22:00:00+00:00', plan: 'free', unlimited: false, enforced: false }

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

// A fare line stood over the notice — Fare · n credits · a hairline ·
// Balance · the figure in gold — printing the count the card already
// sets in figures three times the size, beside a balance the HUD's
// pass carries a thumb's width up the same screen. Owner's call: the
// gate says nothing about credits while the balance covers the run.
describe('GateCard — the fare', () => {
  it('says nothing about credits while the balance covers the run', async () => {
    const screen = await mount()
    expect(screen.container.querySelector('.gate-card__fare')).toBeNull()
    expect(screen.container.querySelector('.gate-card__short')).toBeNull()
    // The count is still the card's own figure, and the gate is open.
    expect(screen.container.querySelector('.gate-card__count').textContent).toBe('24')
    expect(screen.container.querySelector('.btn-depart').disabled).toBe(false)
  })

  // It used to say the subtraction too — "12 of 42 ride today, 30 wait
  // for tomorrow's refill" — which is a sentence and a half for two
  // numbers that do not match. Owner's call: the two numbers.
  it('says how much of the fare the balance covers when it is short', async () => {
    creditsRef.current = { ...FREE, balance: 12 }
    // The fare is the chosen lanes' due (plan 070), so the lanes carry
    // the 42, not `total`.
    const screen = await mount({ ...TODAY, total: 42, lanes: [{ ...LANES[0], due: 30 }, { ...LANES[1], due: 12 }] })
    const short = screen.container.querySelector('.gate-card__short')
    expect(short.textContent).toContain('12')
    expect(short.textContent).toContain('42')
    // Not the remainder: it is 42 minus 12, and the line is shorter
    // without it.
    expect(short.textContent).not.toContain('30')
    expect(screen.container.querySelector('.btn-depart').disabled).toBe(false)
  })

  // One render per test: vitest-browser-react cleans up between
  // tests, and a manual unmount() mid-test detaches the next render.
  it('at zero names the refill and keeps the gate open in shadow mode', async () => {
    creditsRef.current = { ...FREE, balance: 0 }
    const screen = await mount()
    expect(screen.container.querySelector('.gate-card__short').textContent).toContain('+30')
    expect(screen.container.querySelector('.btn-depart').disabled).toBe(false)
  })

  it('closes the gate at zero only under enforcement', async () => {
    creditsRef.current = { ...FREE, balance: 0, enforced: true }
    const screen = await mount()
    const gate = screen.container.querySelector('.btn-depart')
    expect(gate.disabled).toBe(true)
    expect(getComputedStyle(gate).opacity).toBe('0.45')
  })

  it('prints no notice on a pass', async () => {
    creditsRef.current = { ...FREE, balance: null, unlimited: true }
    const screen = await mount()
    expect(screen.container.querySelector('.gate-card__short')).toBeNull()
    expect(screen.container.querySelector('.btn-depart').disabled).toBe(false)
  })

  it('a lane switched off comes out of the count, and the notice follows (plan 070)', async () => {
    creditsRef.current = { ...FREE, balance: 12 }
    const screen = await mount()
    expect(screen.container.querySelector('.gate-card__short')).toBeTruthy()
    // Grouped by line, vocab before kanji: pick the kanji lane by name.
    const kanji = [...screen.container.querySelectorAll('.lane')].find(l => l.textContent.includes('N4'))
    expect(kanji.getAttribute('aria-pressed')).toBe('true')
    kanji.click()
    await new Promise(r => setTimeout(r, 60))
    expect(kanji.getAttribute('aria-pressed')).toBe('false')
    expect(screen.container.querySelector('.gate-card__count').textContent).toBe('10')
    // Ten ride on twelve credits: nothing waits any more.
    expect(screen.container.querySelector('.gate-card__short')).toBeNull()
  })

  it('marks a free lane and leaves it out of what the balance covers', async () => {
    // 22 due, 12 of them free, 10 credits: the whole run rides.
    creditsRef.current = { ...FREE, balance: 10 }
    const screen = await mount({ ...TODAY, total: 22, lanes: [LANES[1], KANA_LANE] })
    expect(screen.container.querySelector('.gate-card__count').textContent).toBe('22')
    expect(screen.container.querySelector('.gate-card__short')).toBeNull()
    const free = [...screen.container.querySelectorAll('.lane')]
      .filter(l => l.querySelector('.lane__free'))
    expect(free).toHaveLength(1)
    expect(free[0].textContent).toContain('12')
    expect(screen.container.querySelector('.btn-depart').disabled).toBe(false)
  })

  it('counts only the paid reviews against the balance when it is short', async () => {
    // 22 due, 12 free, 4 credits: 16 ride, 6 vocab wait.
    creditsRef.current = { ...FREE, balance: 4 }
    const screen = await mount({ ...TODAY, total: 22, lanes: [LANES[1], KANA_LANE] })
    const short = screen.container.querySelector('.gate-card__short')
    expect(short.textContent).toContain('16')
    expect(short.textContent).toContain('22')
  })

  it('keeps the gate open at zero under enforcement while anything rides free', async () => {
    creditsRef.current = { ...FREE, balance: 0, enforced: true }
    const screen = await mount({ ...TODAY, total: 22, lanes: [LANES[1], KANA_LANE] })
    // The 12 kana still go; the notice says so rather than "no credits
    // left" over a train that is about to leave.
    const short = screen.container.querySelector('.gate-card__short')
    expect(short.textContent).toContain('12')
    expect(short.textContent).not.toContain('+30')
    expect(screen.container.querySelector('.btn-depart').disabled).toBe(false)
  })

  it('closes again once the free lane is switched off', async () => {
    creditsRef.current = { ...FREE, balance: 0, enforced: true }
    const screen = await mount({ ...TODAY, total: 22, lanes: [LANES[1], KANA_LANE] })
    const kana = [...screen.container.querySelectorAll('.lane')].find(l => l.querySelector('.lane__free'))
    kana.click()
    await new Promise(r => setTimeout(r, 60))
    expect(screen.container.querySelector('.gate-card__short').textContent).toContain('+30')
    expect(screen.container.querySelector('.btn-depart').disabled).toBe(true)
  })

  it('marks nothing free on a pass, where nothing costs anything', async () => {
    creditsRef.current = { ...FREE, balance: null, unlimited: true }
    const screen = await mount({ ...TODAY, total: 22, lanes: [LANES[1], KANA_LANE] })
    expect(screen.container.querySelector('.lane__free')).toBeNull()
    expect(screen.container.querySelector('.gate-card__short')).toBeNull()
  })

  it('holds the notice back until the balance is known', async () => {
    creditsRef.current = null
    const screen = await mount()
    expect(screen.container.querySelector('.gate-card__short')).toBeNull()
    expect(screen.container.querySelector('.btn-depart')).toBeTruthy()
  })
})
