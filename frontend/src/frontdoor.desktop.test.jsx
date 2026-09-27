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
const { ApiError } = await import('./lib/api')

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

async function board({ onComplete = vi.fn(), onExit = vi.fn(), guest = false } = {}) {
  await render(
    <LangProvider>
      <BoardingFlow session={{ access_token: 'tok' }} initialProfile={{ username: 'Tester' }} onComplete={onComplete} onExit={onExit} guest={guest} />
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
    await userEvent.click(inCar('[data-action="back"]'))
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

// ── P9 — the boarding frame (plans 122, 140) ──
// Plan 140, the owner's pick A of three drawn directions: the line laid
// down the left. A sumi column at the side's width on the LEFT edge,
// the rail's masthead at its head and a named stop per question under
// it, each printing its answer once given and the one being asked lit
// with the pick as it stands; the projection at its foot while the
// questions run, the pass once the plan is built. No head: Back stands
// on the floor beside Continue. The answers laid for the width, no
// Building, and the plan the last screen -- it enters the station.
const box = el => el.getBoundingClientRect()
const mid = r => (r.left + r.right) / 2
const bodyW = () => document.body.getBoundingClientRect().width
const side = () => $('.desk-brd__side')
const stop = key => side()?.querySelector(`[data-stop="${key}"]`)
const stops = () => [...side().querySelectorAll('.desk-brd__stop')].map(r => r.dataset.stop)
const stateOf = key => stop(key)?.className.match(/desk-brd__stop--(\w+)/)?.[1]
const valueOf = key => stop(key)?.querySelector('.desk-brd__val')?.textContent ?? null
const priced = () => stop('projection')?.querySelector('.desk-brd__fig')?.textContent ?? null
const doorOf = key => stop(key)?.querySelector('button.desk-brd__door') ?? null
async function pick(sel) { inCar(sel).click(); await settle(40) }
async function next() { inCar('[data-action="continue"]').click(); await settle() }
// The plan's arrival plays out on its own; waited out rather than
// skipped, so no Enter can land on the plan's own action instead.
async function arrived() { for (let i = 0; i < 60 && $('.onb-arrival'); i++) await settle(100) }
// Tops as the eye reads them, once the answers' entrance has landed.
const rowsOf = els => new Set(els.map(el => Math.round(box(el).top / 4)))

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

describe('the boarding frame on the desk (P9, plan 140)', () => {
  it('lays the line in a column on the left edge, a stop per question, and keeps it to the plan', async () => {
    const onComplete = vi.fn()
    await board({ onComplete })
    expect($('main.brd').className).toBe('brd desk-brd')
    // One drawing of the line: no head, no track.
    expect($('.brd__head')).toBeNull()
    expect($('.brd__track')).toBeNull()
    const col = side()
    expect(Math.round(box(col).width)).toBe(360)
    expect(Math.round(box(col).left)).toBe(0)
    expect(Math.round(box(col).height)).toBe(window.innerHeight)
    expect(col.querySelector('.desk-rail__glyph').textContent).toBe('辻')
    // The reveal is the kana's own stop; the level joins once both are read.
    expect(stops()).toEqual(['name', 'why', 'kana', 'goal', 'lines', 'rhythm', 'time'])
    expect(stop('projection')).not.toBeNull()
    await toLevel()
    expect(stops()).toEqual(['name', 'why', 'kana', 'level', 'goal', 'lines', 'rhythm', 'time'])
    await toTime()
    await next()
    // No Building: the hour goes straight to the plan, under the arrival.
    expect(stepOf()).toBe('plan')
    expect($('.brd-build__track')).toBeNull()
    // The column stays, every stop ridden and none a door any more; the
    // pass stands where the projection stood.
    expect(side()).not.toBeNull()
    expect(stops().map(stateOf).every(s => s === 'done')).toBe(true)
    expect(side().querySelector('button.desk-brd__door')).toBeNull()
    expect(stop('projection')).toBeNull()
    expect(stop('pass').querySelector('.desk-brd__holder').textContent).toBe('Tester')
    expect($('.onb-arrival')).not.toBeNull()
    // The key that skips the arrival is the arrival's alone.
    await enter()
    await settle()
    expect(stepOf()).toBe('plan')
    expect($('.onb-arrival')).toBeNull()
    // The plan is the last screen: Enter the station posts the contract.
    const go = inCar('[data-action="enter"]')
    expect([en.brdEnter, fr.brdEnter]).toContain(go.querySelector('.btn-depart__jp').textContent)
    expect(go.getAttribute('aria-keyshortcuts')).toBe('Enter')
    await enter()
    await settle()
    expect(apiJsonWithTimeout).toHaveBeenCalledWith('/api/onboarding/complete', expect.anything(), expect.anything())
    expect(onComplete).toHaveBeenCalledTimes(1)
    expect(stepOf()).toBe('plan')
  })

  it('prints each answer on its stop, the pick as it stands, and prices a level before Continue', async () => {
    await board()
    expect(stops().map(stateOf)).toEqual(['now', 'next', 'next', 'next', 'next', 'next', 'next'])
    expect(stop('name').getAttribute('aria-current')).toBe('step')
    expect(valueOf('name')).toBe('Tester')
    expect(priced()).toBe('—')
    await pastName()
    expect(stateOf('name')).toBe('done')
    expect(stateOf('why')).toBe('now')
    expect(valueOf('why')).toBeNull()
    await pick('[data-motive="trip"]')
    // Printed before Continue: the answer's stop reads it at once.
    expect([en.brdMotive.trip, fr.brdMotive.trip]).toContain(valueOf('why'))
    await next()
    await pick('[data-kana="both"]')
    await settle()
    expect(stateOf('kana')).toBe('done')
    expect(stateOf('level')).toBe('now')
    await pick('[data-level="N3"]')
    expect(valueOf('level')).toBe('N3')
    // A stop ahead prints nothing, even one the draft already prices.
    expect(stateOf('goal')).toBe('next')
    expect(valueOf('goal')).toBeNull()
    const first = priced()
    expect(first).toMatch(/\d{4}/)
    await next()
    expect(stepOf()).toBe('goal')
    // Continue committed what the column priced.
    expect(inCar('[data-goal="N2"]').getAttribute('aria-pressed')).toBe('true')
    expect(valueOf('goal')).toBe('N3 → N2')
    expect(priced()).toBe(first)
    await pick('[data-goal="N1"]')
    expect(valueOf('goal')).toBe('N3 → N1')
    expect(priced()).not.toBe(first)
    await next()
    expect(stateOf('goal')).toBe('done')
    expect(stateOf('lines')).toBe('now')
    expect(valueOf('lines')).toMatch(/·/)
    await next()
    expect(stateOf('rhythm')).toBe('now')
    const before = priced()
    await pick('[data-rhythm="20"]')
    expect(valueOf('rhythm')).toMatch(/^20 /)
    expect(priced()).not.toBe(before)
    await next()
    expect(valueOf('time')).toMatch(/^\d\d:\d\d$/)
  })

  it('prices nothing until the volumes answer', async () => {
    let release
    apiJson.mockImplementation(path => (path === '/api/onboarding/volumes'
      ? new Promise(r => { release = () => r(VOLUMES) })
      : Promise.resolve({})))
    await board()
    await toLevel()
    await pick('[data-level="N3"]')
    expect(valueOf('level')).toBe('N3')
    expect(priced()).toBe('—')
    release()
    await settle(100)
    expect(priced()).toMatch(/\d{4}/)
  })

  it('opens a passed stop\'s question in one pull, every answer kept', async () => {
    await board()
    await toLevel()
    await pick('[data-level="N3"]')
    await next()
    expect(stepOf()).toBe('goal')
    // Doors on the stops behind, none on the one asked or ahead.
    for (const key of ['name', 'why', 'kana', 'level']) expect(doorOf(key), key).not.toBeNull()
    for (const key of ['goal', 'lines', 'rhythm', 'time']) expect(doorOf(key), key).toBeNull()
    doorOf('why').click()
    await settle()
    expect(stepOf()).toBe('why')
    expect(inCar('[data-motive="trip"]').getAttribute('aria-pressed')).toBe('true')
    expect(stateOf('why')).toBe('now')
    // The way on is the way it was, the answers after it kept.
    await next()
    expect(stepOf()).toBe('kana')
    expect(inCar('[data-kana="both"]').getAttribute('aria-pressed')).toBe('true')
    // ‹ on the floor goes back one question, as it always did.
    inCar('[data-action="back"]').click()
    await settle()
    expect(stepOf()).toBe('why')
  })

  it('stands Back beside Continue on the floor, and leaves from the first question', async () => {
    const onExit = vi.fn()
    await board({ onExit })
    const floor = inCar('.desk-brd__floor')
    const back = floor.querySelector('[data-action="back"]')
    const go = floor.querySelector('[data-action="continue"]')
    expect(box(back).right).toBeLessThan(box(go).left)
    expect(Math.abs(box(back).top - box(go).top)).toBeLessThan(1)
    expect(Math.round(box(go).right)).toBe(Math.round(box(floor).right))
    expect([en.back, fr.back]).toContain(back.textContent)
    back.click()
    expect(onExit).toHaveBeenCalledTimes(1)
  })

  it('sets the answers at the width that serves them, one block with the question', async () => {
    await board()
    // The name at the card's width, for a name at the display size.
    expect(Math.round(box(inCar('.brd-field')).width)).toBe(640)
    await pastName()
    await pick('[data-motive="trip"]')
    // Measured once the answers' entrance has landed (brd-in, 6px).
    await settle(900)
    const q = box(inCar('.brd__q'))
    const stage = box(inCar('.brd__stage'))
    const foot = box(inCar('.brd__foot'))
    // Six reasons two to a row at 1100 -- three rows, not six.
    expect(rowsOf([...inCar('.brd__opts').children]).size).toBe(3)
    expect(Math.abs(mid(stage) - mid(q))).toBeLessThan(1.5)
    // The floor at the card's width whatever the answers' (plan 154),
    // on the question's middle.
    expect(Math.round(foot.width)).toBe(640)
    expect(Math.abs(mid(foot) - mid(q))).toBeLessThan(1.5)
    // Continue --sp-8 under the last answer, not on the window's floor.
    const last = box([...inCar('.brd__opts').children].at(-1))
    expect(Math.round(foot.top - last.bottom)).toBe(44)
    // Centred in the paper the column leaves.
    expect(Math.abs(mid(q) - (360 + (bodyW() - 360) / 2))).toBeLessThan(12)
    await next()
    await settle(900)
    // The kana's four answers on one row, under the card, and the way
    // back on a floor of its own: no Continue there to stand beside.
    expect(rowsOf([...inCar('.brd-grid').children]).size).toBe(1)
    expect(inCar('.desk-brd__floor [data-action="back"]')).not.toBeNull()
    expect(inCar('.btn-depart')).toBeNull()
  })

  it('draws the level list as a line of stations, the ride lit to the pick', async () => {
    await board()
    await toLevel()
    await settle(900)
    const stations = () => [...inCar('.desk-brd__line').children]
    expect(stations().map(s => s.dataset.level)).toEqual(['novice', 'N5', 'N4', 'N3', 'N2', 'N1'])
    // Six do not hold half a run's column each at 1100: two rows of three.
    expect(rowsOf(stations()).size).toBe(2)
    const ends = stations().map(s => [s.classList.contains('desk-brd__stn--head'), s.classList.contains('desk-brd__stn--tail')])
    expect(ends).toEqual([[true, false], [false, false], [false, true], [true, false], [false, false], [false, true]])
    await pick('[data-level="N4"]')
    expect(stations().map(s => s.classList.contains('desk-brd__stn--ride'))).toEqual([true, true, false, false, false, false])
    expect(inCar('[data-level="N4"]').getAttribute('aria-pressed')).toBe('true')
    expect(inCar('[data-level="N4"]').classList.contains('desk-brd__stn--on')).toBe(true)
    // What a stop is over what it holds, a line each.
    expect([...inCar('[data-level="N5"] .desk-brd__desc').children]).toHaveLength(2)
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
      expect(fits(side()), `${stepOf()}: the column`).toBe(true)
      for (const r of document.querySelectorAll('.desk-brd__door')) expect(r.scrollWidth).toBeLessThanOrEqual(r.clientWidth)
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
    await check()       // lines, all three on their stop
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
    // Its one action at a ticket's width, under the plan's middle.
    const go = box(inCar('[data-action="enter"]'))
    expect(Math.round(go.width)).toBe(360)
    expect(Math.abs(mid(go) - mid(box(inCar('.brd__stage'))))).toBeLessThan(1.5)
    expect(fits(side())).toBe(true)
  })

  it('says on the plan why the office refused the contract, and stays', async () => {
    const onComplete = vi.fn()
    apiJsonWithTimeout.mockImplementation(async () => { throw new ApiError('refused') })
    await board({ onComplete })
    await toLevel()
    await toTime()
    await next()
    await arrived()
    inCar('[data-action="enter"]').click()
    await settle()
    expect(onComplete).not.toHaveBeenCalled()
    expect(inCar('.brd__error').dataset.error).toBe('refused')
    expect(stepOf()).toBe('plan')
  })

  it('offers the account to a guest after the plan, and enters from there', async () => {
    const onComplete = vi.fn()
    await board({ onComplete, guest: true })
    await toLevel()
    await toTime()
    await next()
    await arrived()
    // Not the last screen for a guest: the account is offered first.
    expect(inCar('[data-action="enter"]')).toBeNull()
    await next()
    expect(stepOf()).toBe('account')
    expect(stop('pass')).not.toBeNull()
    inCar('[data-action="account-skip"]').click()
    await settle()
    expect(apiJsonWithTimeout).toHaveBeenCalledWith('/api/onboarding/complete', expect.anything(), expect.anything())
    expect(onComplete).toHaveBeenCalledTimes(1)
    expect(stepOf()).toBe('account')
  })
})

// ── P10 — the front door (plans 122, 140) ──
// The Welcome with the sign-in beside it: a returning learner signs in
// with no second screen. Since plan 140 the sign-in stands in the sumi
// column on the left under the rail's masthead, and the paper holds the
// heading, the tagline and Board as one block over the band, which runs
// across the paper faded at its ends.
const centreOf = r => (r.top + r.bottom) / 2
function Door({ authMode = null, onBoard = () => {}, boarding = false }) {
  return <LangProvider><Welcome onBoard={onBoard} onSignIn={() => {}} boarding={boarding} authMode={authMode} /></LangProvider>
}
const inSide = s => $('.desk-door__side')?.querySelector(s)

describe('the front door on the desk (P10, plan 140)', () => {
  it('stands the sign-in in the column on the left, and Board as the one filled action', async () => {
    await render(<Door />)
    await settle(150)
    const col = $('.desk-door__side')
    expect(Math.round(box(col).width)).toBe(360)
    expect(Math.round(box(col).left)).toBe(0)
    expect(Math.round(box(col).height)).toBe(window.innerHeight)
    // The rail's masthead at its head; the paper keeps no second mark.
    expect(inSide('.desk-rail__glyph').textContent).toBe('辻')
    expect($('.brd-hero .auth-header__glyph')).toBeNull()
    // Named plainly (plan 154): "Log in", not the link's own sentence.
    expect([en.login, fr.login]).toContain(inSide('.desk-deck__cap').textContent)
    // Drawn in the column's material: no card of the paper's in the sumi,
    // on the column's middle, where it always stood (the owner's call).
    expect(getComputedStyle(inSide('.auth-card')).backgroundColor).toBe('rgba(0, 0, 0, 0)')
    const auth = box(inSide('.auth-card'))
    expect(Math.abs(centreOf(auth) - window.innerHeight / 2)).toBeLessThan(40)
    // One lane of cards passes under the promise.
    expect(document.querySelectorAll('.brd-roll__lane')).toHaveLength(1)
    // Signing in only: no Login / Sign up control, no foot.
    expect(inSide('.seg')).toBeNull()
    expect(inSide('.auth-foot')).toBeNull()
    expect(inSide('input[type="email"]')).not.toBeNull()
    // Its door stands beside it: no link to a second screen.
    expect($('[data-action="sign-in"]')).toBeNull()
    const board = $('[data-action="board"]')
    expect(Math.round(box(board).width)).toBe(360)
    expect(Math.abs(mid(box(board)) - (360 + (bodyW() - 360) / 2))).toBeLessThan(1.5)
    // Board stands with the promise, over the band -- not on the floor.
    expect(box(board).top).toBeGreaterThan(box($('.brd-tagline')).bottom)
    expect(box(board).bottom).toBeLessThan(box($('.brd-roll')).top)
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

  it('runs the band across the paper, faded at its ends, with no seam at the loop\'s end', async () => {
    await render(<Door />)
    await settle(150)
    const roll = $('.brd-roll')
    expect(getComputedStyle(roll).maskImage).toMatch(/linear-gradient/)
    expect(Math.round(box(roll).left)).toBe(360)
    // The window less html's scrollbar gutter.
    expect(Math.round(box(roll).right)).toBe(Math.round(bodyW()))
    for (const lane of document.querySelectorAll('.brd-roll__lane')) {
      expect(lane.children).toHaveLength(24)
      // The loop moves a lane by half: that half must still cover the band.
      expect(lane.scrollWidth / 2).toBeGreaterThan(box(roll).width)
    }
  })

  it('keeps the Welcome up for a refused Google return, the reason in the column', async () => {
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

// ── P12 — the digits ──
// A digit picks the answer that names it, printed on it: a motive by
// its row, a level by its own number (the novice on 0), a kana answer
// by its tile -- and a kana answer advances, as a tap does.
const kbdOf = el => el?.querySelector('.desk-kbd')?.textContent ?? null
// An AZERTY key a US layout has no key for (é, à): Playwright would
// insert it as text with no keydown, so the keydown is dispatched from
// the focus, as the key would arrive.
const azerty = key => (document.activeElement ?? document.body)
  .dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }))
describe('the digits at first contact (P12)', () => {
  it('picks a motive by its row, on either keyboard row', async () => {
    await board()
    // Typed in the name field, a digit is the name's.
    await userEvent.keyboard('2')
    expect(inCar('.brd-field').value).toBe('Tester2')
    await userEvent.keyboard('{Backspace}')
    await pastName()
    expect(kbdOf(inCar('[data-motive="fun"]'))).toBe('2')
    await userEvent.keyboard('2')
    expect(inCar('[data-motive="fun"]').getAttribute('aria-pressed')).toBe('true')
    await userEvent.keyboard('&')
    expect(inCar('[data-motive="studies"]').getAttribute('aria-pressed')).toBe('true')
    azerty('é')
    await settle(40)
    expect(inCar('[data-motive="fun"]').getAttribute('aria-pressed')).toBe('true')
  })

  it('answers the kana by its tile and goes on, and picks a level by its own number', async () => {
    await board()
    await pastName()
    await userEvent.keyboard('3')
    await userEvent.keyboard('{Enter}')
    await settle()
    expect(stepOf()).toBe('kana')
    expect(kbdOf(inCar('[data-kana="both"]'))).toBe('3')
    await userEvent.keyboard('3')
    await settle()
    expect(stepOf()).toBe('level')
    expect(kbdOf(inCar('[data-level="N5"]'))).toBe('5')
    expect(kbdOf(inCar('[data-level="novice"]'))).toBe('0')
    await userEvent.keyboard('5')
    expect(inCar('[data-level="N5"]').getAttribute('aria-pressed')).toBe('true')
    await userEvent.keyboard('1')
    expect(inCar('[data-level="N1"]').getAttribute('aria-pressed')).toBe('true')
    azerty('à')
    await settle(40)
    expect(inCar('[data-level="novice"]').getAttribute('aria-pressed')).toBe('true')
    await userEvent.keyboard('{Enter}')
    await settle()
    // The goal list names its stops the same way: N4 on 4.
    expect(stepOf()).toBe('goal')
    await userEvent.keyboard('4')
    expect(inCar('[data-goal="N4"]').getAttribute('aria-pressed')).toBe('true')
  })

  it('picks nothing under a dialog', async () => {
    await board()
    await pastName()
    const modal = document.createElement('div')
    modal.setAttribute('aria-modal', 'true')
    modal.dataset.probeModal = ''
    document.body.appendChild(modal)
    await userEvent.keyboard('1')
    expect(inCar('[data-motive="studies"]').getAttribute('aria-pressed')).toBe('false')
  })
})

// ── P13 — first contact, finished (plan 154) ──
// The owner's ask: keep the drawing and make it smooth. The way on
// stands in one place on every question; the lit stop is a train that
// runs down the line; each answer's key turns over to its check in one
// slot; the Welcome hands its column to the wait and the wait to the
// boarding with the masthead on one pixel; the plan's arrival boards
// the paper; and a car is not dropped before the one after it has
// landed.
const { default: AppLoading } = await import('./screens/AppLoading')
const landed = () => settle(900)
const centreY = r => (r.top + r.bottom) / 2
const opacityOf = el => Number(getComputedStyle(el).opacity)

describe('first contact, finished (P13, plan 154)', () => {
  it('stands the way on where it stood, on every question', async () => {
    await board()
    const floors = []
    const read = async () => {
      await landed()
      const go = box(inCar('[data-action="continue"]'))
      const back = box(inCar('[data-action="back"]'))
      floors.push({ step: stepOf(), go: [Math.round(go.left), Math.round(go.width)], back: Math.round(back.left) })
    }
    await read()                          // name
    await pastName()
    await pick('[data-motive="trip"]')
    await read()                          // why, three columns
    await next()
    await pick('[data-kana="both"]')
    await settle()
    await pick('[data-level="N3"]')
    await read()                          // level, the canvas
    await next()
    await read()                          // goal
    await next()
    await read()                          // lines
    await next()
    await read()                          // rhythm
    await next()
    await read()                          // time
    expect(floors.map(f => f.step)).toEqual(['name', 'why', 'level', 'goal', 'lines', 'rhythm', 'time'])
    for (const f of floors) {
      expect(f.go, f.step).toEqual(floors[0].go)
      expect(f.back, f.step).toBe(floors[0].back)
    }
    // A ticket's width at the card's right end.
    expect(floors[0].go[1]).toBe(360)
  })

  it('runs the train down the line to the stop being asked, and back up it', async () => {
    await board()
    const train = () => side().querySelector('.desk-brd__train')
    const dotOf = key => stop(key).querySelector('.desk-brd__dot')
    const onDot = key => expect(Math.abs(centreY(box(train())) - centreY(box(dotOf(key)))), key).toBeLessThan(1.5)
    await landed()
    onDot('name')
    const wash = side().querySelector('.desk-brd__here')
    expect(Math.abs(box(wash).top - box(stop('name')).top)).toBeLessThan(1.5)
    await pastName()
    await landed()
    onDot('why')
    expect(Math.abs(box(wash).top - box(stop('why')).top)).toBeLessThan(1.5)
    // The ridden stretch ends on the lit stop.
    const ridden = box(side().querySelector('.desk-brd__ridden'))
    expect(Math.abs(ridden.bottom - centreY(box(dotOf('why'))))).toBeLessThan(1.5)
    await pick('[data-motive="trip"]')
    await next()
    await landed()
    onDot('kana')
    doorOf('name').click()
    await landed()
    onDot('name')
    await next()
    await landed()
    onDot('why')
  })

  it('lets the train off at the last stop once the plan is built', async () => {
    await board()
    await toLevel()
    await toTime()
    await next()
    await arrived()
    await landed()
    const route = side().querySelector('.desk-brd__route')
    expect(route.classList.contains('desk-brd__route--ridden')).toBe(true)
    expect(opacityOf(side().querySelector('.desk-brd__train'))).toBe(0)
    const last = stop('time').querySelector('.desk-brd__dot')
    expect(Math.abs(box(side().querySelector('.desk-brd__ridden')).bottom - centreY(box(last)))).toBeLessThan(1.5)
  })

  it('turns an answer\'s key over to its check, in one slot', async () => {
    await board()
    await pastName()
    await landed()
    const row = inCar('[data-motive="fun"]')
    const key = () => row.querySelector('.desk-brd__key')
    const tick = () => row.querySelector('.desk-brd__tick')
    // One slot, trailing the row, where the phone's check stands.
    expect(row.querySelectorAll('.desk-kbd')).toHaveLength(1)
    expect(row.querySelector('.brd-opt__check')).toBeNull()
    expect(key().textContent).toBe('2')
    expect(opacityOf(key())).toBeGreaterThan(0.5)
    expect(opacityOf(tick())).toBe(0)
    await pick('[data-motive="fun"]')
    await settle(300)
    expect(opacityOf(key())).toBe(0)
    expect(opacityOf(tick())).toBe(1)
    // A tile's in its top right corner: a kana answer's, a station's.
    await next()
    await landed()
    // Inside the tile's border, --sp-2 (6px) from its edges.
    const corner = el => {
      const m = box(el.querySelector('.desk-brd__mark'))
      const t = box(el)
      return [Math.round(t.right - el.clientLeft - m.right), Math.round(m.top - t.top - el.clientTop)]
    }
    expect(corner(inCar('[data-kana="hiragana"]'))).toEqual([6, 6])
    await pick('[data-kana="both"]')
    await landed()
    const tile = inCar('[data-level="N5"] .desk-brd__tile')
    expect(corner(tile)).toEqual([6, 6])
    expect(inCar('.desk-brd__chk')).toBeNull()
  })

  it('rides the recommended rhythm\'s tag on its edge, every figure on one line', async () => {
    await board()
    await toLevel()
    await pick('[data-level="N3"]')
    await next()
    await next()
    await next()
    expect(stepOf()).toBe('rhythm')
    await landed()
    const cells = [...inCar('.brd-grid').children]
    const tops = cells.map(c => Math.round(box(c.querySelector('.brd-cell__n')).top))
    expect(new Set(tops).size).toBe(1)
    const tag = inCar('[data-rhythm="10"] .brd-tag')
    expect(Math.abs(centreY(box(tag)) - box(inCar('[data-rhythm="10"]')).top)).toBeLessThan(1.5)
  })

  it('hands the Welcome\'s column to the wait, and the wait\'s to the boarding', async () => {
    const mastAt = () => {
      const r = box($('.desk-rail__glyph'))
      return [Math.round(r.left), Math.round(r.top)]
    }
    const dotsAt = () => {
      const r = box($('.desk-wait .loading'))
      return [Math.round(mid(r)), Math.round(centreY(r))]
    }
    const screen = await render(<Door />)
    await landed()
    const at = mastAt()
    expect($('.desk-wait')).toBeNull()
    await screen.rerender(<Door boarding />)
    await settle(300)
    expect($('.desk-door').classList.contains('desk-door--leaving')).toBe(true)
    expect(opacityOf($('.desk-door__auth'))).toBe(0)
    expect(opacityOf($('.brd-hero'))).toBe(0)
    expect(opacityOf($('.brd-roll'))).toBe(0)
    // The pass being issued: its dots a beat after the press, on the
    // paper's middle.
    expect(opacityOf($('.desk-wait'))).toBe(0)
    await landed()
    expect(opacityOf($('.desk-wait'))).toBe(1)
    const dots = dotsAt()
    expect(Math.abs(dots[0] - (360 + (bodyW() - 360) / 2))).toBeLessThan(2)
    await screen.unmount()
    // The wait after it, handed the press a second ago: the same column,
    // the same dots on the same spot, already drawn.
    const wait = await render(<LangProvider><AppLoading wakesServer frame since={performance.now() - 1000} /></LangProvider>)
    await settle(60)
    expect(Math.round(box(side()).width)).toBe(360)
    expect(mastAt()).toEqual(at)
    expect(opacityOf($('.desk-brd--wait .desk-wait'))).toBe(1)
    expect(dotsAt()).toEqual(dots)
    await wait.unmount()
    // With no press to time from, a beat before they are drawn at all.
    const cold = await render(<LangProvider><AppLoading wakesServer frame /></LangProvider>)
    await settle(100)
    expect(opacityOf($('.desk-wait'))).toBe(0)
    await landed()
    expect(opacityOf($('.desk-wait'))).toBe(1)
    await cold.unmount()
    await board()
    expect(mastAt()).toEqual(at)
  })

  it('brings the Welcome back when no pass could be issued', async () => {
    const screen = await render(<Door boarding />)
    await landed()
    await screen.rerender(<Door authMode="signup" />)
    await landed()
    expect($('.desk-door').classList.contains('desk-door--leaving')).toBe(false)
    expect(opacityOf($('.brd-hero'))).toBe(1)
    expect(opacityOf($('.desk-door__auth'))).toBe(1)
  })

  it('boards the plan\'s arrival on the paper, the line left in view', async () => {
    await board()
    await toLevel()
    await toTime()
    await next()
    await settle(200)
    const sign = $('.onb-arrival__board')
    expect(sign).not.toBeNull()
    expect(Math.abs(mid(box(sign)) - (360 + (bodyW() - 360) / 2))).toBeLessThan(2)
    expect(Math.round(box($('.onb-arrival__scrim')).left)).toBe(360)
  })

  it('keeps the leaving car until the arriving one has landed, and runs Back the other way', async () => {
    await board()
    await pastName()
    await pick('[data-motive="trip"]')
    inCar('[data-action="continue"]').click()
    await settle(500)
    // Gone from sight, not from the page: the arriving answers are still
    // coming in, and dropping it took their entrance with it.
    const out = $('.brd__car--out')
    expect(out).not.toBeNull()
    expect(opacityOf(out)).toBe(0)
    expect(getComputedStyle(live()).animationName).toBe('desk-brd-pull-in')
    await settle(500)
    expect($('.brd__car--out')).toBeNull()
    inCar('[data-action="back"]').click()
    await settle(40)
    expect(live().dataset.dir).toBe('back')
    expect($('.brd__car--out').dataset.dir).toBe('back')
  })
})

describe('the hover, simpler (P14, plan 154)', () => {
  it('draws the name field\'s gold edge on an answer, and nothing else', async () => {
    await board()
    const gold = getComputedStyle(inCar('.brd-field')).borderTopColor
    await pastName()
    await landed()
    const row = inCar('[data-motive="fun"]')
    const ground = getComputedStyle(row).backgroundColor
    await userEvent.hover(row)
    await settle(250)
    expect(getComputedStyle(row).filter).toBe('none')
    expect(getComputedStyle(row).borderTopColor).toBe(gold)
    // No wash: the ground it had at rest.
    expect(getComputedStyle(row).backgroundColor).toBe(ground)
    await userEvent.hover(inCar('[data-action="back"]'))
    await settle(250)
    expect(getComputedStyle(inCar('[data-action="back"]')).filter).toBe('none')
  })
})
