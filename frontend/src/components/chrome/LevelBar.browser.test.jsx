import { describe, it, expect, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { LangProvider } from '../../LangContext'
import '../../index.css'

// ── 運賃表示 — the level bar on a run (2026-09) ──────────────
// What a run keeps of the HUD: the level, the pass's gold climbing
// toward the next one, the XP figure — and the fare rising off it,
// with the span just climbed lit, when the running total moves.

vi.mock('../../lib/api', () => ({ apiFetch: vi.fn(), apiJson: vi.fn(), ApiError: class ApiError extends Error {} }))
vi.mock('../../lib/supabase', () => ({
  supabase: { auth: { getSession: async () => ({ data: { session: { access_token: 'tok' } } }) } },
}))
globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })

const { LevelBar } = await import('./LevelBar')
const { seedSummary, applyXpGain } = await import('../../stores/profileSummary')

const settle = (ms = 40) => new Promise(r => setTimeout(r, ms))

describe('the level bar', () => {
  it('prints the level and the XP into the level, and fills the track by it', async () => {
    seedSummary({ username: 'Aiko', level: 12, xp: 1200, xpPrevLevel: 1000, xpForNext: 1500 })
    const screen = await render(<LangProvider><LevelBar /></LangProvider>)
    await settle()
    const bar = screen.container.querySelector('.lvlbar')
    expect(bar.getAttribute('role')).toBe('progressbar')
    expect(bar.getAttribute('aria-valuenow')).toBe('200')
    expect(bar.getAttribute('aria-valuemax')).toBe('500')
    expect(screen.container.querySelector('.lvlbar__level-num').textContent).toBe('12')
    expect(screen.container.querySelector('.lvlbar__xp').textContent).toMatch(/200 \/ 500\s*xp/)
    // 200 of 500 into the level: two fifths of the track, in gold.
    expect(screen.container.querySelector('.lvlbar__fill').style.width).toBe('40%')
    expect(screen.container.querySelector('.lvlbar__gain')).toBeNull()
  })

  it('lights the span it climbed and raises the fare off the figure on a gain', async () => {
    seedSummary({ username: 'Aiko', level: 12, xp: 1200, xpPrevLevel: 1000, xpForNext: 1500 })
    const screen = await render(<LangProvider><LevelBar /></LangProvider>)
    await settle()
    // The one running total every level bar reads, moved the way a
    // review (useReviewGates) or a practice answer (usePracticeXp) does.
    applyXpGain({ amount: 50 })
    await settle()
    expect(screen.container.querySelector('.lvlbar__fill').style.width).toBe('50%')
    const gain = screen.container.querySelector('.lvlbar__gain')
    expect(gain).not.toBeNull()
    expect(gain.style.left).toBe('40%')
    expect(gain.style.width).toBe('10%')
    const fare = screen.container.querySelector('.hud-fare--bar')
    expect(fare.textContent).toBe('+50xp')
  })

  it('holds its height before the summary lands, so the docks above it never move', async () => {
    seedSummary(null)
    const screen = await render(<LangProvider><LevelBar /></LangProvider>)
    const bar = screen.container.querySelector('.lvlbar')
    // --lvlbar-h over a zero inset (chromium), border included.
    expect(bar.getBoundingClientRect().height).toBe(36)
    expect(screen.container.querySelector('.lvlbar__fill').style.width).toBe('0%')
  })
})
