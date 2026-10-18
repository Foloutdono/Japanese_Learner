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
// block of deskfree.phone.test.jsx. Since plan 247 the boarding asks
// the kana and a reader's level, then hands the card filled in, every
// printed field a door to a sheet -- on the desk a dialog in the
// paper's middle.
//
// The keys (P8): Enter goes on from anywhere in the live car, pressing
// the screen's own Continue, which prints the key. A field, an answer
// not yet picked, ‹ and a link keep their own Enter; an answer already
// picked, or one the pointer just pressed, does not -- Enter goes on
// with the pick as it stands. Nothing under a dialog -- a sheet's keys
// are the sheet's -- and no Esc.

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
const sheet = () => $('.brd-sheet')
const inSheet = s => sheet()?.querySelector(s) ?? null
const completes = () => apiJsonWithTimeout.mock.calls.filter(c => c[0] === '/api/onboarding/complete')
const posted = () => JSON.parse(completes()[0][2].body)

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
      <BoardingFlow session={{ access_token: 'tok' }} onComplete={onComplete} onExit={onExit} guest={guest} />
    </LangProvider>
  )
  await settle(150)
}

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
// A door of the card opens its sheet, a dialog in the paper's middle.
async function door(page) { inCar(`[data-door="${page}"]`).click(); await settle(300); expect(sheet(), page).not.toBeNull() }
async function shut() { await userEvent.keyboard('{Escape}'); await settle(200); expect(sheet()).toBeNull() }
// Tops as the eye reads them, once the answers' entrance has landed.
const rowsOf = els => new Set(els.map(el => Math.round(box(el).top / 4)))

/** The kana, both scripts read, to the level list. */
async function toLevel() {
  expect(stepOf()).toBe('kana')
  await pick('[data-kana="both"]')
  await settle()
  expect(stepOf()).toBe('level')
}
/** From the level list, at `level`, to the card. */
async function toCard(level = 'N3') {
  await pick(`[data-level="${level}"]`)
  await next()
  expect(stepOf()).toBe('card')
}
const fits = el => el.scrollHeight <= el.clientHeight + 1

describe('Enter at first contact (P8)', () => {
  it('prints the key on every Continue it presses, and goes on from the question', async () => {
    await board()
    // The kana's answers go on by themselves: no Continue to print it on.
    expect(inCar('.btn-depart')).toBeNull()
    await toLevel()
    const cap = () => inCar('.btn-depart')
    expect(cap().getAttribute('aria-keyshortcuts')).toBe('Enter')
    expect(cap().querySelector('.desk-kbd')).not.toBeNull()
    // The question has the focus on a new screen: Enter goes on only
    // once there is an answer to go on with.
    expect(document.activeElement).toBe(inCar('.brd__q'))
    await enter()
    await settle()
    expect(stepOf()).toBe('level')
    await userEvent.click(inCar('[data-level="N3"]'))
    await enter()
    await settle()
    expect(stepOf()).toBe('card')
    // The card's gate names it too, and Enter issues the card.
    expect(inCar('[data-action="issue"]').getAttribute('aria-keyshortcuts')).toBe('Enter')
    expect(inCar('[data-action="issue"] .desk-kbd')).not.toBeNull()
    await enter()
    await settle()
    expect(completes()).toHaveLength(1)
  })

  it('leaves an answer not yet picked its own Enter, and goes on from a picked one', async () => {
    await board()
    await toLevel()
    inCar('[data-level="N2"]').focus()
    await enter()
    await settle()
    expect(stepOf()).toBe('level')
    expect(inCar('[data-level="N2"]').getAttribute('aria-pressed')).toBe('true')
    await enter()
    await settle()
    expect(stepOf()).toBe('card')
  })

  it('keeps a sheet\'s keys its own, and goes on from the card with what it set', async () => {
    await board()
    await toLevel()
    await toCard('N1')
    await door('lines')
    await userEvent.click(inSheet('[data-line="kanji"]'))
    expect(inSheet('[data-line="kanji"]').getAttribute('aria-pressed')).toBe('false')
    // Under the sheet the card's gate is not Enter's: nothing is issued.
    document.activeElement?.blur?.()
    await enter()
    await settle()
    expect(completes()).toHaveLength(0)
    expect(sheet()).not.toBeNull()
    // Shut, the card prints what the sheet set, and Enter issues it.
    await shut()
    expect(inCar('[data-door="lines"]').querySelectorAll('.pcb__line')).toHaveLength(2)
    document.activeElement?.blur?.()
    await enter()
    await settle()
    expect(posted().lines).toEqual(['vocab', 'grammar'])
  })

  it('does nothing under a dialog, and nothing on Esc', async () => {
    await board()
    await toLevel()
    await userEvent.click(inCar('[data-level="N3"]'))
    const modal = document.createElement('div')
    modal.setAttribute('aria-modal', 'true')
    modal.dataset.probeModal = ''
    document.body.appendChild(modal)
    await enter()
    await settle()
    expect(stepOf()).toBe('level')
    modal.remove()
    await userEvent.keyboard('{Escape}')
    await settle()
    expect(stepOf()).toBe('level')
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

// ── P9 — the boarding frame (plans 122, 140, 163, 247) ──
// Plan 163, the owner's pick D of the canvas "Tsuji — onboarding, new
// directions": the sumi column goes, and three places never move. The
// question at the paper's top-left corner; the journey as a strip at the
// floor's left end, a named stop per question, the answer given said on
// its stop and a stop behind a door back to its question (plan 140's
// rules); the floor in the bottom-right corner, Back beside Continue.
// Since plan 247 the stops are the kana, a reader's level and the card,
// and the card is the last screen: its gate issues it.

describe('the boarding frame on the desk (P9, plans 140, 163, 247)', () => {
  it('draws the journey as a strip at the floor\'s left end, a stop per question, and keeps it to the card', async () => {
    const onComplete = vi.fn()
    await board({ onComplete })
    expect($('main.brd').className).toBe('brd desk-brd')
    // One drawing of the line: no head, no track, and no column.
    expect($('.brd__head')).toBeNull()
    expect($('.brd__track')).toBeNull()
    expect(side()).toBeNull()
    // The reveal is the kana's own stop; the level joins once both are read.
    expect(stops()).toEqual(['kana', 'card'])
    await toLevel()
    expect(stops()).toEqual(['kana', 'level', 'card'])
    await settle(600)
    // On the floor's line, at its left end, clear of the way back.
    const at = box(strip())
    expect(Math.abs(cy(at) - cy(box(inCar('[data-action="continue"]'))))).toBeLessThan(1.5)
    expect(Math.round(at.left)).toBe(Math.round(box(inCar('.brd__q')).left))
    expect(at.right).toBeLessThan(box(inCar('[data-action="level-test"]')).left)
    await toCard()
    // The strip stays, the questions behind the card doors back to them.
    expect(stops().map(stateOf)).toEqual(['done', 'done', 'now'])
    expect(doorOf('kana')).not.toBeNull()
    expect(doorOf('level')).not.toBeNull()
    expect(doorOf('card')).toBeNull()
    // The card is the last screen: its gate posts the contract.
    const go = inCar('[data-action="issue"]')
    expect([en.brdIssue, fr.brdIssue]).toContain(go.querySelector('.btn-depart__jp').textContent)
    await enter()
    await settle()
    expect(apiJsonWithTimeout).toHaveBeenCalledWith('/api/onboarding/complete', expect.anything(), expect.anything())
    expect(onComplete).toHaveBeenCalledTimes(1)
    // The kana answer goes with it: App decides the first ride on it.
    expect(onComplete).toHaveBeenCalledWith({ kanaKnown: 'both' })
    expect(stepOf()).toBe('card')
  })

  it('says each answer on its stop, the pick as it stands, and lights the one asked', async () => {
    await board()
    expect(stops().map(stateOf)).toEqual(['now', 'next'])
    expect(stop('kana').getAttribute('aria-current')).toBe('step')
    expect(valueOf('kana')).toBeNull()
    await toLevel()
    expect(stateOf('kana')).toBe('done')
    expect([en.brdKana.both, fr.brdKana.both]).toContain(valueOf('kana'))
    // Said, not printed: a pointer's title and the stop's read-out name.
    expect(stop('kana').querySelector('.desk-brd__sp-door').title).toMatch(/ · /)
    expect(stateOf('level')).toBe('now')
    expect(valueOf('level')).toBeNull()
    await pick('[data-level="N3"]')
    // Said before Continue: the answer's stop reads it at once.
    expect(valueOf('level')).toBe('N3')
    // A stop ahead says nothing.
    expect(stateOf('card')).toBe('next')
    expect(valueOf('card')).toBeNull()
    await next()
    expect(stateOf('level')).toBe('done')
    expect(stateOf('card')).toBe('now')
  })

  it('opens a passed stop\'s question in one pull, every answer kept', async () => {
    await board()
    await toLevel()
    await toCard('N3')
    doorOf('kana').click()
    await settle()
    expect(stepOf()).toBe('kana')
    expect(inCar('[data-kana="both"]').getAttribute('aria-pressed')).toBe('true')
    expect(stateOf('kana')).toBe('now')
    // The way on is the way it was, the answers after it kept.
    await pick('[data-kana="both"]')
    await settle()
    expect(stepOf()).toBe('level')
    expect(inCar('[data-level="N3"]').getAttribute('aria-pressed')).toBe('true')
    await next()
    expect(stepOf()).toBe('card')
    // The card's origin is a door back to the question that set it.
    inCar('[data-door="level"]').click()
    await settle()
    expect(stepOf()).toBe('level')
    expect(inCar('[data-level="N3"]').getAttribute('aria-pressed')).toBe('true')
    // ‹ on the floor goes back one question, as it always did.
    inCar('[data-action="back"]').click()
    await settle()
    expect(stepOf()).toBe('kana')
  })

  it('stands Back beside Continue in the bottom-right corner, and leaves from the first question', async () => {
    const onExit = vi.fn()
    await board({ onExit })
    await settle(600)
    // The kana: the way back on a floor of its own, out of the boarding.
    const out = inCar('.desk-brd__floor [data-action="back"]')
    expect(out).not.toBeNull()
    expect(inCar('.btn-depart')).toBeNull()
    await toLevel()
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
    await settle()
    expect(stepOf()).toBe('kana')
    inCar('[data-action="back"]').click()
    expect(onExit).toHaveBeenCalledTimes(1)
  })

  it('sets the question in the top-left corner and its answers in the paper under it', async () => {
    await board()
    // Measured once the answers' entrance has landed (brd-in, 6px).
    await settle(900)
    // The kana's four answers on one row, under the words, and the way
    // back on a floor of its own: no Continue there to stand beside.
    expect(rowsOf([...inCar('.brd-grid').children]).size).toBe(1)
    await toLevel()
    await settle(900)
    const q = box(inCar('.brd__q'))
    const climb = box(inCar('.desk-brd__climb'))
    const foot = box(inCar('.brd__foot'))
    // The question at the corner, --sp-7 and --sp-6 under the window's
    // top, set left -- and at the display rung: 1100x800 is no short step.
    expect(Math.round(q.left)).toBe(Math.round(box(strip()).left))
    expect(Math.round(q.top)).toBe(50)
    expect(getComputedStyle(inCar('.brd__q')).fontSize).toBe('40px')
    expect(getComputedStyle(inCar('.brd__q')).textAlign).toBe('start')
    // The answers across the paper, between the question and the floor.
    expect(Math.abs(mid(climb) - bodyW() / 2)).toBeLessThan(1.5)
    expect(climb.top).toBeGreaterThan(box(inCar('.brd__hint')).bottom)
    expect(climb.bottom).toBeLessThan(foot.top)
  })

  it('hangs the kana\'s four answers from the two words, each drawn as what it reads', async () => {
    await board()
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

  it('draws the level as the line climbing from the hub, the pick hung with its callout, and the goal\'s sheet riding on from it', async () => {
    await board()
    await toLevel()
    await settle(900)
    const climb = () => inCar('.desk-brd__climb')
    const stations = () => [...climb().querySelectorAll('.desk-brd__stop')]
    const ring = el => box(el.querySelector('.desk-brd__stop-ring'))
    const stationOf = el => el.className.match(/desk-brd__stop--(\w+)/)?.[1] ?? null
    expect([en.brdLevelHint, fr.brdLevelHint]).toContain(inCar('.brd__hint').textContent)
    expect(stations().map(s => s.dataset.level)).toEqual(['novice', 'N5', 'N4', 'N3', 'N2', 'N1'])
    // A step up and to the right a level, from the hub at the line's foot,
    // which prints the question's place on the strip.
    const hub = climb().querySelector('.desk-brd__hub')
    expect(hub.textContent).toBe('02')
    const rings = stations().map(ring)
    ;[box(hub), ...rings].reduce((before, r) => {
      expect(mid(r)).toBeGreaterThan(mid(before))
      expect(cy(r)).toBeLessThan(cy(before))
      return r
    })
    // Each stop's name and holdings under its ring, clear of the next
    // stop's, and the whole line on the paper, over the floor.
    const q = box(inCar('.brd__q'))
    const labels = stations().map(s => box(s.querySelector('.desk-brd__stop-lab')))
    labels.forEach((l, i) => {
      expect(l.top, stations()[i].dataset.level).toBeGreaterThan(rings[i].bottom)
      if (i < labels.length - 1) expect(l.right, stations()[i].dataset.level).toBeLessThanOrEqual(labels[i + 1].left)
      expect(l.right).toBeLessThanOrEqual(bodyW() - q.left + 0.5)
      expect(l.bottom).toBeLessThan(box(inCar('.brd__foot')).top)
    })
    expect(rings[5].top).toBeGreaterThan(box(inCar('.brd__hint')).bottom)
    expect([...inCar('[data-level="N5"] .desk-brd__stop-desc').children]).toHaveLength(2)
    expect(inCar('.desk-brd__call')).toBeNull()
    // The pick: the stops behind it filled, the line inked up to it, and
    // "You are here" hung over its ring.
    await pick('[data-level="N4"]')
    expect(stations().map(stationOf)).toEqual(['known', 'known', 'on', null, null, null])
    expect(inCar('[data-level="N4"]').getAttribute('aria-pressed')).toBe('true')
    expect(climb().querySelectorAll('.desk-brd__rail--known')).toHaveLength(1)
    const call = inCar('.desk-brd__call')
    expect([en.levelCurrentMark, fr.levelCurrentMark]).toContain(call.querySelector('.desk-brd__call-cap').textContent)
    expect(call.querySelector('.desk-brd__call-fig').textContent).toBe('N4')
    expect(Math.abs(mid(box(call)) - mid(ring(inCar('[data-level="N4"]'))))).toBeLessThan(1)
    expect(box(call).bottom).toBeLessThan(ring(inCar('[data-level="N4"]')).top)
    // The goal, the card's destination: the stops ahead, the hardest on
    // top, where the learner stands under them and no answer; the next
    // one is the card's to begin with, each priced with its day.
    await next()
    expect(inCar('[data-door="destination"] .pcb__code').textContent).toBe('N3')
    await door('destination')
    const goals = () => [...sheet().querySelectorAll('.brd-goal')]
    expect([...sheet().querySelectorAll('[data-goal]')].map(g => g.dataset.goal)).toEqual(['N1', 'N2', 'N3'])
    expect(goals().at(-1).classList.contains('brd-goal--here')).toBe(true)
    expect(goals().at(-1).tagName).toBe('SPAN')
    expect(inSheet('[data-goal="N3"]').getAttribute('aria-pressed')).toBe('true')
    for (const g of sheet().querySelectorAll('[data-goal] .brd-goal__date')) expect(g.textContent).toMatch(/20\d\d/)
    // A pick shuts the sheet and reprints the card; open again, the ride
    // runs in gold from where the learner stands to it.
    inSheet('[data-goal="N2"]').click()
    await settle(300)
    expect(sheet()).toBeNull()
    expect(inCar('[data-door="destination"] .pcb__code').textContent).toBe('N2')
    await door('destination')
    expect(goals().map(g => g.className.match(/brd-goal--(\w+)/)?.[1] ?? null)).toEqual([null, 'on', 'ride', 'here'])
    expect(inSheet('.brd-goals__ride')).not.toBeNull()
  })

  it('rides a learner short of the kana from 初, the novice\'s own stop among the goals', async () => {
    await board()
    await pick('[data-kana="none"]')
    await settle()
    expect(stepOf()).toBe('reveal')
    await next()
    await settle(600)
    expect(stepOf()).toBe('card')
    // From 初 -- the novice has passed no stop -- to the first stop ahead.
    const from = inCar('[data-door="level"] .pcb__code')
    expect(from.textContent).toBe('初')
    expect(from.getAttribute('lang')).toBe('ja')
    expect(inCar('[data-door="destination"] .pcb__code').textContent).toBe('N5')
    await door('destination')
    // Every stop ahead, the novice's own last: all six are answers, and
    // none is where the learner stands.
    expect([...sheet().querySelectorAll('[data-goal]')].map(g => g.dataset.goal)).toEqual(['N1', 'N2', 'N3', 'N4', 'N5', 'novice'])
    expect(inSheet('.brd-goal--here')).toBeNull()
    inSheet('[data-goal="novice"]').click()
    await settle(300)
    // The kana's own stop, printed in its sign.
    expect(inCar('[data-door="destination"] .pcb__code').textContent).toBe('あ')
    // The kana are on every ticket: the lines' sheet says so, locked.
    await door('lines')
    expect(inSheet('.brd-lines__kana')).not.toBeNull()
  })

  it('fits every question, the card and its sheets in a laptop\'s window, in French, with no scroll', async () => {
    localStorage.setItem('lang', 'fr')
    try {
      await board({ guest: true })
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
      const checkSheet = async (open, kind) => {
        inCar(open).click()
        await settle(500)
        const at = $(`.brd-sheet--${kind}`)
        expect(at, kind).not.toBeNull()
        expect(fits(at), kind).toBe(true)
        expect(box(at).bottom, kind).toBeLessThanOrEqual(window.innerHeight)
        await shut()
      }
      await check()       // kana
      await toLevel()
      await check()       // level
      await toCard('N5')
      await check()       // card
      await checkSheet('[data-door="destination"]', 'goal')
      await checkSheet('[data-door="service"]', 'rhythm')
      await checkSheet('[data-door="hour"]', 'hour')
      await checkSheet('[data-door="lines"]', 'lines')
      await checkSheet('[data-door="name"]', 'name')
      await checkSheet('[data-action="keep"]', 'account')
    } finally {
      localStorage.removeItem('lang')
    }
  })

  it('stands the card in the paper\'s middle under its question, its gate in the floor\'s corner', async () => {
    await board({ guest: true })
    await toLevel()
    await toCard('N3')
    await settle(900)
    const q = box(inCar('.brd__q'))
    expect(Math.round(q.left)).toBe(Math.round(box(strip()).left))
    // The card and its fields in words beside it (plan 247), the pair
    // in the paper's middle, the list at the side column's width.
    const card = box(inCar('.brd-card .pcard'))
    const rows = box(inCar('.brd-rows'))
    expect(Math.abs((card.left + rows.right) / 2 - bodyW() / 2)).toBeLessThan(1.5)
    expect(rows.left).toBeGreaterThan(card.right)
    expect(Math.round(rows.width)).toBe(360)
    expect(Math.abs(mid({ left: rows.top, right: rows.bottom }) - mid({ left: card.top, right: card.bottom }))).toBeLessThan(1.5)
    expect(card.top).toBeGreaterThan(box(inCar('.brd__hint')).bottom)
    // Every field of the print a door, named for a screen reader.
    expect([...inCar('.brd-card').querySelectorAll('[data-door]')].map(d => d.dataset.door))
      .toEqual(['level', 'destination', 'service', 'hour', 'lines', 'name'])
    for (const d of inCar('.brd-card').querySelectorAll('[data-door]')) expect(d.getAttribute('aria-label'), d.dataset.door).toBeTruthy()
    // Under it, where it lives -- this device -- and the way to keep it.
    expect(inCar('.brd-keep-line').dataset.kept).toBe('device')
    expect(box(inCar('.brd-keep-line')).top).toBeGreaterThan(card.bottom)
    // Its one action at a ticket's width, in the floor's corner, and no
    // way back beside it: the card is an arrival.
    const go = box(inCar('[data-action="issue"]'))
    expect(Math.round(go.width)).toBe(360)
    expect(Math.round(bodyW() - go.right)).toBe(Math.round(box(strip()).left))
    expect(inCar('[data-action="back"]')).toBeNull()
    expect(fits(inCar('.brd__body'))).toBe(true)
  })

  it('says on the card why the office refused the contract, and stays', async () => {
    const onComplete = vi.fn()
    apiJsonWithTimeout.mockImplementation(async () => { throw new ApiError('refused') })
    await board({ onComplete })
    await toLevel()
    await toCard()
    inCar('[data-action="issue"]').click()
    await settle()
    expect(onComplete).not.toHaveBeenCalled()
    expect(inCar('.brd__error').dataset.error).toBe('refused')
    expect(stepOf()).toBe('card')
  })

  it('offers to keep a guest\'s card under it, and issues it from there', async () => {
    const onComplete = vi.fn()
    await board({ onComplete, guest: true })
    await toLevel()
    await toCard()
    // The line under the card says it lives here, and opens the account.
    inCar('[data-action="keep"]').click()
    await settle(400)
    expect($('.brd-sheet--account')).not.toBeNull()
    expect(inSheet('.auth-provider')).not.toBeNull()
    expect(inSheet('input[type="email"]')).not.toBeNull()
    // Later rides on as a guest: the sheet shuts, and the card is issued.
    inSheet('[data-action="account-later"]').click()
    await settle(300)
    expect(sheet()).toBeNull()
    expect(inCar('.brd-keep-line').dataset.kept).toBe('device')
    inCar('[data-action="issue"]').click()
    await settle()
    expect(apiJsonWithTimeout).toHaveBeenCalledWith('/api/onboarding/complete', expect.anything(), expect.anything())
    expect(onComplete).toHaveBeenCalledTimes(1)
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
// A digit picks the answer that names it, printed on it: a level by its
// own number (the novice on 0), a kana answer by its tile -- and a kana
// answer advances, as a tap does.
const kbdOf = el => el?.querySelector('.desk-kbd')?.textContent ?? null
// An AZERTY key a US layout has no key for (é, à): Playwright would
// insert it as text with no keydown, so the keydown is dispatched from
// the focus, as the key would arrive.
const azerty = key => (document.activeElement ?? document.body)
  .dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }))
describe('the digits at first contact (P12)', () => {
  it('answers the kana by its tile and goes on, and picks a level by its own number, on either keyboard row', async () => {
    await board()
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
    await userEvent.keyboard('&')
    expect(inCar('[data-level="N1"]').getAttribute('aria-pressed')).toBe('true')
    azerty('é')
    await settle(40)
    expect(inCar('[data-level="N2"]').getAttribute('aria-pressed')).toBe('true')
    azerty('à')
    await settle(40)
    expect(inCar('[data-level="novice"]').getAttribute('aria-pressed')).toBe('true')
    await userEvent.keyboard('{Enter}')
    await settle()
    // The card: no digit picks a field; its sheets are the pointer's and
    // Enter's.
    expect(stepOf()).toBe('card')
    expect(inCar('[aria-keyshortcuts~="1"]')).toBeNull()
  })

  it('picks nothing under a dialog', async () => {
    await board()
    await toLevel()
    const modal = document.createElement('div')
    modal.setAttribute('aria-modal', 'true')
    modal.dataset.probeModal = ''
    document.body.appendChild(modal)
    await userEvent.keyboard('1')
    expect(inCar('[data-level="N1"]').getAttribute('aria-pressed')).toBe('false')
  })
})

// ── P13 — first contact, finished (plans 155, 163) ──
// The owner's ask: keep the drawing and make it smooth. The way on
// stands in one place on every question -- since plan 163 the paper's
// bottom-right corner; the stop being asked is lit on the strip and the
// light moves with the question; each answer's key turns over to its
// check in one slot; the Welcome hands its paper to the wait with the
// dots on one spot; and a car is not dropped before the one after it
// has landed. Since plan 247 the card's sheets keep the drawing too.
const { default: AppLoading } = await import('./screens/AppLoading')
const landed = () => settle(900)
const centreY = r => (r.top + r.bottom) / 2
const opacityOf = el => Number(getComputedStyle(el).opacity)
// An opacity read when it has come to its value, not after a fixed sleep:
// with the lanes' pages running side by side a frame can be late by more
// than the beat a test waited, and an element was read at 0.82 mid-fade.
// `of` is a getter, the element can be replaced while it waits.
const opacityIs = (of, value) => vi.waitFor(
  () => expect(opacityOf(of())).toBe(value),
  { timeout: 5000, interval: 20 },
)

describe('first contact, finished (P13, plan 155)', () => {
  it('stands the way on where it stood, on every question and on the card', async () => {
    await board()
    const floors = []
    const read = async gate => {
      await landed()
      const go = box(inCar(gate))
      const back = inCar('[data-action="back"]')
      floors.push({ step: stepOf(), go: [Math.round(go.right), Math.round(go.top)], width: Math.round(go.width), gap: back ? Math.round(go.left - box(back).right) : null })
    }
    await pick('[data-kana="hiragana"]')
    await settle()
    await read('[data-action="continue"]')       // reveal
    inCar('[data-action="back"]').click()
    await settle()
    await toLevel()
    await pick('[data-level="N3"]')
    await read('[data-action="continue"]')       // level, the test on its floor
    await next()
    await read('[data-action="issue"]')          // card, the gate alone
    expect(floors.map(f => f.step)).toEqual(['reveal', 'level', 'card'])
    // Continue's end and its top in the corner on every screen, Back a
    // rung before it where there is one. At 1100 the ticket gives some of
    // its width to the strip -- never so much that its label wraps.
    for (const f of floors) {
      expect(f.go, f.step).toEqual(floors[0].go)
      if (f.gap != null) expect(f.gap, f.step).toBe(12)
      expect(f.width, f.step).toBeGreaterThanOrEqual(240)
      expect(f.width, f.step).toBeLessThanOrEqual(360)
    }
    expect(floors[2].gap).toBeNull()
  })

  it('lights the stop being asked, and moves the light with the question', async () => {
    await board()
    const lit = () => strip().querySelector('[aria-current="step"]')?.dataset.stop
    const ring = key => box(stop(key).querySelector('.desk-brd__sp-dot'))
    await landed()
    expect(lit()).toBe('kana')
    // The lit stop's ring is the phone track's "here", larger than a dot.
    expect(Math.round(ring('kana').width)).toBe(16)
    expect(Math.round(ring('card').width)).toBe(10)
    await toLevel()
    await landed()
    expect(lit()).toBe('level')
    expect(Math.round(ring('kana').width)).toBe(10)
    await pick('[data-level="N4"]')
    await next()
    await landed()
    expect(lit()).toBe('card')
    doorOf('kana').click()
    await landed()
    expect(lit()).toBe('kana')
    await pick('[data-kana="both"]')
    await landed()
    expect(lit()).toBe('level')
  })

  it('turns an answer\'s key over to its check, in one slot', async () => {
    await board()
    await landed()
    // A kana answer's in its tile's top right corner, inside the tile's
    // border, --sp-2 (6px) from its edges.
    const corner = el => {
      const m = box(el.querySelector('.desk-brd__mark'))
      const t = box(el)
      return [Math.round(t.right - el.clientLeft - m.right), Math.round(m.top - t.top - el.clientTop)]
    }
    expect(corner(inCar('[data-kana="hiragana"]'))).toEqual([6, 6])
    // A station's on its ring's shoulder, clear of its code and the rail
    // through its middle (the climbing line, plan 163).
    await toLevel()
    await landed()
    const station = inCar('[data-level="N5"]')
    const ring = box(station.querySelector('.desk-brd__stop-ring'))
    const mark = box(station.querySelector('.desk-brd__mark'))
    expect(mid(mark)).toBeGreaterThan(ring.right - ring.width / 4)
    expect(cy(mark)).toBeLessThan(ring.top + ring.height / 4)
    // One slot: the key, until the pick turns it over to its check.
    const key = () => station.querySelector('.desk-brd__key')
    const tick = () => station.querySelector('.desk-brd__tick')
    expect(station.querySelectorAll('.desk-kbd')).toHaveLength(1)
    expect(key().textContent).toBe('5')
    expect(opacityOf(key())).toBeGreaterThan(0.5)
    await opacityIs(() => tick(), 0)
    await pick('[data-level="N5"]')
    await opacityIs(() => key(), 0)
    await opacityIs(() => tick(), 1)
  })

  it('prices the four trains on the rhythm\'s sheet, the more minutes the sooner, and reprints the card', async () => {
    await board()
    await toLevel()
    await toCard('N3')
    const service = () => inCar('[data-door="service"] .pcb__value')?.textContent ?? inCar('[data-door="service"]').textContent
    const before = service()
    await door('service')
    const trains = [...sheet().querySelectorAll('.brd-train')]
    expect(trains.map(r => r.dataset.rhythm)).toEqual(['5', '10', '15', '20'])
    // The recommended rhythm is the card's to begin with, its tag beside its name.
    expect(inSheet('[data-rhythm="10"]').getAttribute('aria-pressed')).toBe('true')
    expect([en.onbPaceRecommended, fr.onbPaceRecommended]).toContain(inSheet('[data-rhythm="10"] .brd-train__tag').textContent)
    // Each priced with its day: the more minutes, the fewer days.
    const days = trains.map(r => Number(r.querySelector('.brd-train__days').textContent.match(/\d+/)[0]))
    for (let i = 1; i < 4; i++) expect(days[i]).toBeLessThan(days[i - 1])
    for (const r of trains) expect(r.querySelector('.brd-train__date').textContent).toMatch(/20\d\d/)
    // The rows one under another, each whole in the sheet.
    trains.reduce((a, b) => { expect(box(b).top).toBeGreaterThanOrEqual(box(a).bottom - 0.5); return b })
    for (const r of trains) expect(box(r).right).toBeLessThanOrEqual(box(sheet()).right)
    // A pick shuts the sheet and the card reprints its service.
    inSheet('[data-rhythm="20"]').click()
    await settle(300)
    expect(sheet()).toBeNull()
    expect(service()).not.toBe(before)
  })

  it('turns the hour\'s board by its steppers, and a service takes it to its hour', async () => {
    await board()
    await toLevel()
    await toCard('N3')
    const printed = () => inCar('[data-door="hour"]').getAttribute('aria-label')
    expect(printed()).toMatch(/07:30$/)
    await door('hour')
    const flaps = () => inSheet('.brd-board__flaps').getAttribute('aria-label')
    expect(flaps()).toBe('07:30')
    expect(inSheet('[data-hour="am"]').getAttribute('aria-pressed')).toBe('true')
    // An hour later: the board turns, the sheet stays, the card reprints.
    inSheet(`.brd-clock__step[aria-label="${inSheet('.brd-clock__step').getAttribute('aria-label')}"]`).click()
    await settle(60)
    expect(flaps()).toBe('08:30')
    expect(sheet()).not.toBeNull()
    expect(printed()).toMatch(/08:30$/)
    // A ride's own hour: picked, it shuts the sheet.
    inSheet('[data-hour="pm"]').click()
    await settle(300)
    expect(sheet()).toBeNull()
    expect(printed()).toMatch(/21:00$/)
    // On the web the reminder is the learner's own calendar.
    await door('hour')
    expect(inSheet('[data-action="agenda"]')).not.toBeNull()
    expect(inSheet('[data-action="remind"]')).toBeNull()
    expect(fits(sheet())).toBe(true)
  })

  it('switches the lines in their sheet, each with what it carries, the last one refusing to go', async () => {
    await board()
    await toLevel()
    await toCard('N3')
    await door('lines')
    const rows = [...sheet().querySelectorAll('[data-line]')]
    expect(rows.map(c => c.dataset.line)).toEqual(['vocab', 'kanji', 'grammar'])
    for (const c of rows) expect(c.querySelector('.brd-line__vol').textContent).toMatch(/^~\d/)
    // A reader of both scripts has no kana strip to lock.
    expect(inSheet('.brd-lines__kana')).toBeNull()
    // The arrival moves as a line comes off; the last one stays on, and says so.
    const arrival = () => inSheet('.brd-arrive')?.textContent ?? null
    const before = arrival()
    expect(before).toMatch(/N2/)
    inSheet('[data-line="vocab"]').click()
    await settle(40)
    expect(inSheet('[data-line="vocab"]').getAttribute('aria-pressed')).toBe('false')
    expect(arrival()).not.toBe(before)
    inSheet('[data-line="kanji"]').click()
    await settle(40)
    inSheet('[data-line="grammar"]').click()
    await settle(40)
    expect(inSheet('[data-line="grammar"]').getAttribute('aria-pressed')).toBe('true')
    expect(inSheet('.brd-arrive--none')).not.toBeNull()
    // A switch, not a pick: the sheet stays open until it is shut.
    await shut()
    expect(inCar('[data-door="lines"]').querySelectorAll('.pcb__line')).toHaveLength(1)
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
    // Read 300ms after the press on the scene's own clock, its fades and
    // the wait's entrance stopped there: on the wall clock a busy runner
    // had started the fades late, and the block was 0.0004 from gone.
    const beats = ['.desk-front__block', '.desk-front__door', '.desk-wait'].flatMap(s => $(s).getAnimations())
    beats.forEach(a => { a.pause(); a.currentTime = 300 })
    // The way in and the corner pull away, the map a beat after them.
    expect($('.desk-front').classList.contains('desk-front--leaving')).toBe(true)
    await opacityIs(() => $('.desk-front__block'), 0)
    await opacityIs(() => $('.desk-front__door'), 0)
    // The pass being issued: its dots a beat after the press, on the
    // paper's middle.
    await opacityIs(() => $('.desk-wait'), 0)
    beats.forEach(a => a.play())
    await landed()
    await opacityIs(() => $('.desk-front__map'), 0)
    await opacityIs(() => $('.desk-front__hub'), 0)
    await opacityIs(() => $('.desk-wait'), 1)
    const dots = dotsAt()
    expect(Math.abs(dots[0] - bodyW() / 2)).toBeLessThan(2)
    await screen.unmount()
    // The wait after it, handed the press a second ago: the same paper,
    // no column, the same dots on the same spot, already drawn.
    const wait = await render(<LangProvider><AppLoading wakesServer frame since={performance.now() - 1000} /></LangProvider>)
    await settle(60)
    expect($('.desk-rail__mast')).toBeNull()
    await opacityIs(() => $('.desk-brd--wait .desk-wait'), 1)
    expect(dotsAt()).toEqual(dots)
    await wait.unmount()
    // With no press to time from, a beat before they are drawn at all.
    const cold = await render(<LangProvider><AppLoading wakesServer frame /></LangProvider>)
    await settle(100)
    await opacityIs(() => $('.desk-wait'), 0)
    await landed()
    await opacityIs(() => $('.desk-wait'), 1)
    await cold.unmount()
  })

  it('brings the Welcome back when no pass could be issued', async () => {
    const screen = await render(<Door boarding />)
    await landed()
    await screen.rerender(<Door authMode="signup" />)
    await landed()
    expect($('.desk-front').classList.contains('desk-front--leaving')).toBe(false)
    await opacityIs(() => $('.desk-front__block'), 1)
    await opacityIs(() => $('.desk-front__map'), 1)
    await opacityIs(() => $('.desk-front__hub'), 1)
    expect([en.signup, fr.signup]).toContain($('h1').textContent)
  })

  it('keeps the leaving car until the arriving one has landed, and runs Back the other way', async () => {
    await board()
    await pick('[data-kana="both"]')
    // Gone from sight, not from the page: the arriving answers are still
    // coming in, and dropping it took their entrance with it. Read when
    // the fade has drawn, not after a sleep: with the lanes' pages
    // running side by side a frame can be late by more than a fixed
    // wait, and the car was read at its opacity of 1.
    await vi.waitFor(() => {
      const out = $('.brd__car--out')
      expect(out).not.toBeNull()
      expect(opacityOf(out)).toBe(0)
    }, { timeout: 5000, interval: 20 })
    expect(getComputedStyle(live()).animationName).toBe('desk-brd-pull-in')
    await vi.waitFor(() => expect($('.brd__car--out')).toBeNull(), { timeout: 5000, interval: 20 })
    inCar('[data-action="back"]').click()
    await settle(40)
    expect(live().dataset.dir).toBe('back')
    expect($('.brd__car--out').dataset.dir).toBe('back')
  })
})

describe('the hover, simpler (P14, plan 155)', () => {
  it('draws the gold edge on an answer, and nothing else', async () => {
    await board()
    await toLevel()
    await landed()
    // A station: its ring takes the edge (the climbing line, plan 163).
    const station = inCar('[data-level="N3"]')
    const ring = station.querySelector('.desk-brd__stop-ring')
    const ground = getComputedStyle(ring).backgroundColor
    await userEvent.hover(station)
    await settle(250)
    expect(getComputedStyle(station).filter).toBe('none')
    expect(getComputedStyle(ring).borderTopColor).toBe(paintOf('--accent2'))
    // No wash: the ground it had at rest.
    expect(getComputedStyle(ring).backgroundColor).toBe(ground)
    await userEvent.hover(inCar('[data-action="back"]'))
    await settle(250)
    expect(getComputedStyle(inCar('[data-action="back"]')).filter).toBe('none')
  })

  it('focuses the name on its plate with one gold edge, no second ring', async () => {
    await board()
    await toLevel()
    await toCard()
    await door('name')
    const field = inSheet('.brd-plate__field')
    field.focus()
    await settle(300)
    const focused = getComputedStyle(field)
    expect(focused.outlineStyle).toBe('none')
    const plate = field.closest('.brd-plate')
    const gold = getComputedStyle(plate).boxShadow
    field.blur()
    await settle(200)
    // At rest, the plate's own edge: the gold is the focus alone.
    expect(getComputedStyle(plate).boxShadow).not.toBe(gold)
    // The count is the card's: a first name, up to 24 characters.
    expect(inSheet('.brd-plate__count').textContent).toBe('0 / 24')
  })
})
