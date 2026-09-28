import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { userEvent } from 'vitest/browser'
import { LangProvider } from './LangContext'
import './index.css'

// ── 机 — first contact on a wide window (plans 122, 140) ───────────
// At 1440 the Welcome's band ran four cards a lane and was clipped mid
// window; the boarding's column stood in the middle of an empty one.
// The band spans the paper the sign-in's column leaves, faded at its
// ends, and its loop never shows a seam. Since plan 140 that column is
// on the left and holds the boarding's line; the questions are centred
// in the paper beside it, the level list is one line of six stations,
// and the plan stands at two columns' width.

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
const cy = r => (r.top + r.bottom) / 2

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

  it('stands the question in the canvas\'s top-left corner, the answers centred under it', async () => {
    await board()
    await pastName()
    // Once the question's car has landed (the desk's pull, plan 155).
    await settle(600)
    // No column (plan 161): the paper is the window's, and the canvas
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
