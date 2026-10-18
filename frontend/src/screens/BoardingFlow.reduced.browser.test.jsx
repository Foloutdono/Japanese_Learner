import { describe, it, expect, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { LangProvider } from '../LangContext'

// ── The boarding under reduced motion (plan 075; the card, plan 247) ──
// The motion sheet's rule: with reduced motion on, only the rest state
// is drawn. No car moves between screens, and the card arrives at rest.
// The preference is read once at import, so it is stubbed before the
// flow is imported and this suite is its own file.
window.matchMedia = query => ({
  matches: query.includes('prefers-reduced-motion'),
  media: query,
  addEventListener() {},
  removeEventListener() {},
  addListener() {},
  removeListener() {},
})

const apiJson = vi.fn(async () => ({}))
const apiJsonWithTimeout = vi.fn(async () => ({ onboardedAt: 'x' }))
const apiFetch = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({}) }))
vi.mock('../lib/api', () => ({
  api: p => p,
  apiFetch: (...a) => apiFetch(...a),
  apiJson: (...a) => apiJson(...a),
  apiJsonWithTimeout: (...a) => apiJsonWithTimeout(...a),
  apiUpload: vi.fn(),
  ApiError: class ApiError extends Error {},
}))
vi.mock('../lib/supabase', () => ({
  supabase: { auth: { getSession: async () => ({ data: { session: null } }) } },
}))
vi.mock('../lib/audio', async (importOriginal) => ({
  ...(await importOriginal()),
  playPlatformChime: vi.fn(),
  playVoice: vi.fn(),
}))
globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })

const { default: BoardingFlow } = await import('./BoardingFlow')

const settle = (ms = 60) => new Promise(r => setTimeout(r, ms))
const stepOf = screen => screen.container.querySelector('.brd')?.dataset.step
async function click(screen, sel) {
  // The next screen comes a frame after the tap (a transition, go()).
  await vi.waitFor(() => expect(screen.container.querySelector(sel), sel).toBeTruthy(), { timeout: 2000 })
  const el = screen.container.querySelector(sel)
  el.click()
  await settle(20)
}

describe('BoardingFlow under reduced motion', () => {
  it('draws rest states only: no pull, and the card at rest', async () => {
    const screen = await render(
      <LangProvider>
        <BoardingFlow session={{ access_token: 'tok' }} onComplete={vi.fn()} dryRun />
      </LangProvider>
    )
    await settle()
    await click(screen, '[data-kana="none"]')
    await settle(20)
    expect(screen.container.querySelector('.brd__car--out')).toBeNull()
    expect(screen.container.querySelector('.brd__car--in')).toBeNull()
    expect(stepOf(screen)).toBe('reveal')
    expect(getComputedStyle(screen.container.querySelector('.brd__q')).animationName).toBe('none')

    await click(screen, '[data-action="continue"]')
    await settle(20)
    // The name (plan 255) at once and at rest.
    expect(stepOf(screen)).toBe('name')
    expect(screen.container.querySelector('.brd__car--out')).toBeNull()
    expect(screen.container.querySelector('.brd__car--in')).toBeNull()
    await click(screen, '[data-action="name-skip"]')
    await settle(20)
    // The card at once and at rest.
    expect(stepOf(screen)).toBe('card')
    expect(screen.container.querySelector('.brd__car--in')).toBeNull()
    expect(screen.container.querySelector('.brd-card .pcard').dataset.side).toBe('back')
  })
})
