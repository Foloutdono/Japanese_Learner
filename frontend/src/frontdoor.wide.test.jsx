import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { userEvent } from 'vitest/browser'
import { LangProvider } from './LangContext'
import './index.css'

// ── 机 — first contact on a wide window (plan 122) ─────────────────
// At 1440 the Welcome's band ran four cards a lane and was clipped mid
// window; the boarding's column stood in the middle of an empty one.
// The band now spans the area the sign-in's column leaves, faded at its
// ends, and its loop never shows a seam; the questions are centred in
// that area, and the plan stands at the board's width.

const apiJson = vi.hoisted(() => vi.fn())
const apiJsonWithTimeout = vi.hoisted(() => vi.fn())
const apiFetch = vi.hoisted(() => vi.fn(async () => ({ ok: true, status: 200, json: async () => ({}) })))
vi.mock('./lib/api', () => ({
  api: p => p,
  apiFetch: (...a) => apiFetch(...a),
  apiJson: (...a) => apiJson(...a),
  apiJsonWithTimeout: (...a) => apiJsonWithTimeout(...a),
  apiUpload: vi.fn(),
  ApiError: class ApiError extends Error {},
}))
vi.mock('./lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: async () => ({ data: { session: null } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
      signInWithPassword: vi.fn(async () => ({ error: null })),
      signUp: vi.fn(async () => ({ error: null })),
    },
  },
}))
vi.mock('./lib/platform', async o => ({
  ...(await o()),
  isNative: () => false,
  canNudge: () => false,
  requestNudgePermission: async () => false,
}))
vi.mock('./lib/audio', async o => ({ ...(await o()), playPlatformChime: vi.fn(), playClick: vi.fn(), playUi: vi.fn() }))
globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })

const { default: BoardingFlow } = await import('./screens/BoardingFlow')
const { default: Welcome } = await import('./components/boarding/Welcome')

const VOLUMES = {
  vocab: { N5: 667, N4: 634, N3: 1832, N2: 1796, N1: 3476 },
  kanji: { N5: 103, N4: 166, N3: 367, N2: 367, N1: 1232 },
  grammar: { N5: 71, N4: 71, N3: 71, N2: 71, N1: 71 },
  kana: 224,
}

const settle = (ms = 340) => new Promise(r => setTimeout(r, ms))
const $ = s => document.querySelector(s)
const live = () => $('.brd__car:not(.brd__car--out)')
const inCar = s => live()?.querySelector(s)
const stepOf = () => $('.brd')?.dataset.step
const enter = () => userEvent.keyboard('{Enter}')

beforeEach(() => {
  apiJson.mockReset()
  apiJson.mockImplementation(async path => (path === '/api/onboarding/volumes' ? VOLUMES : {}))
  apiJsonWithTimeout.mockReset()
  apiJsonWithTimeout.mockImplementation(async () => ({ jlptLevel: 'N5', dailyNewTarget: 10, onboardedAt: 'x' }))
  sessionStorage.clear()
})
afterEach(() => { document.querySelectorAll('[data-probe-modal]').forEach(n => n.remove()) })

async function board({ onComplete = vi.fn(), onExit = vi.fn() } = {}) {
  await render(
    <LangProvider>
      <BoardingFlow session={{ access_token: 'tok' }} initialProfile={{ username: 'Tester' }} onComplete={onComplete} onExit={onExit} />
    </LangProvider>
  )
  await settle(150)
}

/** Name → why, the name kept (no write), by Enter in the field. */
async function pastName() {
  expect(stepOf()).toBe('name')
  expect(document.activeElement).toBe(inCar('.brd-field'))
  await enter()
  await settle()
  expect(stepOf()).toBe('why')
}

const box = el => el.getBoundingClientRect()
const bodyW = () => document.body.getBoundingClientRect().width
const mid = r => (r.left + r.right) / 2

describe('first contact at 1440 (P10)', () => {
  it('runs the band across the whole area, and covers it to the loop\'s last frame', async () => {
    expect(window.innerWidth).toBe(1440)
    await render(<LangProvider><Welcome onBoard={() => {}} onSignIn={() => {}} /></LangProvider>)
    await settle(150)
    const roll = $('.brd-roll')
    expect(Math.round(box(roll).width)).toBe(Math.round(bodyW()) - 360)
    expect(getComputedStyle(roll).maskImage).toMatch(/linear-gradient/)
    for (const lane of document.querySelectorAll('.brd-roll__lane')) {
      // Hold the loop on its last frame: the lane must still reach the
      // band's right edge, or the seam shows as an empty strip.
      const secs = parseFloat(getComputedStyle(lane).animationDuration)
      lane.style.animationDelay = `-${secs * 0.999}s`
      lane.style.animationPlayState = 'paused'
    }
    await settle(60)
    for (const lane of document.querySelectorAll('.brd-roll__lane')) {
      expect(box(lane).left).toBeLessThan(box(roll).left)
      expect(box(lane).right).toBeGreaterThan(box(roll).right)
    }
  })

  it('centres the questions in the area the journey leaves', async () => {
    await board()
    await pastName()
    expect(Math.abs(mid(box(inCar('.brd__q'))) - (bodyW() - 360) / 2)).toBeLessThan(1.5)
    expect(Math.round(box($('.desk-brd__side')).right)).toBe(Math.round(bodyW()))
  })

  it('stands the plan at the board\'s width, centred in the window', async () => {
    await board()
    await pastName()
    inCar('[data-motive="trip"]').click()
    await settle(40)
    inCar('[data-action="continue"]').click()
    await settle()
    inCar('[data-kana="both"]').click()
    await settle()
    inCar('[data-level="N1"]').click()
    await settle(40)
    for (let i = 0; i < 4; i++) { inCar('[data-action="continue"]').click(); await settle() }
    expect(stepOf()).toBe('plan')
    const plan = box($('main.brd'))
    expect(Math.round(plan.width)).toBe(1040)
    expect(Math.abs(mid(plan) - bodyW() / 2)).toBeLessThan(1.5)
  })
})
