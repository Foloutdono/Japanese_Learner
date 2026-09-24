import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { userEvent } from 'vitest/browser'
import { LangProvider } from './LangContext'
import './index.css'

// ── 机 — first contact at a desk (plan 122) ─────────────────────────
// From the Welcome to the first card a computer drew a phone: a 640px
// column in an empty window, Continue on the window's floor, and no key
// answered -- some fifty presses and clicks on the novice's road. This
// file is the desk's side of it, one block per phase; the phone's is a
// block of deskfree.phone.test.jsx.
//
// The keys (P8): Enter goes on from anywhere in the live car, pressing
// the screen's own Continue, which prints the key. A field, an answer
// not yet picked, ‹ and a link keep their own Enter; an answer already
// picked, or one the pointer just pressed, does not -- Enter goes on
// with the pick as it stands. Nothing under a dialog, and no Esc.

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

describe('Enter at first contact (P8)', () => {
  it('prints the key on every Continue it presses, and goes on from the question', async () => {
    await board()
    const cap = () => inCar('.btn-depart')
    expect(cap().getAttribute('aria-keyshortcuts')).toBe('Enter')
    expect(cap().querySelector('.desk-kbd')).not.toBeNull()
    await pastName()
    // The question has the focus on a new screen: Enter goes on only
    // once there is an answer to go on with.
    expect(document.activeElement).toBe(inCar('.brd__q'))
    await enter()
    await settle()
    expect(stepOf()).toBe('why')
    await userEvent.click(inCar('[data-motive="trip"]'))
    await enter()
    await settle()
    expect(stepOf()).toBe('kana')
  })

  it('leaves an answer not yet picked its own Enter, and goes on from a picked one', async () => {
    await board()
    await pastName()
    inCar('[data-motive="fun"]').focus()
    await enter()
    await settle()
    expect(stepOf()).toBe('why')
    expect(inCar('[data-motive="fun"]').getAttribute('aria-pressed')).toBe('true')
    await enter()
    await settle()
    expect(stepOf()).toBe('kana')
  })

  it('goes on from a line the pointer clicked off, and leaves it off', async () => {
    await board()
    await pastName()
    await userEvent.click(inCar('[data-motive="trip"]'))
    await enter()
    await settle()
    await userEvent.click(inCar('[data-kana="both"]'))
    await settle()
    expect(stepOf()).toBe('level')
    await userEvent.click(inCar('[data-level="N1"]'))
    await enter()
    await settle()
    expect(stepOf()).toBe('lines')
    await userEvent.click(inCar('[data-line="kanji"]'))
    expect(inCar('[data-line="kanji"]').getAttribute('aria-pressed')).toBe('false')
    await enter()
    await settle()
    expect(stepOf()).toBe('rhythm')
    // Back, to see what was carried: the line stayed off.
    await userEvent.click($('.brd__back'))
    await settle()
    expect(inCar('[data-line="kanji"]').getAttribute('aria-pressed')).toBe('false')
    // A picked line reached by Tab: Space toggles it, Enter goes on.
    const vocab = inCar('[data-line="vocab"]')
    vocab.focus()
    await userEvent.keyboard(' ')
    expect(vocab.getAttribute('aria-pressed')).toBe('false')
    await userEvent.keyboard(' ')
    expect(vocab.getAttribute('aria-pressed')).toBe('true')
    await enter()
    await settle()
    expect(stepOf()).toBe('rhythm')
    // One Enter is one screen: the rhythm's lands on the hour, no further.
    await enter()
    await settle()
    expect(stepOf()).toBe('time')
  })

  it('does nothing under a dialog, and nothing on Esc', async () => {
    await board()
    await pastName()
    await userEvent.click(inCar('[data-motive="trip"]'))
    const modal = document.createElement('div')
    modal.setAttribute('aria-modal', 'true')
    modal.dataset.probeModal = ''
    document.body.appendChild(modal)
    await enter()
    await settle()
    expect(stepOf()).toBe('why')
    modal.remove()
    await userEvent.keyboard('{Escape}')
    await settle()
    expect(stepOf()).toBe('why')
  })
})

describe('the Welcome\'s Enter (P8)', () => {
  it('boards on Enter, the key printed on Board, and not while boarding', async () => {
    const onBoard = vi.fn()
    const { rerender } = await render(<LangProvider><Welcome onBoard={onBoard} onSignIn={() => {}} /></LangProvider>)
    await settle(100)
    const board = $('[data-action="board"]')
    expect(board.getAttribute('aria-keyshortcuts')).toBe('Enter')
    expect(board.querySelector('.desk-kbd')).not.toBeNull()
    await enter()
    expect(onBoard).toHaveBeenCalledTimes(1)
    await rerender(<LangProvider><Welcome onBoard={onBoard} onSignIn={() => {}} boarding /></LangProvider>)
    await enter()
    expect(onBoard).toHaveBeenCalledTimes(1)
  })
})
