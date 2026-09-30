import { describe, it, expect, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { LangProvider } from '../LangContext'

// ── The boarding under reduced motion (plan 075) ───────────────
// The motion sheet's rule: with reduced motion on, only the rest state
// is drawn. No car moves between screens and the arrival signboard
// never mounts over the plan. The
// preference is read once at import, so it is stubbed before the flow
// is imported and this suite is its own file.
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
const { playVoice } = await import('../lib/audio')
const { ARRIVAL_CHIME_MS } = await import('../components/onboarding/TrainArrival')

const settle = (ms = 60) => new Promise(r => setTimeout(r, ms))
const stepOf = screen => screen.container.querySelector('.brd')?.dataset.step
async function click(screen, sel) {
  const el = screen.container.querySelector(sel)
  expect(el, sel).toBeTruthy()
  el.click()
  await settle(20)
}

describe('BoardingFlow under reduced motion', () => {
  it('draws rest states only: no pull, no signboard', async () => {
    const screen = await render(
      <LangProvider>
        <BoardingFlow session={{ access_token: 'tok' }} initialProfile={{ username: 'Tester' }} onComplete={vi.fn()} dryRun />
      </LangProvider>
    )
    await settle()
    await click(screen, '[data-action="continue"]')
    await settle(20)
    expect(screen.container.querySelector('.brd__car--out')).toBeNull()
    expect(screen.container.querySelector('.brd__car--in')).toBeNull()
    expect(stepOf(screen)).toBe('why')
    expect(getComputedStyle(screen.container.querySelector('.brd__q')).animationName).toBe('none')

    await click(screen, '[data-motive="studies"]')
    await click(screen, '[data-action="continue"]')
    await settle()
    await click(screen, '[data-kana="none"]')
    await settle()
    await click(screen, '[data-action="continue"]')   // the reveal
    await settle()
    await click(screen, '[data-action="continue"]')   // the goal
    await settle()
    await click(screen, '[data-action="continue"]')   // the lines
    await settle()
    await click(screen, '[data-action="continue"]')   // the rhythm
    await settle()
    await click(screen, '[data-action="continue"]')   // the hour
    await settle(20)

    // The plan at once and at rest: no Building since plan 168, and no
    // signboard over it.
    expect(stepOf(screen)).toBe('plan')
    expect(screen.container.querySelector('.brd__car--in')).toBeNull()
    expect(document.querySelector('.onb-arrival')).toBeNull()
    expect(screen.container.querySelector('.brd-ride')).not.toBeNull()
    // The sign is not drawn, but its chime is rung, once, on the beat
    // the sign would land on: a sound is not motion.
    const chimes = playVoice.mock.calls.filter(([event]) => event === 'platform-chime')
    expect(chimes).toEqual([['platform-chime', { after: ARRIVAL_CHIME_MS / 1000 }]])
  })
})
