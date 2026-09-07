import { describe, it, expect, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { LangProvider } from '../LangContext'

// ── The boarding under reduced motion (plan 075) ───────────────
// The motion sheet's rule: with reduced motion on, only the rest state
// is drawn. No car moves between screens, the building screen is
// already built, and the arrival signboard never mounts. The
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
}))
globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })

const { default: BoardingFlow } = await import('./BoardingFlow')

const settle = (ms = 60) => new Promise(r => setTimeout(r, ms))
const stepOf = screen => screen.container.querySelector('.brd')?.dataset.step
async function click(screen, sel) {
  const el = screen.container.querySelector(sel)
  expect(el, sel).toBeTruthy()
  el.click()
  await settle(20)
}

describe('BoardingFlow under reduced motion', () => {
  it('draws rest states only: no pull, a built journey, no signboard', async () => {
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
    await click(screen, '[data-action="continue"]')
    await settle()
    await click(screen, '[data-action="continue"]')
    await settle()
    await click(screen, '[data-action="continue"]')
    await settle()
    await click(screen, '[data-action="continue"]')
    await settle(20)

    // Built at once: every step ticked, the train at the end of the track.
    expect(stepOf(screen)).toBe('building')
    expect(screen.container.querySelectorAll('.brd-step--done')).toHaveLength(4)
    expect(screen.container.querySelector('.brd-build__train').style.left).toBe('100%')
    await settle(500)
    expect(stepOf(screen)).toBe('plan')
    expect(document.querySelector('.onb-arrival')).toBeNull()
    expect(getComputedStyle(screen.container.querySelector('.brd-chart__line--us')).animationName).toBe('none')
  })
})
