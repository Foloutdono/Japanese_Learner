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
const refusal = vi.hoisted(() => ({ current: null }))
vi.mock('./lib/authRedirect', async o => ({ ...(await o()), authRedirectError: () => refusal.current }))
globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })

const { default: BoardingFlow } = await import('./screens/BoardingFlow')
const { default: Welcome } = await import('./components/boarding/Welcome')
const { default: App } = await import('./App')
const { default: en } = await import('./locales/en/index.js')
const { default: fr } = await import('./locales/fr/index.js')

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
afterEach(() => {
  document.querySelectorAll('[data-probe-modal]').forEach(n => n.remove())
  refusal.current = null
})

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

// ── P9 — the boarding frame ──
// A run's frame: the question centred in what a column on the right
// edge leaves, the column holding the journey the answers build. The
// answers and Continue at a column's width, the three as one block; the
// arrival screens with the window to themselves; no Building.
const box = el => el.getBoundingClientRect()
const row = key => $(`.desk-brd__side [data-build="${key}"]`)
const stateOf = key => row(key)?.className.match(/brd-step--(\w+)/)?.[1]
const valueOf = key => row(key)?.querySelector('.brd-step__val')?.textContent ?? null
async function pick(sel) { inCar(sel).click(); await settle(40) }
async function next() { inCar('[data-action="continue"]').click(); await settle() }

/** From the name to the level list, kana both. */
async function toLevel() {
  await pastName()
  await pick('[data-motive="trip"]')
  await next()
  await pick('[data-kana="both"]')
  await settle()
  expect(stepOf()).toBe('level')
}
/** From the level list, N3, to the hour. */
async function toTime() {
  await pick('[data-level="N3"]')
  await next()          // → goal
  await next()          // → lines
  await next()          // → rhythm
  await next()          // → time
  expect(stepOf()).toBe('time')
}
const fits = el => el.scrollHeight <= el.clientHeight + 1

describe('the boarding frame on the desk (P9)', () => {
  it('stands the journey on the right edge beside the questions, and nowhere after them', async () => {
    await board()
    expect($('main.brd').className).toBe('brd desk-brd desk-brd--side')
    const side = $('.desk-brd__side')
    expect(Math.round(box(side).width)).toBe(360)
    expect(Math.round(box(side).right)).toBe(Math.round(document.body.getBoundingClientRect().width))
    expect(Math.round(box(side).height)).toBe(window.innerHeight)
    expect([...side.querySelectorAll('.brd-step')].map(r => r.dataset.build)).toEqual(['goal', 'lines', 'ride', 'projection'])
    await toLevel()
    await toTime()
    expect($('.desk-brd__side')).not.toBeNull()
    await next()
    // No Building: the hour goes straight to the plan, under the arrival.
    expect(stepOf()).toBe('plan')
    expect($('.brd-build__track')).toBeNull()
    expect($('.desk-brd__side')).toBeNull()
    expect($('main.brd').className).toBe('brd desk-brd')
    expect($('.onb-arrival')).not.toBeNull()
    // The key that skips the arrival is the arrival's alone.
    await enter()
    await settle()
    expect(stepOf()).toBe('plan')
    expect($('.onb-arrival')).toBeNull()
    await enter()
    await settle()
    expect(stepOf()).toBe('pass')
    expect($('.desk-brd__side')).toBeNull()
    expect(Math.round(box($('.brd-issue')).width)).toBe(360)
  })

  it('fills the rows as the answers come, and prices a level before Continue', async () => {
    await board()
    expect(['goal', 'lines', 'ride', 'projection'].map(stateOf)).toEqual(['next', 'next', 'next', 'next'])
    expect(valueOf('projection')).toBeNull()
    await toLevel()
    expect(stateOf('goal')).toBe('now')
    expect(valueOf('goal')).toBeNull()
    await pick('[data-level="N3"]')
    expect(valueOf('goal')).toBe('N3 → N2')
    const priced = valueOf('projection')
    expect(priced).toMatch(/\d{4}/)
    await next()
    expect(stepOf()).toBe('goal')
    // Continue committed what the side priced.
    expect(inCar('[data-goal="N2"]').getAttribute('aria-pressed')).toBe('true')
    expect(valueOf('projection')).toBe(priced)
    await pick('[data-goal="N1"]')
    expect(valueOf('goal')).toBe('N3 → N1')
    expect(valueOf('projection')).not.toBe(priced)
    await next()
    expect(stateOf('goal')).toBe('done')
    expect(stateOf('lines')).toBe('now')
    expect(valueOf('lines')).toMatch(/·/)
    await next()
    expect(stateOf('lines')).toBe('done')
    expect(stateOf('ride')).toBe('now')
    const before = valueOf('projection')
    await pick('[data-rhythm="20"]')
    expect(valueOf('ride')).toBe('20 min')
    expect(valueOf('projection')).not.toBe(before)
    await next()
    expect(valueOf('ride')).toMatch(/^20 min · \d\d:\d\d$/)
  })

  it('prices nothing until the volumes answer', async () => {
    let release
    apiJson.mockImplementation(path => (path === '/api/onboarding/volumes'
      ? new Promise(r => { release = () => r(VOLUMES) })
      : Promise.resolve({})))
    await board()
    await toLevel()
    await pick('[data-level="N3"]')
    expect(valueOf('goal')).toBe('N3 → N2')
    expect(valueOf('projection')).toBeNull()
    release()
    await settle(100)
    expect(valueOf('projection')).toMatch(/\d{4}/)
  })

  it('sets the answers and the way on at a column\'s width, one block with the question', async () => {
    await board()
    // The name keeps the car's width, for a name at the display size.
    expect(Math.round(box(inCar('.brd-field')).width)).toBe(608)
    await pastName()
    await pick('[data-motive="trip"]')
    // Measured once the answers' entrance has landed (brd-in, 6px).
    await settle(900)
    const q = box(inCar('.brd__q'))
    const stage = box(inCar('.brd__stage'))
    const foot = box(inCar('.brd__foot'))
    expect(Math.round(stage.width)).toBe(360)
    expect(Math.round(foot.width)).toBe(360)
    const mid = r => (r.left + r.right) / 2
    expect(Math.abs(mid(stage) - mid(q))).toBeLessThan(1.5)
    expect(Math.abs(mid(foot) - mid(q))).toBeLessThan(1.5)
    // Continue --sp-8 under the last answer, not on the window's floor.
    const last = box([...inCar('.brd__stage').querySelectorAll('.brd-opt')].at(-1))
    expect(Math.round(foot.top - last.bottom)).toBe(44)
    // Centred in what the side leaves.
    const room = window.innerWidth - 360
    expect(Math.abs(mid(q) - room / 2)).toBeLessThan(12)
  })

  it('fits every question in a laptop\'s window, in French, with no scroll', async () => {
    await board()
    await pastName()
    await pick('[data-motive="trip"]')
    const check = async () => {
      await settle(900)
      expect(fits(inCar('.brd__body')), stepOf()).toBe(true)
      expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth)
      expect(box(inCar('.brd__foot')).bottom).toBeLessThanOrEqual(window.innerHeight)
      for (const r of document.querySelectorAll('.desk-brd__side .brd-step')) expect(r.scrollWidth).toBeLessThanOrEqual(r.clientWidth)
    }
    await check()
    await next()
    await pick('[data-kana="both"]')
    await settle()
    await check()       // level
    await pick('[data-level="N5"]')
    await next()
    await check()       // goal
    await next()
    await check()       // lines, all three in the side
    await next()
    await check()       // rhythm
    await next()
    await check()       // time
  })

  it('draws the plan\'s chart 1:1 beside its promises, with no scroll', async () => {
    await board()
    await toLevel()
    await toTime()
    await next()
    await settle(900)
    expect(stepOf()).toBe('plan')
    const svg = inCar('.brd-chart svg')
    expect(box(svg).width).toBeGreaterThanOrEqual(326)
    expect(box(svg).width).toBeLessThanOrEqual(330)
    expect(box(inCar('.brd-chart')).right).toBeLessThan(box(inCar('.brd-lead')).left)
    expect(fits(inCar('.brd__body'))).toBe(true)
    expect(box(inCar('.brd__foot')).bottom).toBeLessThanOrEqual(window.innerHeight)
  })
})

// ── P10 — the front door ──
// The Welcome with the sign-in beside it: a returning learner signs in
// with no second screen, Board at a ticket's width, the band across the
// area and faded at its ends.
function Door({ authMode = null, onBoard = () => {}, boarding = false }) {
  return <LangProvider><Welcome onBoard={onBoard} onSignIn={() => {}} boarding={boarding} authMode={authMode} /></LangProvider>
}
const inSide = s => $('.desk-door__side')?.querySelector(s)

describe('the front door on the desk (P10)', () => {
  it('stands the sign-in beside Board, and Board as the one filled action', async () => {
    await render(<Door />)
    await settle(150)
    const side = $('.desk-door__side')
    expect(Math.round(box(side).width)).toBe(360)
    expect(Math.round(box(side).right)).toBe(Math.round(document.body.getBoundingClientRect().width))
    expect(Math.round(box(side).height)).toBe(window.innerHeight)
    expect([en.brdHaveAccount, fr.brdHaveAccount]).toContain(inSide('.desk-deck__cap').textContent)
    // Signing in only: no Login / Sign up control, no foot.
    expect(inSide('.seg')).toBeNull()
    expect(inSide('.auth-foot')).toBeNull()
    expect(inSide('input[type="email"]')).not.toBeNull()
    // Its door stands beside it: no link to a second screen.
    expect($('[data-action="sign-in"]')).toBeNull()
    const board = $('[data-action="board"]')
    expect(Math.round(box(board).width)).toBe(360)
    const mid = r => (r.left + r.right) / 2
    expect(Math.abs(mid(box(board)) - (document.body.getBoundingClientRect().width - 360) / 2)).toBeLessThan(1.5)
    expect(getComputedStyle(inSide('.auth-submit')).backgroundColor).toBe('rgba(0, 0, 0, 0)')
    expect(getComputedStyle(board).backgroundColor).not.toBe('rgba(0, 0, 0, 0)')
    expect(document.querySelectorAll('h1')).toHaveLength(1)
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth)
    // Nothing is focused, so Enter boards.
    expect(document.activeElement).toBe(document.body)
  })

  it('opens on Sign up, both sides named, when Board could not issue a pass', async () => {
    await render(<Door authMode="signup" />)
    await settle(150)
    expect(inSide('.desk-deck__cap')).toBeNull()
    const sides = [...inSide('.seg').querySelectorAll('.seg__opt')]
    expect(sides.map(o => o.getAttribute('aria-checked'))).toEqual(['false', 'true'])
    expect(inSide('.auth-foot')).not.toBeNull()
    expect(document.activeElement).toBe(inSide('input[type="email"]'))
  })

  it('focuses the email for a learner who came to sign in, and keeps Enter the form\'s there', async () => {
    const onBoard = vi.fn()
    await render(<Door authMode="login" onBoard={onBoard} />)
    await settle(150)
    expect(inSide('.seg')).toBeNull()
    expect(document.activeElement).toBe(inSide('input[type="email"]'))
    await userEvent.keyboard('aiko@example.com{Enter}')
    await settle()
    expect(onBoard).not.toHaveBeenCalled()
  })

  it('runs the band across the area, faded at its ends, with no seam at the loop\'s end', async () => {
    await render(<Door />)
    await settle(150)
    const roll = $('.brd-roll')
    expect(getComputedStyle(roll).maskImage).toMatch(/linear-gradient/)
    expect(Math.round(box(roll).left)).toBe(0)
    // The window less html's scrollbar gutter, less the column.
    expect(Math.round(box(roll).right)).toBe(Math.round(document.body.getBoundingClientRect().width) - 360)
    for (const lane of document.querySelectorAll('.brd-roll__lane')) {
      expect(lane.children).toHaveLength(24)
      // The loop moves a lane by half: that half must still cover the band.
      expect(lane.scrollWidth / 2).toBeGreaterThan(box(roll).width)
    }
  })

  it('keeps the Welcome up for a refused Google return, the reason in the side', async () => {
    refusal.current = { error: 'access_denied', code: null, description: 'denied' }
    window.history.replaceState(null, '', '/')
    await render(<App />)
    await settle(300)
    expect($('.brd--welcome')).not.toBeNull()
    expect($('main.auth')).toBeNull()
    expect(inSide('.auth-message--error')).not.toBeNull()
    expect(document.activeElement).toBe(inSide('input[type="email"]'))
  })
})
