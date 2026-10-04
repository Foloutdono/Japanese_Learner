import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { userEvent } from 'vitest/browser'
import { LangProvider } from './LangContext'
import './index.css'

// ── 音 — first contact speaks the app's sound vocabulary ──────────
// The boarding was silent but for the 案内 sign's chime. Now each press
// makes the sound the rest of the app makes for its kind (lib/audio's
// chimes.js): the gate's departure on every Continue and on Board, the
// wood pick on an answer, the switch's two step on a line, the hour
// board's flaps on the hour, the click on ‹ and on the quiet links --
// once a press, never twice, since a flam reads as one sound hit harder.

const apiJson = vi.hoisted(() => vi.fn())
const apiJsonWithTimeout = vi.hoisted(() => vi.fn())
vi.mock('./lib/api', () => ({
  api: p => p,
  apiFetch: vi.fn(async () => ({ ok: true, status: 200, json: async () => ({}) })),
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
const sound = vi.hoisted(() => ({
  playUi: vi.fn(), playClick: vi.fn(), playToggle: vi.fn(), playBoardFlap: vi.fn(),
  playPlatformChime: vi.fn(), playFareTick: vi.fn(), playVoice: vi.fn(),
}))
vi.mock('./lib/audio', async o => ({ ...(await o()), ...sound }))
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
/** How often playUi was asked for `event`. */
const ui = event => sound.playUi.mock.calls.filter(([e]) => e === event).length
const quiet = () => Object.values(sound).forEach(fn => fn.mockClear())

beforeEach(() => {
  apiJson.mockReset()
  apiJson.mockImplementation(async path => (path === '/api/onboarding/volumes' ? VOLUMES : {}))
  apiJsonWithTimeout.mockReset()
  apiJsonWithTimeout.mockImplementation(async () => ({ jlptLevel: 'N5', dailyNewTarget: 10, onboardedAt: 'x' }))
  sessionStorage.clear()
  quiet()
})

async function board() {
  await render(
    <LangProvider>
      <BoardingFlow session={{ access_token: 'tok' }} initialProfile={{ username: 'Tester' }} onComplete={vi.fn()} onExit={vi.fn()} dryRun />
    </LangProvider>
  )
  await settle(150)
}

async function press(sel) {
  const el = inCar(sel) ?? $(sel)
  expect(el, sel).toBeTruthy()
  el.click()
  await settle()
}

/** Name → why → kana (both) → level N1 → lines → rhythm → time. */
async function toTime() {
  await press('[data-action="continue"]')
  await press('[data-motive="trip"]')
  await press('[data-action="continue"]')
  await press('[data-kana="both"]')
  await press('[data-level="N1"]')
  await press('[data-action="continue"]')   // → lines (N1: no goal)
  await press('[data-action="continue"]')   // → rhythm
  await press('[data-action="continue"]')   // → time
  expect(stepOf()).toBe('time')
}

describe('the Welcome', () => {
  it('sounds the departure once on Board, and the click on Log in', async () => {
    const onBoard = vi.fn()
    const onSignIn = vi.fn()
    await render(<LangProvider><Welcome onBoard={onBoard} onSignIn={onSignIn} /></LangProvider>)
    await settle(100)
    $('[data-action="board"]').click()
    expect(onBoard).toHaveBeenCalledTimes(1)
    expect(ui('click-screen-selection')).toBe(1)
    $('[data-action="sign-in"]').click()
    expect(onSignIn).toHaveBeenCalledTimes(1)
    expect(sound.playClick).toHaveBeenCalledTimes(1)
  })
})

describe('the questions', () => {
  it('sounds the gate on Continue and a pick on an answer, one sound a press', async () => {
    await board()
    await press('[data-action="continue"]')
    expect(stepOf()).toBe('why')
    expect(ui('click-screen-selection')).toBe(1)
    expect(ui('click-mode-selection')).toBe(0)

    quiet()
    await press('[data-motive="trip"]')
    expect(ui('click-mode-selection')).toBe(1)
    expect(ui('click-screen-selection')).toBe(0)
  })

  it('sounds the departure when the kana answer goes on by itself, and the click on ‹', async () => {
    await board()
    await press('[data-action="continue"]')
    await press('[data-motive="trip"]')
    await press('[data-action="continue"]')
    expect(stepOf()).toBe('kana')

    quiet()
    await press('[data-kana="both"]')
    expect(stepOf()).toBe('level')
    expect(ui('click-screen-selection')).toBe(1)
    expect(ui('click-mode-selection')).toBe(0)

    quiet()
    await press('.brd__back')
    expect(stepOf()).toBe('kana')
    expect(sound.playClick).toHaveBeenCalledTimes(1)
    expect(sound.playUi).not.toHaveBeenCalled()
  })

  it('throws a line with the switch’s two step', async () => {
    await board()
    await press('[data-action="continue"]')
    await press('[data-motive="trip"]')
    await press('[data-action="continue"]')
    await press('[data-kana="both"]')
    await press('[data-level="N1"]')
    await press('[data-action="continue"]')
    expect(stepOf()).toBe('lines')

    quiet()
    await press('[data-line="grammar"]')
    expect(sound.playToggle).toHaveBeenCalledTimes(1)
    expect(sound.playUi).not.toHaveBeenCalled()
  })

  it('turns the hour board’s flaps each time the hour moves, and only then', async () => {
    await board()
    await toTime()

    quiet()
    await press('.brd-clock__step')              // the first ▲: an hour later
    expect(sound.playBoardFlap).toHaveBeenCalledTimes(1)
    await press('[data-hour="pm"]')              // a service: the board turns to it
    expect(sound.playBoardFlap).toHaveBeenCalledTimes(2)
    await press('[data-hour="pm"]')              // the hour it already shows
    expect(sound.playBoardFlap).toHaveBeenCalledTimes(2)
    expect(sound.playUi).not.toHaveBeenCalled()
  })
})

describe('the name', () => {
  it('sounds the gate once when Enter in the field goes on', async () => {
    await board()
    expect(document.activeElement).toBe(inCar('.brd-plate__field'))
    await userEvent.keyboard('{Enter}')
    await settle()
    expect(stepOf()).toBe('why')
    expect(ui('click-screen-selection')).toBe(1)
  })
})

describe('the arrival', () => {
  it('lands the welcome’s coin once on the card, as its count starts', async () => {
    await board()
    await toTime()
    await press('[data-action="continue"]')   // → the plan, under its sign
    await settle(1200)                        // the sign steps aside
    expect(stepOf()).toBe('plan')
    await press('[data-action="continue"]')   // → the pass
    expect(stepOf()).toBe('pass')
    expect(sound.playFareTick).not.toHaveBeenCalled()
    // The card is issued face up and turns over by itself (plan 172):
    // the count starts on its back, and the coin with it.
    await settle(500)
    expect(sound.playFareTick).not.toHaveBeenCalled()
    await settle(1700)
    expect(sound.playFareTick).toHaveBeenCalledTimes(1)
    await settle(600)
    expect(sound.playFareTick).toHaveBeenCalledTimes(1)
  })
})
