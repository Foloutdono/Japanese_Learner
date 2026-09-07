import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, cleanup } from 'vitest-browser-react'
import { LangProvider } from '../../LangContext'
import '../../index.css'

// ── The balance, printed on the pass ─────────────────────────────
// The figure and its cap. The cap bounds the DAILY REFILL, not the
// wallet, so a balance above it has no honest denominator — and a new
// account's welcome (SIGNUP_BONUS, granted by core/credits.py on first
// read) is deliberately above it. Printed blindly that reads "200 / 50
// crédits", a fraction over its own maximum, on the very first pass a
// learner is handed.
//
// domain/credits' showsCap owns the rule and is unit-tested there;
// what these pin is that the components actually ASK it. That is the
// half a pure test cannot see: the rule shipped once with the call in
// place and the import missing.

vi.mock('../../lib/supabase', () => ({
  supabase: { auth: { getSession: async () => ({ data: { session: null } }) } },
}))
vi.mock('../../lib/api', () => ({ apiFetch: vi.fn(async () => ({ ok: false })) }))
// LangContext pulls the content maps over the network on mount.
globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })

const credits = await import('../../stores/credits')
const { BalanceLine } = await import('./BalanceLine')
const { CAP, SIGNUP_BONUS } = await import('../../domain/credits')

const settle = (ms = 60) => new Promise(r => setTimeout(r, ms))

async function lineFor(balance, { unlimited = false } = {}) {
  credits.seedCredits({
    balance, cap: CAP, dailyRefill: 30, refillAt: null,
    plan: unlimited ? 'pass' : 'free', unlimited, enforced: false,
  })
  const screen = await render(<LangProvider><BalanceLine /></LangProvider>)
  await settle()
  return screen.container.querySelector('.jour-line__validity').textContent
}

afterEach(async () => { await cleanup() })

describe('the balance line', () => {
  it('prints the cap while the balance is within it', async () => {
    expect(await lineFor(30)).toContain(`/ ${CAP}`)
    expect(await lineFor(CAP)).toContain(`/ ${CAP}`)
  })

  it('drops the cap above it, keeping the figure and its unit', async () => {
    const welcome = await lineFor(SIGNUP_BONUS)
    expect(welcome).not.toContain(`/ ${CAP}`)
    expect(welcome).not.toContain('/')
    expect(welcome).toContain(String(SIGNUP_BONUS))
    // The unit survives the cap's removal — "200 crédits", not "200".
    expect(welcome.trim().length).toBeGreaterThan(String(SIGNUP_BONUS).length)
  })

  it('prints ∞ and no cap at all on a pass', async () => {
    const pass = await lineFor(null, { unlimited: true })
    expect(pass).toContain('∞')
    expect(pass).not.toContain(String(CAP))
  })
})
