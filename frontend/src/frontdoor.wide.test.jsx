import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { userEvent } from 'vitest/browser'
import { LangProvider } from './LangContext'
import './index.css'

// ── 机 — first contact on a wide window (plans 122, 140, 163) ──────
// At 1440 the Welcome's band ran four cards a lane and was clipped mid
// window; the boarding's column stood in the middle of an empty one.
// Since plan 163 there is no column: the Welcome is the crossroads on
// the canvas (--desk-board-w) centred in the window, its lines at the
// drawing's length, and the boarding's questions stand in the canvas's
// corners and draw their answers across it.

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
// A step's answers rise into place as its car arrives (brd-in: 6px over
// 360ms, staggered up to 400ms), and a fixed wait can land inside that
// on a loaded runner: the climb's rings were measured 69px apart instead
// of 70. A test that measures them waits for them to land.
// (Short ones only: a looping animation's `finished` never settles.)
const landed = () => Promise.all(document.getAnimations()
  .filter(a => {
    const end = a.effect?.getComputedTiming().endTime
    return Number.isFinite(end) && end <= 2000
  })
  .map(a => a.finished.catch(() => {})))
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
const cy = r => (r.top + r.bottom) / 2

describe('first contact at 1440 (P10)', () => {
  it('draws the crossroads on the canvas, its lines at the drawing\'s length', async () => {
    expect(window.innerWidth).toBe(1440)
    await render(<LangProvider><Welcome onBoard={() => {}} onSignIn={() => {}} /></LangProvider>)
    // Once the way in's entrance has landed.
    await settle(800)
    const gutter = (bodyW() - 1240) / 2
    const board = box($('[data-action="board"]'))
    // The way in at the canvas's left edge, the corner at its right.
    expect(Math.round(board.left)).toBe(Math.round(gutter))
    expect(Math.round(bodyW() - box($('[data-action="sign-in"]')).right)).toBe(Math.round(gutter))
    // The lines at their longest: the kanji's sign 240px right of the
    // hub, the kana's 240px over it.
    const hub = box($('.desk-front__hub'))
    const sign = line => box($(`.desk-front__stn[data-line="${line}"] .desk-front__sign`))
    expect(Math.round(mid(sign('kanji')) - mid(hub))).toBe(240)
    expect(Math.round(cy(hub) - cy(sign('kana')))).toBe(240)
    // Every name inside the canvas, right of the way in.
    for (const n of document.querySelectorAll('.desk-front__name')) {
      expect(box(n).right).toBeLessThanOrEqual(bodyW() - gutter + 1)
      expect(box(n).left).toBeGreaterThan(board.right)
    }
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth)
  })

  it('stands the question in the canvas\'s top-left corner, the answers centred under it', async () => {
    await board()
    await pastName()
    // Once the question's car has landed (the desk's pull, plan 155).
    await settle(600)
    // No column (plan 163): the paper is the window's, and the canvas
    // (--desk-board-w) centred in it sets the corner.
    expect($('.desk-brd__side')).toBeNull()
    const gutter = (bodyW() - 1240) / 2
    expect(Math.round(box(inCar('.brd__q')).left)).toBe(Math.round(gutter))
    expect(Math.round(box($('.desk-brd__strip')).left)).toBe(Math.round(gutter))
    expect(Math.round(bodyW() - box(inCar('[data-action="continue"]')).right)).toBe(Math.round(gutter))
    // A ticket's width here: the floor has the room the strip leaves.
    expect(Math.round(box(inCar('[data-action="continue"]')).width)).toBe(360)
    // The six roads across the canvas, at the drawing's height where the
    // window has it: the top and the bottom rings' centres 440px apart,
    // and the diagonals at 45 degrees out of the hub.
    inCar('[data-motive="trip"]').click()
    await settle(900)
    const roads = inCar('.desk-brd__roads')
    expect(Math.round(box(roads).width)).toBe(1240)
    const ring = m => box(inCar(`[data-motive="${m}"] .desk-brd__ring`))
    const hub = box(roads.querySelector('.desk-brd__hub'))
    expect(Math.round(cy(ring('live')) - cy(ring('fun')))).toBe(440)
    expect(Math.abs((mid(hub) - mid(ring('studies'))) - (cy(hub) - cy(ring('studies'))))).toBeLessThan(2)
  })

  it('draws the level list as the line climbing across the canvas at 45 degrees', async () => {
    await board()
    await pastName()
    inCar('[data-motive="trip"]').click()
    await settle(40)
    inCar('[data-action="continue"]').click()
    await settle()
    inCar('[data-kana="both"]').click()
    await settle(900)
    await landed()
    expect(stepOf()).toBe('level')
    const climb = inCar('.desk-brd__climb')
    expect(Math.round(box(climb).width)).toBe(1240)
    const rings = [...climb.querySelectorAll('.desk-brd__stop-ring')].map(box)
    expect(rings).toHaveLength(6)
    // The drawing's climb where the window has the height: 70px a level,
    // and a pitch past the widest name.
    for (let i = 1; i < rings.length; i++) {
      expect(Math.round(cy(rings[i - 1]) - cy(rings[i]))).toBe(70)
      expect(mid(rings[i]) - mid(rings[i - 1])).toBeGreaterThan(176)
    }
  })

  it('draws the day\'s arc at the drawing\'s span, the board in its bowl', async () => {
    await board()
    await pastName()
    inCar('[data-motive="trip"]').click()
    await settle(40)
    inCar('[data-action="continue"]').click()
    await settle()
    inCar('[data-kana="both"]').click()
    await settle()
    inCar('[data-level="N3"]').click()
    await settle(40)
    for (let i = 0; i < 4; i++) { inCar('[data-action="continue"]').click(); await settle() }
    expect(stepOf()).toBe('time')
    await settle(900)
    const hours = [...inCar('.desk-brd__sky-map').querySelectorAll('.desk-brd__hour')]
    const at = label => box(hours.find(h => h.textContent === label))
    // Six in the morning to midnight across 1080px of sky.
    expect(Math.round(mid(at('24')) - mid(at('06')))).toBe(1080)
    // The board under the crown, clear of the morning's and the night's names.
    const sheet = box(inCar('.desk-brd__sky-board'))
    expect(Math.abs(mid(sheet) - mid(box(inCar('.desk-brd__sky'))))).toBeLessThan(1)
    expect(sheet.left).toBeGreaterThan(box(inCar('[data-hour="am"] .desk-brd__hour-lab')).right)
    expect(sheet.right).toBeLessThan(box(inCar('[data-hour="pm"] .desk-brd__hour-lab')).left)
    expect(sheet.top).toBeGreaterThan(box(inCar('[data-hour="noon"]')).bottom)
  })

  it('stands the plan across the canvas, centred in the window', async () => {
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
    await settle(600)
    // The ride drawn to scale across the canvas.
    const plan = box(inCar('.brd__stage'))
    expect(Math.round(plan.width)).toBe(1240)
    expect(Math.abs(mid(plan) - bodyW() / 2)).toBeLessThan(1.5)
    const route = box(inCar('.desk-brd__route'))
    expect(Math.round(route.width)).toBe(1240)
  })
})
