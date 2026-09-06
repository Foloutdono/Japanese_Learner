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

const TODAY = { total: 24, lanes: [], next_due: null }
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

describe('GateCard — the fare', () => {
  it('prints the fare against the balance, in gold', async () => {
    const screen = await mount()
    const fare = screen.container.querySelector('.gate-card__fare')
    expect(fare).toBeTruthy()
    const figures = [...fare.querySelectorAll('b')].map(b => b.textContent)
    expect(figures).toEqual(['24', '30'])
    expect(fare.querySelector('.fare-gold').textContent).toBe('30')
    expect(screen.container.querySelector('.gate-card__short')).toBeNull()
    expect(screen.container.querySelector('.btn-depart').disabled).toBe(false)
  })

  it('says how many ride and how many wait when the balance is short', async () => {
    creditsRef.current = { ...FREE, balance: 12 }
    const screen = await mount({ ...TODAY, total: 42 })
    const short = screen.container.querySelector('.gate-card__short')
    expect(short.textContent).toContain('12')
    expect(short.textContent).toContain('42')
    expect(short.textContent).toContain('30')
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

  it('prints ∞ and no notice on a pass', async () => {
    creditsRef.current = { ...FREE, balance: null, unlimited: true }
    const screen = await mount({ ...TODAY, total: 99 })
    expect(screen.container.querySelector('.fare-gold').textContent).toBe('∞')
    expect(screen.container.querySelector('.gate-card__short')).toBeNull()
  })

  it('prints no fare line before the balance is known', async () => {
    creditsRef.current = null
    const screen = await mount()
    expect(screen.container.querySelector('.gate-card__fare')).toBeNull()
    expect(screen.container.querySelector('.btn-depart')).toBeTruthy()
  })
})
