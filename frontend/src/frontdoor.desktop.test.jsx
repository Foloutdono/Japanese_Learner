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

// ── P9 — the boarding frame (plans 122, 140, 163) ──
// Plan 163, the owner's pick D of the canvas "Tsuji — onboarding, new
// directions": the sumi column goes, and three places never move. The
// question at the paper's top-left corner; the journey as a strip at the
// floor's left end, a named stop per question, the answer given said on
// its stop and a stop behind a door back to its question (plan 140's
// rules); the floor in the bottom-right corner, Back beside Continue.
// The answers laid for the width, no Building, and the plan the last
// screen -- it enters the station.
const box = el => el.getBoundingClientRect()
const mid = r => (r.left + r.right) / 2
const cy = r => (r.top + r.bottom) / 2
const bodyW = () => document.body.getBoundingClientRect().width
const side = () => $('.desk-brd__side')
const strip = () => $('.desk-brd__strip')
const stop = key => strip()?.querySelector(`[data-stop="${key}"]`)
const stops = () => [...strip().querySelectorAll('.desk-brd__sp')].map(r => r.dataset.stop)
const stateOf = key => stop(key)?.className.match(/desk-brd__sp--(\w+)/)?.[1]
// The answer said on a stop: read out beside its name, not printed.
const valueOf = key => stop(key)?.querySelector('.sr-only')?.textContent.replace(/^ · /, '') ?? null
const doorOf = key => stop(key)?.querySelector('button.desk-brd__sp-door') ?? null
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

describe('the boarding frame on the desk (P9, plans 140, 163)', () => {
  it('draws the journey as a strip at the floor\'s left end, a stop per question, and keeps it to the plan', async () => {
    const onComplete = vi.fn()
    await board({ onComplete })
    expect($('main.brd').className).toBe('brd desk-brd')
    // One drawing of the line: no head, no track, and no column.
    expect($('.brd__head')).toBeNull()
    expect($('.brd__track')).toBeNull()
    expect(side()).toBeNull()
    await settle(600)
    // On the floor's line, at its left end, clear of the way back.
    const at = box(strip())
    expect(Math.abs(cy(at) - cy(box(inCar('[data-action="continue"]'))))).toBeLessThan(1.5)
    expect(Math.round(at.left)).toBe(Math.round(box(inCar('.brd__q')).left))
    expect(at.right).toBeLessThan(box(inCar('[data-action="back"]')).left)
    // The reveal is the kana's own stop; the level joins once both are read.
    expect(stops()).toEqual(['name', 'why', 'kana', 'goal', 'lines', 'rhythm', 'time'])
    await toLevel()
    expect(stops()).toEqual(['name', 'why', 'kana', 'level', 'goal', 'lines', 'rhythm', 'time'])
    await toTime()
    await next()
    // No Building: the hour goes straight to the plan, under the arrival.
    expect(stepOf()).toBe('plan')
    expect($('.brd-build__track')).toBeNull()
    // The strip stays, every stop ridden and none a door any more.
    expect(stops().map(stateOf).every(s => s === 'done')).toBe(true)
    expect(strip().querySelector('button.desk-brd__sp-door')).toBeNull()
    expect(strip().querySelector('[aria-current]')).toBeNull()
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

  it('says each answer on its stop, the pick as it stands, and lights the one asked', async () => {
    await board()
    expect(stops().map(stateOf)).toEqual(['now', 'next', 'next', 'next', 'next', 'next', 'next'])
    expect(stop('name').getAttribute('aria-current')).toBe('step')
    expect(valueOf('name')).toBe('Tester')
    // Said, not printed: a pointer's title and the stop's read-out name.
    expect(stop('name').querySelector('.desk-brd__sp-door').title).toMatch(/· Tester$/)
    await pastName()
    expect(stateOf('name')).toBe('done')
    expect(stateOf('why')).toBe('now')
    expect(valueOf('why')).toBeNull()
    await pick('[data-motive="trip"]')
    // Said before Continue: the answer's stop reads it at once.
    expect([en.brdMotive.trip, fr.brdMotive.trip]).toContain(valueOf('why'))
    await next()
    await pick('[data-kana="both"]')
    await settle()
    expect(stateOf('kana')).toBe('done')
    expect(stateOf('level')).toBe('now')
    await pick('[data-level="N3"]')
    expect(valueOf('level')).toBe('N3')
    // A stop ahead says nothing, even one the draft already prices.
    expect(stateOf('goal')).toBe('next')
    expect(valueOf('goal')).toBeNull()
    await next()
    expect(stepOf()).toBe('goal')
    // Continue committed what the draft priced.
    expect(inCar('[data-goal="N2"]').getAttribute('aria-pressed')).toBe('true')
    expect(valueOf('goal')).toBe('N3 → N2')
    await pick('[data-goal="N1"]')
    expect(valueOf('goal')).toBe('N3 → N1')
    await next()
    expect(stateOf('goal')).toBe('done')
    expect(stateOf('lines')).toBe('now')
    expect(valueOf('lines')).toMatch(/·/)
    await next()
    expect(stateOf('rhythm')).toBe('now')
    await pick('[data-rhythm="20"]')
    expect(valueOf('rhythm')).toMatch(/^20 /)
    await next()
    expect(valueOf('time')).toMatch(/^\d\d:\d\d$/)
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

  it('stands Back beside Continue in the bottom-right corner, and leaves from the first question', async () => {
    const onExit = vi.fn()
    await board({ onExit })
    await settle(600)
    const floor = inCar('.desk-brd__floor')
    const back = floor.querySelector('[data-action="back"]')
    const go = floor.querySelector('[data-action="continue"]')
    expect(box(back).right).toBeLessThan(box(go).left)
    expect(Math.abs(box(back).top - box(go).top)).toBeLessThan(1)
    // The corner: the canvas's right edge, --sp-7 over the window's floor.
    expect(Math.round(bodyW() - box(go).right)).toBe(Math.round(box(strip()).left))
    expect(Math.round(window.innerHeight - box(go).bottom)).toBe(28)
    expect([en.back, fr.back]).toContain(back.textContent)
    back.click()
    expect(onExit).toHaveBeenCalledTimes(1)
  })

  it('sets the question in the top-left corner and its answers in the paper under it', async () => {
    await board()
    // The name at the card's width, for a name at the display size.
    expect(Math.round(box(inCar('.brd-field')).width)).toBe(640)
    await pastName()
    await pick('[data-motive="trip"]')
    // Measured once the answers' entrance has landed (brd-in, 6px).
    await settle(900)
    const q = box(inCar('.brd__q'))
    const roads = box(inCar('.desk-brd__roads'))
    const foot = box(inCar('.brd__foot'))
    // The question at the corner, --sp-7 and --sp-6 under the window's
    // top, set left -- and at the display rung: 1100x800 is no short step.
    expect(Math.round(q.left)).toBe(Math.round(box(strip()).left))
    expect(Math.round(q.top)).toBe(50)
    expect(getComputedStyle(inCar('.brd__q')).fontSize).toBe('40px')
    expect(getComputedStyle(inCar('.brd__q')).textAlign).toBe('start')
    // The answers centred across the paper, between the question and the
    // floor, a rung (--sp-6) at least under the question.
    expect(Math.abs(mid(roads) - bodyW() / 2)).toBeLessThan(1.5)
    expect(roads.top - q.bottom).toBeGreaterThanOrEqual(21.5)
    expect(roads.bottom).toBeLessThan(foot.top)
    await next()
    await settle(900)
    // The kana's four answers on one row, under the card, and the way
    // back on a floor of its own: no Continue there to stand beside.
    expect(rowsOf([...inCar('.brd-grid').children]).size).toBe(1)
    expect(inCar('.desk-brd__floor [data-action="back"]')).not.toBeNull()
    expect(inCar('.btn-depart')).toBeNull()
  })

  it('sets the name on its plate over the question\'s hub, the line leaving it for the next stop', async () => {
    await board()
    await settle(600)
    const field = box(inCar('.brd-field'))
    // The letters the name has left, at the plate's end.
    expect(inCar('.desk-brd__plate-count').textContent).toBe('6 / 20')
    await userEvent.keyboard('X')
    expect(inCar('.desk-brd__plate-count').textContent).toBe('7 / 20')
    // Set in from the question, the hub under the plate's left end.
    expect(field.left).toBeGreaterThan(box(inCar('.brd__q')).left)
    const hub = inCar('.desk-brd__hub--pole')
    expect(hub.textContent).toBe('01')
    expect(Math.abs(mid(box(hub)) - (field.left + 40))).toBeLessThan(1)
    expect(box(hub).top).toBeGreaterThan(field.bottom)
    // The next stop down the line, named.
    const nextStop = inCar('.desk-brd__name-next')
    expect([en.brdStop.why, fr.brdStop.why]).toContain(nextStop.textContent)
    expect(box(nextStop).left).toBeGreaterThan(field.right)
  })

  it('draws the six reasons as roads out of the question\'s hub, the pick\'s road lit', async () => {
    await board()
    await pastName()
    await settle(900)
    const roads = inCar('.desk-brd__roads')
    const hub = roads.querySelector('.desk-brd__hub')
    // The hub prints the question's place on the strip, in the paper's middle.
    expect(hub.textContent).toBe('02')
    expect(Math.abs(mid(box(hub)) - bodyW() / 2)).toBeLessThan(1.5)
    const ways = [...roads.querySelectorAll('.desk-brd__way')]
    expect(ways.map(w => w.dataset.motive)).toEqual(['studies', 'fun', 'trip', 'live', 'friends', 'other'])
    // A road from the hub's centre to each reason's ring, drawn on the
    // map's own figures -- out of 100 across it and down it.
    const map = box(roads.querySelector('.desk-brd__map'))
    const at = (x, y) => [map.left + (Number(x) / 100) * map.width, map.top + (Number(y) / 100) * map.height]
    const ends = [...roads.querySelectorAll('.desk-brd__road')].map(l => ({
      start: at(l.getAttribute('x1'), l.getAttribute('y1')),
      end: at(l.getAttribute('x2'), l.getAttribute('y2')),
      on: l.classList.contains('desk-brd__road--on'),
    }))
    expect(ends).toHaveLength(6)
    const near = ([x, y], r) => Math.abs(x - mid(r)) < 1 && Math.abs(y - cy(r)) < 1
    for (const e of ends) expect(near(e.start, box(hub))).toBe(true)
    const rings = ways.map(w => box(w.querySelector('.desk-brd__ring')))
    rings.forEach((r, i) => expect(ends.some(e => near(e.end, r)), ways[i].dataset.motive).toBe(true))
    // Clockwise from the top left, in the order the digits pick them.
    const angles = rings.map(r => Math.atan2(cy(r) - cy(box(hub)), mid(r) - mid(box(hub))))
    expect([...angles].sort((a, b) => a - b)).toEqual(angles)
    expect(angles[0]).toBeLessThan(-Math.PI / 2)
    // Each whole on the paper, under the question and over the floor, and
    // none on another or on the hub.
    const q = box(inCar('.brd__q'))
    const floor = box(inCar('.brd__foot'))
    const boxes = ways.map(box)
    const apart = (a, b) => a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top
    boxes.forEach((b, i) => {
      const name = ways[i].dataset.motive
      expect(b.left, name).toBeGreaterThanOrEqual(q.left - 0.5)
      expect(b.right, name).toBeLessThanOrEqual(bodyW() - q.left + 0.5)
      expect(b.top, name).toBeGreaterThan(q.bottom)
      expect(b.bottom, name).toBeLessThan(floor.top)
      expect(apart(b, box(hub)), name).toBe(true)
      boxes.forEach((o, j) => { if (j > i) expect(apart(b, o), `${name}/${ways[j].dataset.motive}`).toBe(true) })
    })
    // A pick lights its own road, and only its own.
    expect(ends.some(e => e.on)).toBe(false)
    await pick('[data-motive="live"]')
    const lit = [...roads.querySelectorAll('.desk-brd__road--on')]
    expect(lit).toHaveLength(1)
    expect(near(at(lit[0].getAttribute('x2'), lit[0].getAttribute('y2')), rings[3])).toBe(true)
    expect(inCar('[data-motive="live"]').getAttribute('aria-pressed')).toBe('true')
    expect(kbdOf(inCar('[data-motive="live"]'))).toBe('4')
  })

  it('hangs the kana\'s four answers from the two words, each drawn as what it reads', async () => {
    await board()
    await pastName()
    await pick('[data-motive="trip"]')
    await next()
    await settle(900)
    expect(stepOf()).toBe('kana')
    expect([en.brdKanaHint, fr.brdKanaHint]).toContain(inCar('.brd__hint').textContent)
    const words = inCar('.desk-brd__words')
    expect([...words.children].map(w => w.textContent)).toEqual(['すし', 'ホテル'])
    expect(getComputedStyle(words).fontSize).toBe('72px')
    const answers = [...inCar('.brd-grid').children]
    expect(answers.map(a => a.dataset.kana)).toEqual(['hiragana', 'katakana', 'both', 'none'])
    // Each answer shows the two words, solid where it reads one.
    const reads = answers.map(a => [...a.querySelectorAll('.desk-brd__chip')].map(c => !c.classList.contains('desk-brd__chip--not')))
    expect(reads).toEqual([[true, false], [false, true], [true, true], [false, false]])
    // What it says first, the word set as Japanese; then its name.
    expect([en.brdKanaOnly('すし'), fr.brdKanaOnly('すし')]).toContain(answers[0].querySelector('.brd-kopt__label').textContent)
    expect(answers[0].querySelector('.brd-kopt__label [lang="ja"]').textContent).toBe('すし')
    expect([en.brdKanaSays.none, fr.brdKanaSays.none]).toContain(answers[3].querySelector('.desk-brd__ans-sub').textContent)
    // A branch down to each answer's middle, from a knot under the words.
    const branches = [...inCar('.desk-brd__tree').querySelectorAll('.desk-brd__branch')]
    expect(branches).toHaveLength(4)
    branches.forEach((b, i) => {
      const r = box(b)
      const down = i < 2 ? r.left + 2 : r.right - 2
      expect(Math.abs(down - mid(box(answers[i]))), answers[i].dataset.kana).toBeLessThan(1)
      expect(Math.abs(r.bottom - box(answers[i]).top), answers[i].dataset.kana).toBeLessThan(1)
    })
    const knot = box(inCar('.desk-brd__knot'))
    expect(Math.abs(mid(knot) - mid(box(words)))).toBeLessThan(1)
    expect(knot.top).toBeGreaterThan(box(words).bottom)
    expect(inCar('.desk-brd__branch--on')).toBeNull()
    // Answered, and come back to by Back: the answer's branch is lit.
    await pick('[data-kana="hiragana"]')
    await settle(900)
    expect(stepOf()).toBe('reveal')
    inCar('[data-action="back"]').click()
    await settle(900)
    expect(stepOf()).toBe('kana')
    const lit = [...inCar('.desk-brd__tree').querySelectorAll('.desk-brd__branch')].map(b => b.classList.contains('desk-brd__branch--on'))
    expect(lit).toEqual([true, false, false, false])
  })

  it('reads the two words out sign by sign, and names the first stop and its day', async () => {
    await board()
    await pastName()
    await pick('[data-motive="trip"]')
    await next()
    await pick('[data-kana="hiragana"]')
    await settle(900)
    expect(stepOf()).toBe('reveal')
    expect([en.brdRevealLead, fr.brdRevealLead]).toContain(inCar('.brd__hint').textContent)
    const cards = [...inCar('.desk-brd__reveal').children]
    expect(cards.map(c => c.querySelector('.desk-brd__word-jp').textContent)).toEqual(['すし', 'ホテル'])
    const signs = c => [...c.querySelectorAll('.desk-brd__sign')].map(s => [s.querySelector('[lang="ja"]').textContent, s.querySelector('.desk-brd__sign-sound').textContent])
    expect(signs(cards[0])).toEqual([['す', 'su'], ['し', 'shi']])
    expect(signs(cards[1])).toEqual([['ホ', 'ho'], ['テ', 'te'], ['ル', 'ru']])
    // Side by side, the same height.
    expect(Math.abs(box(cards[0]).top - box(cards[1]).top)).toBeLessThan(1)
    expect(Math.abs(box(cards[0]).height - box(cards[1]).height)).toBeLessThan(1)
    // The first stop: the 112 signs a hiragana reader has still to
    // read, at the recommended 10 a day -- twelve days from today.
    const day = new Date()
    day.setDate(day.getDate() + 12)
    const said = ['en', 'fr'].map(l => new Intl.DateTimeFormat(l, { day: 'numeric', month: 'short' }).format(day))
    const first = inCar('.desk-brd__first').textContent
    expect(said.some(d => first.includes(d)), first).toBe(true)
    expect(first).toMatch(/10 min/)
    expect(fits(inCar('.brd__body'))).toBe(true)
  })

  it('draws the level and the goal as the line climbing from the hub, the pick hung with its callout', async () => {
    await board()
    await toLevel()
    await settle(900)
    const climb = () => inCar('.desk-brd__climb')
    const stops = () => [...climb().querySelectorAll('.desk-brd__stop')]
    const ring = el => box(el.querySelector('.desk-brd__stop-ring'))
    const stateOf = el => el.className.match(/desk-brd__stop--(\w+)/)?.[1] ?? null
    expect([en.brdLevelHint, fr.brdLevelHint]).toContain(inCar('.brd__hint').textContent)
    expect(stops().map(s => s.dataset.level)).toEqual(['novice', 'N5', 'N4', 'N3', 'N2', 'N1'])
    // A step up and to the right a level, from the hub at the line's foot,
    // which prints the question's place on the strip.
    const hub = climb().querySelector('.desk-brd__hub')
    expect(hub.textContent).toBe('04')
    const rings = stops().map(ring)
    ;[box(hub), ...rings].reduce((before, r) => {
      expect(mid(r)).toBeGreaterThan(mid(before))
      expect(cy(r)).toBeLessThan(cy(before))
      return r
    })
    // Each stop's name and holdings under its ring, clear of the next
    // stop's, and the whole line on the paper, over the floor.
    const q = box(inCar('.brd__q'))
    const labels = stops().map(s => box(s.querySelector('.desk-brd__stop-lab')))
    labels.forEach((l, i) => {
      expect(l.top, stops()[i].dataset.level).toBeGreaterThan(rings[i].bottom)
      if (i < labels.length - 1) expect(l.right, stops()[i].dataset.level).toBeLessThanOrEqual(labels[i + 1].left)
      expect(l.right).toBeLessThanOrEqual(bodyW() - q.left + 0.5)
      expect(l.bottom).toBeLessThan(box(inCar('.brd__foot')).top)
    })
    expect(rings[5].top).toBeGreaterThan(box(inCar('.brd__hint')).bottom)
    expect([...inCar('[data-level="N5"] .desk-brd__stop-desc').children]).toHaveLength(2)
    expect(inCar('.desk-brd__call')).toBeNull()
    // The pick: the stops behind it filled, the line inked up to it, and
    // "You are here" hung over its ring.
    await pick('[data-level="N4"]')
    expect(stops().map(stateOf)).toEqual(['known', 'known', 'on', null, null, null])
    expect(inCar('[data-level="N4"]').getAttribute('aria-pressed')).toBe('true')
    expect(climb().querySelectorAll('.desk-brd__rail--known')).toHaveLength(1)
    const call = inCar('.desk-brd__call')
    expect([en.levelCurrentMark, fr.levelCurrentMark]).toContain(call.querySelector('.desk-brd__call-cap').textContent)
    expect(call.querySelector('.desk-brd__call-fig').textContent).toBe('N4')
    expect(Math.abs(mid(box(call)) - mid(ring(inCar('[data-level="N4"]'))))).toBeLessThan(1)
    expect(box(call).bottom).toBeLessThan(ring(inCar('[data-level="N4"]')).top)
    // The goal: the same line, the stops behind the learner inked and no
    // longer answers, the next one tagged; the ride to the pick in gold,
    // and the arrival's month over it.
    await next()
    await settle(900)
    expect(stepOf()).toBe('goal')
    expect(climb().querySelector('.desk-brd__hub').textContent).toBe('05')
    expect(stops().map(s => s.dataset.goal ?? null)).toEqual([null, null, null, 'N3', 'N2', 'N1'])
    expect(stops().slice(0, 3).every(s => s.tagName === 'SPAN' && stateOf(s) === 'known')).toBe(true)
    expect([en.brdNextStop, fr.brdNextStop]).toContain(inCar('[data-goal="N3"] .brd-tag').textContent)
    await pick('[data-goal="N2"]')
    expect(stops().map(stateOf)).toEqual(['known', 'known', 'known', 'ride', 'on', null])
    expect(climb().querySelectorAll('.desk-brd__rail--ride')).toHaveLength(1)
    const arrive = inCar('.desk-brd__call')
    expect([en.statusArrival, fr.statusArrival]).toContain(arrive.querySelector('.desk-brd__call-cap').textContent)
    expect(arrive.querySelector('.desk-brd__call-fig').textContent).toMatch(/20\d\d/)
  })

  it('draws a learner short of the kana riding from the hub, the novice\'s stop the next', async () => {
    await board()
    await pastName()
    await pick('[data-motive="trip"]')
    await next()
    await pick('[data-kana="none"]')
    await settle()
    await next()
    await settle(900)
    expect(stepOf()).toBe('goal')
    const stops = [...inCar('.desk-brd__climb').querySelectorAll('.desk-brd__stop')]
    // Every stop ahead, the novice's own first: all six are answers.
    expect(stops.map(s => s.dataset.goal)).toEqual(['novice', 'N5', 'N4', 'N3', 'N2', 'N1'])
    expect(inCar('.desk-brd__rail--known')).toBeNull()
    await pick('[data-goal="N5"]')
    expect(stops.map(s => s.className.match(/desk-brd__stop--(\w+)/)?.[1] ?? null)).toEqual(['ride', 'on', null, null, null, null])
    expect(inCar('.desk-brd__climb').querySelectorAll('.desk-brd__rail--ride')).toHaveLength(1)
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
      // The strip and the floor share their line and never meet.
      expect(box(strip()).right, `${stepOf()}: the strip`).toBeLessThan(box(inCar('.brd__foot button')).left)
      const go = inCar('.brd__foot .btn-depart')
      if (go) expect(go.scrollWidth, `${stepOf()}: Continue`).toBeLessThanOrEqual(go.clientWidth)
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

  it('draws the plan as the ride to scale, what the terminus holds beside what it is for', async () => {
    await board()
    await toLevel()
    await toTime()
    await next()
    await settle(900)
    expect(stepOf()).toBe('plan')
    const halts = [...inCar('.desk-brd__route').children]
    const ring = h => box(h.querySelector('.desk-brd__halt-ring'))
    // From the crossroads to the terminus, left to right, on one line.
    expect(halts[0].classList.contains('desk-brd__halt--start')).toBe(true)
    expect(halts[0].querySelector('.mark')).not.toBeNull()
    expect(halts.at(-1).classList.contains('desk-brd__halt--end')).toBe(true)
    halts.map(ring).reduce((a, b) => { expect(mid(b)).toBeGreaterThan(mid(a)); return b })
    expect(new Set(halts.map(h => Math.round(cy(ring(h))))).size).toBe(1)
    // A reader of both scripts has no kana stop; the terminus is the goal
    // (N3's next, N2) and its date.
    expect(inCar('.desk-brd__halt--kana')).toBeNull()
    expect(halts.at(-1).querySelector('.desk-brd__halt-ring').textContent).toBe('N2')
    expect(halts.at(-1).querySelector('.desk-brd__halt-date').textContent).toMatch(/20\d\d/)
    // Every stop's name clear of the next one's.
    const names = halts.map(h => box(h.querySelector('.desk-brd__halt-name')))
    names.reduce((a, b) => { expect(b.left).toBeGreaterThan(a.right); return b })
    // Under the rule: each line's figure at the terminus, the trip's two
    // promises beside them.
    expect([...inCar('.desk-brd__held-list').children].map(i => i.dataset.line)).toEqual(['vocab', 'kanji', 'grammar'])
    expect(inCar('.desk-brd__for-list').children).toHaveLength(2)
    expect(box(inCar('.desk-brd__held')).right).toBeLessThan(box(inCar('.desk-brd__for')).left)
    expect(fits(inCar('.brd__body'))).toBe(true)
    expect(box(inCar('.brd__foot')).bottom).toBeLessThanOrEqual(window.innerHeight)
    // Its one action at a ticket's width, in the floor's corner.
    const go = box(inCar('[data-action="enter"]'))
    expect(Math.round(go.width)).toBe(360)
    expect(Math.round(bodyW() - go.right)).toBe(Math.round(box(strip()).left))
  })

  it('stops the plan at the kana for a learner who reads neither script yet', async () => {
    await board()
    await pastName()
    await pick('[data-motive="trip"]')
    await next()
    await pick('[data-kana="none"]')
    await settle()
    await next()          // → goal, N5 picked
    await next()          // → lines
    await next()          // → rhythm
    await next()          // → time
    await next()          // → plan
    await settle(900)
    expect(stepOf()).toBe('plan')
    const halts = [...inCar('.desk-brd__route').children]
    expect(halts.map(h => h.className.match(/desk-brd__halt--(\w+)/)[1])).toEqual(['start', 'kana', 'by', 'by', 'end'])
    expect(halts[1].querySelector('.desk-brd__halt-ring').textContent).toBe('あ')
    const names = halts.map(h => box(h.querySelector('.desk-brd__halt-name')))
    names.reduce((a, b) => { expect(b.left).toBeGreaterThan(a.right); return b })
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
    expect(stops().map(stateOf).every(s => s === 'done')).toBe(true)
    await settle(900)
    // The form on the left, the ticket it keeps on the right: the holder,
    // the ride's terminus and its day, the welcome on the stub.
    const form = box(inCar('.desk-brd__form'))
    const ticket = inCar('.desk-brd__tkt')
    expect(form.right).toBeLessThan(box(ticket).left)
    expect(ticket.querySelector('.desk-brd__tkt-name').textContent).toBe('Tester')
    expect(ticket.querySelector('.desk-brd__tkt-stop--end .desk-brd__tkt-dot').textContent).toBe('N2')
    expect(ticket.querySelector('.desk-brd__tkt-bal').textContent).toBe('200')
    expect([en.brdCreditsOffered, fr.brdCreditsOffered]).toContain(ticket.querySelector('.desk-brd__tkt-sub').textContent)
    // Every term whole on the ticket.
    for (const dd of ticket.querySelectorAll('.desk-brd__tkt-term > dd')) {
      expect(dd.scrollWidth).toBeLessThanOrEqual(dd.clientWidth + 1)
    }
    // Riding on without an account is offered under it, and the floor
    // keeps its one filled action; signing in under the form.
    expect(inCar('.desk-brd__tkt-note [data-action="account-skip"]')).not.toBeNull()
    expect(inCar('.brd__foot [data-action="account-skip"]')).toBeNull()
    expect(inCar('.desk-brd__form [data-action="account-sign-in"]')).not.toBeNull()
    expect(fits(inCar('.brd__body'))).toBe(true)
    inCar('[data-action="account-skip"]').click()
    await settle()
    expect(apiJsonWithTimeout).toHaveBeenCalledWith('/api/onboarding/complete', expect.anything(), expect.anything())
    expect(onComplete).toHaveBeenCalledTimes(1)
    expect(stepOf()).toBe('account')
  })
})

// ── P10 — the front door (plans 122, 140, 163) ──
// The Welcome with the sign-in on the same screen: a returning learner
// signs in with no second screen. Since plan 163 (the owner's D00) the
// paper is the crossroads, whole, no column: the way in at the paper's
// left margin -- the promise over Board, or the sign-in over its own
// action -- on the gold road that runs right into the hub, 辻, and out of
// the hub the app's seven lines to their signs; the corner holds the
// other way in.
const centreOf = r => (r.top + r.bottom) / 2
function Door({ authMode = null, onBoard = () => {}, onSignIn = () => {}, onBack = () => {}, boarding = false }) {
  return <LangProvider><Welcome onBoard={onBoard} onSignIn={onSignIn} onBack={onBack} boarding={boarding} authMode={authMode} /></LangProvider>
}
const inBlock = s => $('.desk-front__block')?.querySelector(s)
// A token's colour as the sheet paints it.
function paintOf(token) {
  const probe = document.createElement('div')
  probe.style.background = `var(${token})`
  document.body.appendChild(probe)
  const colour = getComputedStyle(probe).backgroundColor
  probe.remove()
  return colour
}
const LINES = ['kana', 'vocab', 'kanji', 'grammar', 'reading', 'translation', 'dictation']

describe('the front door on the desk (P10, plans 140, 163)', () => {
  it('stands the promise over Board at the paper\'s margin, on the gold road into the hub', async () => {
    await render(<Door />)
    await settle(800)
    // The paper whole: no column, no masthead, no rolling stock -- the
    // mark is the hub's.
    expect($('.desk-door__side')).toBeNull()
    expect($('.desk-rail__mast')).toBeNull()
    expect($('.brd-roll')).toBeNull()
    expect($('.desk-front__hub .mark').getAttribute('aria-label')).toBe('辻')
    expect($('.desk-front__hub').closest('[aria-hidden="true"]')).toBeNull()
    expect(document.querySelectorAll('.mark')).toHaveLength(1)
    const board = box($('[data-action="board"]'))
    // A ticket wide at the margin, under the promise, a rung under the
    // paper's middle.
    expect(Math.round(board.left)).toBe(44)
    expect(Math.round(board.width)).toBe(360)
    expect(board.top).toBeGreaterThan(box($('.brd-tagline')).bottom)
    expect(Math.abs(centreOf(board) - (window.innerHeight / 2 + 60))).toBeLessThan(2)
    // The gold road on Board's line, from past it into the hub on the
    // same line.
    const road = box($('.desk-front__way'))
    const hub = box($('.desk-front__hub'))
    expect(Math.abs(centreOf(road) - centreOf(board))).toBeLessThan(2)
    expect(Math.abs(centreOf(hub) - centreOf(board))).toBeLessThan(2)
    expect(road.left).toBeGreaterThan(board.right)
    expect(road.right).toBeGreaterThan(hub.left)
    expect(getComputedStyle($('.desk-front__way')).stroke).toBe(paintOf('--accent2'))
    // Seven lines out of the hub, each in its own pigment to its sign,
    // named; every sign on the paper, right of the way in and under the
    // corner, and clear of the others.
    const stns = [...document.querySelectorAll('.desk-front__stn')]
    expect(stns.map(s => s.dataset.line)).toEqual(LINES)
    expect(new Set(stns.map(s => getComputedStyle(s.querySelector('.desk-front__sign')).borderTopColor)).size).toBe(7)
    for (const road of document.querySelectorAll('.desk-front__road')) {
      const sign = $(`.desk-front__stn[data-line="${road.dataset.line}"] .desk-front__sign`)
      expect(getComputedStyle(road).stroke).toBe(getComputedStyle(sign).borderTopColor)
    }
    for (const s of stns) {
      expect([en.brdDemoTag[s.dataset.line], fr.brdDemoTag[s.dataset.line]]).toContain(s.querySelector('.desk-front__name').textContent)
      const r = box(s)
      expect(r.left, s.dataset.line).toBeGreaterThan(board.right)
      expect(r.right, s.dataset.line).toBeLessThanOrEqual(bodyW())
      expect(r.top, s.dataset.line).toBeGreaterThan(box($('.desk-front__door')).bottom)
      expect(r.bottom, s.dataset.line).toBeLessThanOrEqual(window.innerHeight)
    }
    for (let i = 0; i < stns.length; i++) {
      for (let j = i + 1; j < stns.length; j++) {
        const a = box(stns[i])
        const b = box(stns[j])
        const apart = a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top
        expect(apart, `${stns[i].dataset.line} / ${stns[j].dataset.line}`).toBe(true)
      }
    }
    // One filled action; the other way in plain, in the top-right corner
    // at the paper's margin.
    expect(getComputedStyle($('[data-action="board"]')).backgroundColor).not.toBe('rgba(0, 0, 0, 0)')
    const corner = $('[data-action="sign-in"]')
    expect([en.loginBtn, fr.loginBtn]).toContain(corner.textContent)
    expect(getComputedStyle(corner).backgroundColor).toBe('rgba(0, 0, 0, 0)')
    expect(Math.round(bodyW() - box(corner).right)).toBe(44)
    expect(box(corner).bottom).toBeLessThan(hub.top)
    expect(document.querySelectorAll('h1')).toHaveLength(1)
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth)
    // Nothing is focused, so Enter boards.
    expect(document.activeElement).toBe(document.body)
  })

  it('puts the sign-in in the promise\'s place from the corner, its action where Board stood, and back', async () => {
    const onBoard = vi.fn()
    const onSignIn = vi.fn()
    const onBack = vi.fn()
    const screen = await render(<Door onBoard={onBoard} onSignIn={onSignIn} onBack={onBack} />)
    // Measured once the way in's entrance has landed.
    await settle(800)
    const boardAt = box($('[data-action="board"]'))
    const hubAt = box($('.desk-front__hub'))
    await userEvent.click($('[data-action="sign-in"]'))
    expect(onSignIn).toHaveBeenCalledTimes(1)
    await screen.rerender(<Door authMode="login" onBoard={onBoard} onSignIn={onSignIn} onBack={onBack} />)
    await settle(150)
    // Named plainly, signing in only: no Login / Sign up control, no foot.
    expect([en.login, fr.login]).toContain($('h1').textContent)
    expect(document.querySelectorAll('h1')).toHaveLength(1)
    expect(inBlock('.seg')).toBeNull()
    expect(inBlock('.auth-foot')).toBeNull()
    expect(document.activeElement).toBe(inBlock('input[type="email"]'))
    // Its action is Board's place on the road, filled; the map stays.
    const submit = $('[data-action="auth-submit"]')
    expect([en.loginBtn, fr.loginBtn]).toContain(submit.querySelector('.btn-depart__jp').textContent)
    const at = box(submit)
    expect([at.left, at.top, at.width].map(Math.round)).toEqual([boardAt.left, boardAt.top, boardAt.width].map(Math.round))
    expect(box($('.desk-front__hub'))).toEqual(hubAt)
    expect($('[data-action="board"]')).toBeNull()
    expect(document.querySelectorAll('.btn-depart')).toHaveLength(1)
    // No card on the paper; its fields the page's wells.
    expect(getComputedStyle(inBlock('.auth-card')).backgroundColor).toBe('rgba(0, 0, 0, 0)')
    expect(getComputedStyle(inBlock('input[type="email"]')).backgroundColor).toBe(paintOf('--surface'))
    // Enter is the form's: typing and Enter do not board.
    await userEvent.keyboard('aiko@example.com{Enter}')
    await settle()
    expect(onBoard).not.toHaveBeenCalled()
    // The corner offers the other way in, Board.
    const corner = $('[data-action="board-corner"]')
    expect([en.brdBoard, fr.brdBoard]).toContain(corner.textContent)
    expect($('[data-action="sign-in"]')).toBeNull()
    await userEvent.click(corner)
    expect(onBoard).toHaveBeenCalledTimes(1)
    // And the way back to the promise, at the block's left edge.
    const back = $('[data-action="welcome"]')
    expect(Math.round(box(back).left)).toBe(Math.round(boardAt.left))
    await userEvent.click(back)
    expect(onBack).toHaveBeenCalledTimes(1)
  })

  it('opens on Sign up, both sides named, when Board could not issue a pass', async () => {
    await render(<Door authMode="signup" />)
    await settle(800)
    expect([en.signup, fr.signup]).toContain($('h1').textContent)
    const sides = [...inBlock('.seg').querySelectorAll('.seg__opt')]
    expect(sides.map(o => o.getAttribute('aria-checked'))).toEqual(['false', 'true'])
    expect(inBlock('.auth-foot')).not.toBeNull()
    expect(document.activeElement).toBe(inBlock('input[type="email"]'))
    // Both sides named, and still one action on the road.
    expect(document.querySelectorAll('.btn-depart')).toHaveLength(1)
    const submit = box($('[data-action="auth-submit"]'))
    expect(Math.abs(centreOf(submit) - (window.innerHeight / 2 + 60))).toBeLessThan(2)
    expect(box(inBlock('.auth-foot')).top).toBeGreaterThan(submit.bottom)
  })

  it('draws the crossroads for the paper it has, the lines shorter on a laptop', async () => {
    await render(<Door />)
    await settle(150)
    const reach = () => {
      const hub = box($('.desk-front__hub'))
      const kanji = box($('.desk-front__stn[data-line="kanji"] .desk-front__sign'))
      return Math.round(mid(kanji) - mid(hub))
    }
    // 1100 x 800: the lines the paper leaves, past the way in's column
    // and the names on the left.
    const laptop = reach()
    expect(laptop).toBeGreaterThanOrEqual(120)
    expect(laptop).toBeLessThan(240)
    // Every name clear of the paper's right edge by its margin.
    const names = [...document.querySelectorAll('.desk-front__name')].map(n => box(n).right)
    expect(Math.max(...names)).toBeLessThanOrEqual(bodyW() - 44 + 1)
  })

  it('keeps the Welcome up for a refused Google return, the reason with the sign-in', async () => {
    refusal.current = { error: 'access_denied', code: null, description: 'denied' }
    window.history.replaceState(null, '', '/')
    await render(<App />)
    await settle(300)
    expect($('.brd--welcome')).not.toBeNull()
    expect($('main.auth')).toBeNull()
    expect(inBlock('.auth-message--error')).not.toBeNull()
    expect(document.activeElement).toBe(inBlock('input[type="email"]'))
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

// ── P13 — first contact, finished (plans 155, 163) ──
// The owner's ask: keep the drawing and make it smooth. The way on
// stands in one place on every question -- since plan 163 the paper's
// bottom-right corner; the stop being asked is lit on the strip and the
// light moves with the question; each answer's key turns over to its
// check in one slot; the Welcome hands its paper to the wait with the
// dots on one spot; the plan's arrival boards the paper; and a car is
// not dropped before the one after it has landed.
const { default: AppLoading } = await import('./screens/AppLoading')
const landed = () => settle(900)
const centreY = r => (r.top + r.bottom) / 2
const opacityOf = el => Number(getComputedStyle(el).opacity)

describe('first contact, finished (P13, plan 155)', () => {
  it('stands the way on where it stood, on every question', async () => {
    await board()
    const floors = []
    const read = async () => {
      await landed()
      const go = box(inCar('[data-action="continue"]'))
      const back = box(inCar('[data-action="back"]'))
      floors.push({ step: stepOf(), go: [Math.round(go.right), Math.round(go.top)], width: Math.round(go.width), gap: Math.round(go.left - back.right) })
    }
    await read()                          // name
    await pastName()
    await pick('[data-motive="trip"]')
    await read()                          // why, the six roads
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
    // Continue's end and its top in the corner on every question, Back a
    // rung before it. At 1100 the ticket gives some of its width to the
    // strip, and a little more once both scripts are read and the level
    // joins it -- never so much that its label wraps.
    for (const f of floors) {
      expect(f.go, f.step).toEqual(floors[0].go)
      expect(f.gap, f.step).toBe(12)
      expect(f.width, f.step).toBeGreaterThanOrEqual(240)
      expect(f.width, f.step).toBeLessThanOrEqual(360)
    }
  })

  it('lights the stop being asked, and moves the light with the question', async () => {
    await board()
    const lit = () => strip().querySelector('[aria-current="step"]')?.dataset.stop
    const ring = key => box(stop(key).querySelector('.desk-brd__sp-dot'))
    await landed()
    expect(lit()).toBe('name')
    // The lit stop's ring is the phone track's "here", larger than a dot.
    expect(Math.round(ring('name').width)).toBe(16)
    expect(Math.round(ring('why').width)).toBe(10)
    await pastName()
    await landed()
    expect(lit()).toBe('why')
    expect(Math.round(ring('name').width)).toBe(10)
    await pick('[data-motive="trip"]')
    await next()
    await landed()
    expect(lit()).toBe('kana')
    doorOf('name').click()
    await landed()
    expect(lit()).toBe('name')
    await next()
    await landed()
    expect(lit()).toBe('why')
  })

  it('turns an answer\'s key over to its check, in one slot', async () => {
    await board()
    await pastName()
    await landed()
    const row = inCar('[data-motive="fun"]')
    const key = () => row.querySelector('.desk-brd__key')
    const tick = () => row.querySelector('.desk-brd__tick')
    // One slot, beside a reason's name (the six roads, plan 163).
    expect(row.querySelectorAll('.desk-kbd')).toHaveLength(1)
    expect(row.querySelector('.brd-opt__check')).toBeNull()
    expect(key().textContent).toBe('2')
    expect(opacityOf(key())).toBeGreaterThan(0.5)
    expect(opacityOf(tick())).toBe(0)
    await pick('[data-motive="fun"]')
    await settle(300)
    expect(opacityOf(key())).toBe(0)
    expect(opacityOf(tick())).toBe(1)
    // A kana answer's in its tile's top right corner.
    await next()
    await landed()
    // Inside the tile's border, --sp-2 (6px) from its edges.
    const corner = el => {
      const m = box(el.querySelector('.desk-brd__mark'))
      const t = box(el)
      return [Math.round(t.right - el.clientLeft - m.right), Math.round(m.top - t.top - el.clientTop)]
    }
    expect(corner(inCar('[data-kana="hiragana"]'))).toEqual([6, 6])
    // A station's on its ring's shoulder, clear of its code and the rail
    // through its middle (the climbing line, plan 163).
    await pick('[data-kana="both"]')
    await landed()
    const ring = box(inCar('[data-level="N5"] .desk-brd__stop-ring'))
    const mark = box(inCar('[data-level="N5"] .desk-brd__mark'))
    expect(mid(mark)).toBeGreaterThan(ring.right - ring.width / 4)
    expect(cy(mark)).toBeLessThan(ring.top + ring.height / 4)
    expect(kbdOf(inCar('[data-level="N5"]'))).toBe('5')
    expect(inCar('.desk-brd__chk')).toBeNull()
  })

  it('draws the rhythms as four roads from today, the shorter ride the sooner stop', async () => {
    await board()
    await toLevel()
    await pick('[data-level="N3"]')
    await next()
    await next()
    await next()
    expect(stepOf()).toBe('rhythm')
    await landed()
    const rides = [...inCar('.desk-brd__rides').querySelectorAll('.desk-brd__ride')]
    expect(rides.map(r => r.dataset.rhythm)).toEqual(['5', '10', '15', '20'])
    expect([en.nudgeWhen.today, fr.nudgeWhen.today]).toContain(inCar('.desk-brd__ride-cap--today').textContent)
    // Each road as long as its ride: the more minutes, the sooner.
    const ends = rides.map(r => Number(getComputedStyle(r).getPropertyValue('--end')))
    const days = rides.map(r => Number(r.querySelector('.desk-brd__ride-days').textContent.match(/\d+/)[0]))
    for (let i = 1; i < 4; i++) {
      expect(ends[i]).toBeLessThan(ends[i - 1])
      expect(days[i]).toBeLessThan(days[i - 1])
    }
    for (const r of rides) expect(r.querySelector('.desk-brd__ride-when').textContent).toMatch(/20\d\d/)
    // The recommended rhythm is picked from the start, on the band, its
    // tag beside its name.
    const band = () => box(inCar('.desk-brd__ride-band'))
    expect(inCar('[data-rhythm="10"]').getAttribute('aria-pressed')).toBe('true')
    expect(Math.abs(band().top - box(rides[1]).top)).toBeLessThan(1.5)
    expect([en.onbPaceRecommended, fr.onbPaceRecommended]).toContain(inCar('[data-rhythm="10"] .brd-tag').textContent)
    // Its digit moves the pick, the band with it.
    await userEvent.keyboard('4')
    expect(inCar('[data-rhythm="20"]').getAttribute('aria-pressed')).toBe('true')
    expect(Math.abs(band().top - box(rides[3]).top)).toBeLessThan(1.5)
    // The rows one under another, each whole on the paper.
    rides.reduce((a, b) => { expect(box(b).top).toBeGreaterThanOrEqual(box(a).bottom - 0.5); return b })
    for (const r of rides) {
      expect(box(r.querySelector('.desk-brd__ride-arr')).right).toBeLessThanOrEqual(bodyW())
      expect(box(r).bottom).toBeLessThan(box(inCar('.brd__foot')).top)
    }
  })

  it('draws the hour as the day\'s arc, the train riding it by the half hour', async () => {
    await board()
    await toLevel()
    await toTime()
    await landed()
    expect([en.brdTimeHint, fr.brdTimeHint]).toContain(inCar('.brd__hint').textContent)
    const ring = id => box(inCar(`[data-hour="${id}"] .desk-brd__hour-ring`))
    // Morning low at the left, noon at the crown, night low at the right.
    expect(mid(ring('am'))).toBeLessThan(mid(ring('noon')))
    expect(mid(ring('noon'))).toBeLessThan(mid(ring('pm')))
    expect(ring('noon').top).toBeLessThan(ring('am').top)
    expect(ring('noon').top).toBeLessThan(ring('pm').top)
    // The morning's ride is the day's to begin with: the train stands on
    // its station, and the station is the train.
    const train = () => inCar('[role="slider"]')
    expect(inCar('[data-hour="am"]').getAttribute('aria-pressed')).toBe('true')
    expect(train().getAttribute('aria-valuetext')).toBe('07:30')
    expect(train().classList.contains('desk-brd__train--docked')).toBe(true)
    // A half hour on: off the station, on the arc, the stretch behind it
    // gold to its centre -- and still the morning.
    train().focus()
    await userEvent.keyboard('{ArrowRight}')
    expect(train().getAttribute('aria-valuetext')).toBe('08:00')
    expect(train().classList.contains('desk-brd__train--docked')).toBe(false)
    expect(inCar('[data-hour="am"]').getAttribute('aria-pressed')).toBe('true')
    const map = box(inCar('.desk-brd__sky-map'))
    const [ex, ey] = inCar('.desk-brd__arc--done').getAttribute('d').match(/(-?[\d.]+) (-?[\d.]+)$/).slice(1).map(Number)
    expect(Math.abs(map.left + ex - mid(box(train())))).toBeLessThan(1)
    expect(Math.abs(map.top + ey - cy(box(train())))).toBeLessThan(1)
    // A ride's digit takes the train to its hour; the board says it.
    await userEvent.keyboard('3')
    expect(inCar('[data-hour="pm"]').getAttribute('aria-pressed')).toBe('true')
    expect(train().getAttribute('aria-valuetext')).toBe('21:00')
    await settle(1400)
    expect(inCar('.brd-board__flaps').getAttribute('aria-label')).toBe('21:00')
    // Taken by the arc under the pointer, by the half hour.
    const at15 = [...inCar('.desk-brd__sky-map').querySelectorAll('.desk-brd__hour')].find(h => h.textContent === '15')
    const at = box(at15)
    inCar('.desk-brd__sky').dispatchEvent(new PointerEvent('pointerdown', { clientX: mid(at), clientY: cy(at), pointerId: 7, buttons: 1, bubbles: true }))
    await settle(40)
    expect(['14:30', '15:00', '15:30']).toContain(train().getAttribute('aria-valuetext'))
    // ...and not by the board in the bowl.
    const was = train().getAttribute('aria-valuetext')
    const sheet = box(inCar('.desk-brd__sky-board'))
    inCar('.desk-brd__sky-board').dispatchEvent(new PointerEvent('pointerdown', { clientX: mid(sheet), clientY: cy(sheet), pointerId: 8, buttons: 1, bubbles: true }))
    await settle(40)
    expect(train().getAttribute('aria-valuetext')).toBe(was)
    expect(fits(inCar('.brd__body'))).toBe(true)
  })

  it('draws the lines as three cards under the kana\'s ticket, each with what it carries', async () => {
    await board()
    await toLevel()
    await pick('[data-level="N3"]')
    await next()
    await next()
    expect(stepOf()).toBe('lines')
    await landed()
    expect([en.brdOnEveryTicket, fr.brdOnEveryTicket]).toContain(inCar('.desk-brd__ticket-lock').textContent)
    const cards = [...inCar('.desk-brd__lines').children]
    expect(cards.map(c => c.dataset.line)).toEqual(['vocab', 'kanji', 'grammar'])
    expect(new Set(cards.map(c => Math.round(box(c).top))).size).toBe(1)
    for (const c of cards) expect(c.querySelector('.desk-brd__line-fig').textContent).toMatch(/^~\d/)
    // The arrival moves as a line comes off, and goes with the last one.
    const arrival = () => inCar('.desk-brd__first')?.textContent ?? null
    const before = arrival()
    expect(before).toMatch(/N2/)
    await pick('[data-line="vocab"]')
    expect(inCar('[data-line="vocab"]').getAttribute('aria-pressed')).toBe('false')
    expect(arrival()).not.toBe(before)
    await pick('[data-line="kanji"]')
    await pick('[data-line="grammar"]')
    expect(arrival()).toBeNull()
    expect(inCar('.brd__error')).not.toBeNull()
    expect(inCar('[data-action="continue"]').disabled).toBe(true)
  })

  it('hands the Welcome\'s paper to the wait', async () => {
    const dotsAt = () => {
      const r = box($('.desk-wait .loading'))
      return [Math.round(mid(r)), Math.round(centreY(r))]
    }
    const screen = await render(<Door />)
    await landed()
    expect($('.desk-wait')).toBeNull()
    await screen.rerender(<Door boarding />)
    await settle(300)
    // The way in and the corner pull away, the map a beat after them.
    expect($('.desk-front').classList.contains('desk-front--leaving')).toBe(true)
    expect(opacityOf($('.desk-front__block'))).toBe(0)
    expect(opacityOf($('.desk-front__door'))).toBe(0)
    // The pass being issued: its dots a beat after the press, on the
    // paper's middle.
    expect(opacityOf($('.desk-wait'))).toBe(0)
    await landed()
    expect(opacityOf($('.desk-front__map'))).toBe(0)
    expect(opacityOf($('.desk-front__hub'))).toBe(0)
    expect(opacityOf($('.desk-wait'))).toBe(1)
    const dots = dotsAt()
    expect(Math.abs(dots[0] - bodyW() / 2)).toBeLessThan(2)
    await screen.unmount()
    // The wait after it, handed the press a second ago: the same paper,
    // no column, the same dots on the same spot, already drawn.
    const wait = await render(<LangProvider><AppLoading wakesServer frame since={performance.now() - 1000} /></LangProvider>)
    await settle(60)
    expect($('.desk-rail__mast')).toBeNull()
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
  })

  it('brings the Welcome back when no pass could be issued', async () => {
    const screen = await render(<Door boarding />)
    await landed()
    await screen.rerender(<Door authMode="signup" />)
    await landed()
    expect($('.desk-front').classList.contains('desk-front--leaving')).toBe(false)
    expect(opacityOf($('.desk-front__block'))).toBe(1)
    expect(opacityOf($('.desk-front__map'))).toBe(1)
    expect(opacityOf($('.desk-front__hub'))).toBe(1)
    expect([en.signup, fr.signup]).toContain($('h1').textContent)
  })

  it('boards the plan\'s arrival on the whole paper, no column beside it', async () => {
    await board()
    await toLevel()
    await toTime()
    await next()
    await settle(200)
    const sign = $('.onb-arrival__board')
    expect(sign).not.toBeNull()
    expect(Math.abs(mid(box(sign)) - bodyW() / 2)).toBeLessThan(2)
    expect(Math.round(box($('.onb-arrival__scrim')).left)).toBe(0)
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

describe('the hover, simpler (P14, plan 155)', () => {
  it('draws the name field\'s gold edge on an answer, and nothing else', async () => {
    await board()
    await settle(300)
    const gold = getComputedStyle(inCar('.brd-field')).borderTopColor
    await pastName()
    await landed()
    // A reason: its ring takes the edge (the six roads, plan 163).
    const way = inCar('[data-motive="fun"]')
    const ring = way.querySelector('.desk-brd__ring')
    const ground = getComputedStyle(ring).backgroundColor
    await userEvent.hover(way)
    await settle(250)
    expect(getComputedStyle(way).filter).toBe('none')
    expect(getComputedStyle(ring).borderTopColor).toBe(gold)
    // No wash: the ground it had at rest.
    expect(getComputedStyle(ring).backgroundColor).toBe(ground)
    await userEvent.hover(inCar('[data-action="back"]'))
    await settle(250)
    expect(getComputedStyle(inCar('[data-action="back"]')).filter).toBe('none')
  })

  it('focuses the name with one gold edge, no second ring', async () => {
    await board()
    const field = inCar('.brd-field')
    expect(document.activeElement).toBe(field)
    await settle(300)
    const focused = getComputedStyle(field)
    expect(focused.outlineStyle).toBe('none')
    const gold = focused.borderTopColor
    field.blur()
    await settle(200)
    // At rest, filled, the answers' hairline: the gold is the focus alone.
    expect(field.value).toBe('Tester')
    expect(getComputedStyle(field).borderTopColor).not.toBe(gold)
  })
})
