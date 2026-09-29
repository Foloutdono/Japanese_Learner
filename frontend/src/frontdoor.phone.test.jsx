import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { userEvent } from 'vitest/browser'
import { LangProvider } from './LangContext'
import './index.css'

// ── first contact on a phone: nothing of the desk's (plan 122) ─────
// frontdoor.desktop.test.jsx is the desk's side: Enter goes on through
// the boarding and boards from the Welcome, each Continue printing its
// key. On a phone none of it is listened for, printed or named -- the
// phone's first contact is exactly what it was.

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
  expect(document.activeElement).toBe(inCar('.brd-plate__field'))
  await enter()
  await settle()
  expect(stepOf()).toBe('why')
}

const pressEnter = () => document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }))

describe('the keys at first contact, on a phone (P8)', () => {
  it('prints and names no key on the Welcome, and Enter does not board', async () => {
    const onBoard = vi.fn()
    await render(<LangProvider><Welcome onBoard={onBoard} onSignIn={() => {}} /></LangProvider>)
    await settle(100)
    expect($('[aria-keyshortcuts]')).toBeNull()
    expect($('.desk-kbd')).toBeNull()
    pressEnter()
    await settle(60)
    expect(onBoard).not.toHaveBeenCalled()
  })

  it('goes on through the boarding by its buttons only', async () => {
    await board()
    expect($('[aria-keyshortcuts]')).toBeNull()
    await pastName()
    inCar('[data-motive="trip"]').click()
    await settle(60)
    document.activeElement?.blur?.()
    pressEnter()
    await settle()
    expect(stepOf()).toBe('why')
    expect($('.desk-kbd')).toBeNull()
  })
})

// ── P9: the boarding frame stays the phone's ──
describe('the boarding frame on a phone (P9)', () => {
  it('keeps the plain frame with no side, and goes from the hour to the plan', async () => {
    await board()
    expect($('main.brd').className).toBe('brd')
    expect($('.desk-brd__side')).toBeNull()
    expect($('.desk-brd__strip')).toBeNull()
    await pastName()
    const next = async () => { inCar('[data-action="continue"]').click(); await settle() }
    inCar('[data-motive="trip"]').click()
    await settle(40)
    await next()
    inCar('[data-kana="both"]').click()
    await settle()
    inCar('[data-level="N1"]').click()
    await settle(40)
    await next()        // → lines (N1: no goal)
    await next()        // → rhythm
    await next()        // → time
    expect(stepOf()).toBe('time')
    expect($('main.brd').className).toBe('brd')
    // No Building since plan 168: the plan arrives under its signboard,
    // an arrival screen with no head.
    await next()
    expect(stepOf()).toBe('plan')
    expect($('main.brd').className).toBe('brd brd--arrival')
    expect($('.brd__head')).toBeNull()
    expect($('.brd-build__track')).toBeNull()
  })
})

// ── P10: the front door stays the phone's ──
// The phone's own crossroads (plan 168), never the desk's; the sign-in
// drawn in the promise's place on the same screen.
describe('the front door on a phone (P10)', () => {
  it('draws the phone\'s crossroads, never the desk\'s, and the sign-in in the promise\'s place', async () => {
    const { unmount } = await render(<LangProvider><Welcome onBoard={() => {}} onSignIn={() => {}} /></LangProvider>)
    await settle(100)
    expect($('main').className).toBe('brd brd--welcome brd-front')
    expect($('[data-action="sign-in"]')).not.toBeNull()
    expect($('.brd-front__map')).not.toBeNull()
    expect($('.desk-front__map')).toBeNull()
    expect($('.auth-card')).toBeNull()
    await unmount()

    await render(<LangProvider><Welcome onBoard={() => {}} onSignIn={() => {}} onBack={() => {}} authMode="signup" /></LangProvider>)
    await settle(100)
    expect($('main').className).toBe('brd brd--welcome brd-front brd-front--auth')
    expect($('.desk-front__map')).toBeNull()
    expect($('.brd-front__promise')).toBeNull()
    expect($('.brd-signin .auth-card .seg')).not.toBeNull()
    expect($('.brd-signin .auth-foot')).not.toBeNull()
  })

  it('swaps the promise for the sign-in in place: Log in alone, and Board in the corner', async () => {
    const { default: App } = await import('./App')
    window.history.replaceState(null, '', '/')
    await render(<App />)
    await settle(300)
    $('[data-action="sign-in"]').click()
    await settle(120)
    expect($('main.brd-front--auth')).not.toBeNull()
    expect($('.brd-front__promise')).toBeNull()
    expect($('.brd-signin .seg')).toBeNull()
    expect($('[data-action="auth-submit"]')).not.toBeNull()
    expect($('[data-action="board-corner"]')).not.toBeNull()
    expect($('[data-action="welcome"]')).not.toBeNull()
  })
})

// ── P12: no digit picks on a phone ──
describe('the digits at first contact, on a phone (P12)', () => {
  it('picks nothing by a digit and prints none', async () => {
    await board()
    await pastName()
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: '1', bubbles: true, cancelable: true }))
    await settle(60)
    expect(inCar('[data-motive="studies"]').getAttribute('aria-pressed')).toBe('false')
    expect($('.desk-kbd')).toBeNull()
    expect($('[aria-keyshortcuts]')).toBeNull()
  })
})
