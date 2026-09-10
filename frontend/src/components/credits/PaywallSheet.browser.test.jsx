import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { LangProvider } from '../../LangContext'
import '../../index.css'

// ── 定期券 — the offer ─────────────────────────────────────────
// The sheet shown from all five doors and bought from none of them
// yet. Pinned here: that it prints what the pass CHANGES (the three
// limits, free beside pass, from the same constants the server
// enforces), that the interest tap is a real answer rather than a dead
// control, and that no price is ever printed — there isn't one yet,
// and a placeholder shown to a learner is a promise made by accident.

vi.mock('../../lib/supabase', () => ({
  supabase: { auth: { getSession: async () => ({ data: { session: null } }) } },
}))
const track = vi.fn()
vi.mock('../../lib/track', () => ({ track: (...a) => track(...a), EVENTS: {} }))

const credits = await import('../../stores/credits')
const { PaywallSheet } = await import('./PaywallSheet')
const { FREE_DECKS, FREE_CARDS, PASS_DECKS, PASS_CARDS, DAILY_REFILL } = await import('../../domain/credits')

const settle = (ms = 60) => new Promise(r => setTimeout(r, ms))
const mount = () => render(<LangProvider><PaywallSheet /></LangProvider>)

beforeEach(() => {
  credits.closePaywall()
  credits.seedCredits({ balance: 12, cap: 50, dailyRefill: DAILY_REFILL, refillAt: null,
                        plan: 'free', unlimited: false, enforced: true })
  track.mockClear()
})

describe('PaywallSheet', () => {
  it('stays out until a door opens it', async () => {
    await mount()
    await settle()
    expect(document.querySelector('.sheet')).toBeNull()
  })

  it('prints the three limits, free beside pass, and never a price', async () => {
    await mount()
    credits.openPaywall('balance')
    await settle()

    const rows = [...document.querySelectorAll('.pw-row')]
    expect(rows).toHaveLength(3)

    // Reviews: a free learner is not capped at a number, they are given
    // some back daily — so the free side is the refill, not a ceiling.
    expect(rows[0].querySelector('.pw-row__free').textContent).toContain(String(DAILY_REFILL))
    expect(rows[0].querySelector('.pw-row__pass').textContent).toBe('∞')

    // Decks and cards come from the enforced constants, so the offer
    // can never advertise a limit the server does not actually use.
    expect(rows[1].querySelector('.pw-row__free').textContent).toContain(String(FREE_DECKS))
    expect(rows[1].querySelector('.pw-row__pass').textContent).toContain(String(PASS_DECKS))
    expect(rows[2].querySelector('.pw-row__free').textContent).toContain(String(FREE_CARDS))
    expect(rows[2].querySelector('.pw-row__pass').textContent.replace(/[\s\u00a0\u202f,]/g, ''))
      .toContain(String(PASS_CARDS))

    // No price anywhere — there is no figure to print yet.
    expect(document.querySelector('.sheet').textContent).not.toMatch(/[€$£]|\/\s*mois|\/\s*month/)
  })

  it('answers the interest tap instead of doing nothing', async () => {
    await mount()
    credits.openPaywall('runout')
    await settle()

    const cta = document.querySelector('.pw__cta')
    expect(cta).not.toBeNull()
    track.mockClear()
    cta.click()
    await settle()

    // The button is replaced by the confirmation, in a live region so
    // it is announced rather than silently swapped.
    expect(document.querySelector('.pw__cta')).toBeNull()
    const thanks = document.querySelector('.pw__thanks')
    expect(thanks).not.toBeNull()
    expect(thanks.getAttribute('role')).toBe('status')
    // Name, door, and the deliberation time that rides with it — the
    // gap between seeing the pass and asking to be told about it.
    expect(track.mock.calls).toHaveLength(1)
    const [name, props] = track.mock.calls[0]
    expect(name).toBe('offer_intent')
    expect(props.where).toBe('runout')
    expect(Number.isInteger(props.ms)).toBe(true)
    expect(props.ms).toBeGreaterThanOrEqual(0)
  })

  it('closes without recording an intent when it is dismissed', async () => {
    await mount()
    credits.openPaywall('profile')
    await settle()
    track.mockClear()

    ;[...document.querySelectorAll('.sheet button')]
      .find(b => b.classList.contains('btn-secondary')).click()
    await settle()

    expect(document.querySelector('.sheet')).toBeNull()
    expect(track.mock.calls).toHaveLength(1)
    expect(track.mock.calls[0][0]).toBe('offer_dismiss')
    expect(track.mock.calls[0][1].where).toBe('profile')
    expect(track.mock.calls[0][1].ms).toBeGreaterThanOrEqual(0)
  })
})
