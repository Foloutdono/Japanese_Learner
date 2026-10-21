import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { LangProvider } from '../LangContext'
import fr from '../locales/fr/index.js'
// The card tells a refusal from a dead line by `instanceof`, so the
// refusal test has to throw the very class the screen imports: this is
// the one from the mock below, not a second declaration that would make
// that test pass for the wrong reason.
import { ApiError } from '../lib/api'
import '../index.css'

// ── The boarding, walked end to end (plan 075; the card, plan 247) ──
// The owner's pick C: the boarding asks the kana and a reader's level,
// then hands the card already filled in, every printed field a door to
// a sheet. Everything stays in memory and POSTs exactly once on
// « Émettre ma carte », so what matters is: the screens chain in C's
// order, the kana branches both ways, the card prints the defaults, a
// pick in a sheet reprints the card and rides on the contract, the
// origin goes back with every answer kept, the account sheet keeps the
// card by a link or by Google, and the train pulls between screens. The
// browser lane runs fr-FR, so every hook here is a class or a data
// attribute, never a sentence.

const apiJson = vi.fn()
const apiJsonWithTimeout = vi.fn()
const CREDITS = { balance: 30, cap: 50, dailyRefill: 30, nextCreditAt: '2026-09-08T00:00:00+09:00', plan: 'free', unlimited: false }
const apiFetch = vi.fn(async path => {
  if (path === '/api/credits') return { ok: true, status: 200, json: async () => CREDITS }
  return { ok: true, status: 200, json: async () => ({}) }
})

vi.mock('../lib/api', () => ({
  api: p => p,
  apiFetch: (...a) => apiFetch(...a),
  apiJson: (...a) => apiJson(...a),
  apiJsonWithTimeout: (...a) => apiJsonWithTimeout(...a),
  apiUpload: vi.fn(),
  // The real one's shape: a refusal has its status (lib/api.js).
  ApiError: class ApiError extends Error {
    constructor(status, body = null, path = '') {
      super(`Request failed (${status}) for ${path}`)
      this.status = status
      this.body = body
      this.path = path
    }
  },
}))
// The card kept by a link: one updateUser call with the address alone
// (lib/guest.js claimByLink), and what it REFUSES with is the point of
// one test below.
const updateUser = vi.fn()
vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: async () => ({ data: { session: { access_token: 'tok' } } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
      updateUser: (...a) => updateUser(...a),
    },
  },
}))
// The reminder is native-only; one test flips it on.
const nudgeRef = { current: false }
const requestNudge = vi.fn(async () => nudgeRef.current)
// What the OS says it will do when it is not asking (plan 247): one test
// has it refuse for good.
const nudgeState = { current: 'prompt' }
vi.mock('../lib/platform', () => ({
  isNative: () => nudgeRef.current,
  canNudge: () => nudgeRef.current,
  requestNudgePermission: () => requestNudge(),
  nudgePermission: async () => nudgeState.current,
}))
// 改札 — what the Google round trip came back with. Only the pending
// refusal is faked: the message and the classification stay real.
const oauthRefusal = { current: null }
vi.mock('../lib/authRedirect', async (importOriginal) => ({
  ...(await importOriginal()),
  authRedirectError: () => oauthRefusal.current,
}))
vi.mock('../lib/audio', async (importOriginal) => ({
  ...(await importOriginal()),
  playPlatformChime: vi.fn(),
  playClick: vi.fn(),
}))
// 足跡: what the boarding says it did, read off the seam.
const tracked = vi.fn()
vi.mock('../lib/track', async (importOriginal) => ({
  ...(await importOriginal()),
  track: (...a) => tracked(...a),
}))
// The web's calendar file: built for real, handed to a spy.
const saved = vi.fn()
vi.mock('../lib/calendarFile', async (importOriginal) => ({
  ...(await importOriginal()),
  saveCalendar: (...a) => saved(...a),
}))
// LangContext pulls the content-translation maps over the network on
// mount — same stub the AnalyzerScreen polling test uses.
globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })

const { default: BoardingFlow } = await import('./BoardingFlow')
const { seedCredits } = await import('../stores/credits')

const VOLUMES = {
  vocab: { N5: 667, N4: 634, N3: 1832, N2: 1796, N1: 3476 },
  kanji: { N5: 103, N4: 166, N3: 367, N2: 367, N1: 1232 },
  grammar: { N5: 71, N4: 71, N3: 71, N2: 71, N1: 71 },
  kana: 224,
}

// The stash the web writes before leaving for Google, and the answers
// it carries back -- a reader at N4, on the card.
const STASH_KEY = 'jp-boarding-stash'
const RESUMED = {
  kana: 'both', levelChoice: 'N4', jlpt: 'N4', placed: null, goal: 'N3',
  lines: ['vocab', 'kanji', 'grammar'], rhythm: 10, minute: 450, notifications: false, cardName: '',
}
const stashed = extra => sessionStorage.setItem(STASH_KEY, JSON.stringify({
  answers: RESUMED, step: 'card', sheet: 'account', keeping: 'google', history: ['kana', 'level'], ...extra,
}))

// The pull is 260 ms; a settle clears it and the leaving car with it.
const settle = (ms = 340) => new Promise(r => setTimeout(r, ms))
// The head's track reads n/N off its progressbar.
function stepsOf(screen) {
  const track = screen.container.querySelector('.brd__track')
  return `${track.getAttribute('aria-valuenow')}/${track.getAttribute('aria-valuemax')}`
}

const stepOf = screen => screen.container.querySelector('.brd')?.dataset.step
const live = screen => screen.container.querySelector('.brd__car:not(.brd__car--out)')
// The head (the back button, the track) stands outside the cars.
const q = (screen, sel) => live(screen).querySelector(sel) ?? screen.container.querySelector(sel)
// The sheets portal to the document's body.
const sheet = () => document.querySelector('.brd-sheet')
const inSheet = sel => sheet()?.querySelector(sel) ?? null

// A native click's state lands on the next tick, so every click waits
// one before the next lands on the state it moved.
async function click(screen, sel) {
  // The next screen comes a frame after the tap (a transition, go()).
  await vi.waitFor(() => expect(q(screen, sel), sel).toBeTruthy(), { timeout: 2000 })
  const el = q(screen, sel)
  el.click()
  await settle(20)
}
async function clickSheet(sel) {
  const el = inSheet(sel)
  expect(el, sel).toBeTruthy()
  el.click()
  await settle(60)
}
async function door(screen, page) {
  await click(screen, `[data-door="${page}"]`)
  await settle(60)
  expect(sheet(), `the ${page} door opens its sheet`).not.toBeNull()
}

const setValue = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
function type(el, value) {
  setValue.call(el, value)
  el.dispatchEvent(new Event('input', { bubbles: true }))
}

async function renderFlow({ onComplete = vi.fn(), dryRun = false, onExit = undefined, onSignIn = undefined, guest = false, user = null } = {}) {
  const screen = await render(
    <LangProvider>
      <BoardingFlow
        session={{ access_token: 'tok', ...(user ? { user } : {}) }}
        onComplete={onComplete}
        onExit={onExit}
        onSignIn={onSignIn}
        guest={guest}
        dryRun={dryRun}
      />
    </LangProvider>
  )
  await settle(120)
  return { screen, onComplete }
}

// A beginner's line: « Pas encore », the reveal, the card.
async function toCardBeginner(screen) {
  expect(stepOf(screen)).toBe('kana')
  await click(screen, '[data-kana="none"]')
  await settle()
  expect(stepOf(screen)).toBe('reveal')
  await click(screen, '[data-action="continue"]')
  await settle()
  expect(stepOf(screen)).toBe('card')
}

// A reader's: both scripts, the level picked on the line, the card.
async function toCardReader(screen, level = 'N4') {
  expect(stepOf(screen)).toBe('kana')
  await click(screen, '[data-kana="both"]')
  await settle()
  expect(stepOf(screen)).toBe('level')
  await click(screen, `[data-level="${level}"]`)
  await click(screen, '[data-action="continue"]')
  await settle()
  expect(stepOf(screen)).toBe('card')
}

const code = (screen, page) => q(screen, `[data-door="${page}"] .pcb__code`)
const printed = (screen, page) => q(screen, `[data-door="${page}"] .pcb__value`)?.textContent
const completes = () => apiJsonWithTimeout.mock.calls.filter(c => c[0] === '/api/onboarding/complete')
const posted = () => JSON.parse(completes()[0][2].body)
const done = () => tracked.mock.calls.filter(c => c[0] === 'boarding_done').map(c => c[1])

beforeEach(() => {
  apiJson.mockReset()
  apiJsonWithTimeout.mockReset()
  apiFetch.mockClear()
  tracked.mockClear()
  saved.mockClear()
  requestNudge.mockClear()
  nudgeRef.current = false
  oauthRefusal.current = null
  updateUser.mockReset()
  sessionStorage.removeItem(STASH_KEY)
  seedCredits(CREDITS)
  apiJson.mockImplementation(async path => (path === '/api/onboarding/volumes' ? VOLUMES : {}))
  apiJsonWithTimeout.mockImplementation(async path => {
    if (path === '/api/onboarding/complete') return { jlptLevel: 'N5', dailyNewTarget: 10, onboardedAt: 'x' }
    throw new Error(`unexpected ${path}`)
  })
})

describe('BoardingFlow', () => {
  it('kana → the reveal → the card, filled in with what most keep, and one POST of the whole contract', async () => {
    const { screen, onComplete } = await renderFlow()

    // 1/2: the kana, then the card. With no `onExit` to leave for there
    // is no button on the first question.
    expect(stepOf(screen)).toBe('kana')
    expect(stepsOf(screen)).toBe('1/2')
    expect(screen.container.querySelector('button.brd__back')).toBeNull()
    // The answers are the foot: each one advances.
    expect(q(screen, '.brd__foot')).toBeNull()
    await click(screen, '[data-kana="none"]')
    await settle()
    // The reveal is the kana's stop's second half, not a stop of its own.
    expect(stepOf(screen)).toBe('reveal')
    expect(stepsOf(screen)).toBe('1/2')
    expect(document.activeElement?.className).toContain('brd__q')
    await click(screen, '[data-action="continue"]')
    await settle()

    // The card: an arrival screen, no head, its back up.
    expect(stepOf(screen)).toBe('card')
    expect(screen.container.querySelector('.brd').classList.contains('brd--arrival')).toBe(true)
    expect(screen.container.querySelector('.brd__head')).toBeNull()
    const card = q(screen, '.brd-card .pcard')
    expect(card.dataset.side).toBe('back')
    // A beginner rides from 初 -- no stop behind them to print -- to the
    // nearest JLPT stop, valid until the day the volumes price it.
    expect(code(screen, 'level').textContent).toBe('初')
    expect(code(screen, 'level').getAttribute('lang')).toBe('ja')
    expect(code(screen, 'destination').textContent).toBe('N5')
    expect(q(screen, '.pcb__valid b').textContent).toMatch(/\d{4}$/)
    expect(printed(screen, 'service')).toBe('Rapide · 10 / jour')
    expect(printed(screen, 'hour')).toBe('Matin · 07:30')
    expect(live(screen).querySelectorAll('[data-door="lines"] .pcb__line')).toHaveLength(3)
    // No name yet: the signature prints its placeholder, quietly.
    expect(q(screen, '.pcb__sign-name').textContent).toBe(fr.brdNamePlaceholder)
    expect(q(screen, '.pcb__sign-name').classList.contains('pcb__sign-name--empty')).toBe(true)
    // The balance as the card holds it: 30 of 50, not a welcome.
    expect(q(screen, '.pcb__meter--balance').textContent).toContain('30')
    expect(q(screen, '.pcb__meter--balance').textContent).not.toContain('offerts')
    // Nothing written until the gate.
    expect(apiJsonWithTimeout).not.toHaveBeenCalled()

    await click(screen, '[data-action="issue"]')
    await settle(80)
    expect(completes()).toHaveLength(1)
    const body = posted()
    expect(body.jlptLevel).toBe('N5')
    expect(body.dailyNewTarget).toBe(10)
    expect(body.goalLevel).toBe('N5')
    expect(body.goalTargetDate).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(body.dailyDeparture).toBe('am')
    expect(body.kanaKnown).toBe('none')
    expect(body.lines).toEqual(['vocab', 'kanji', 'grammar'])
    expect(body.rhythmMin).toBe(10)
    expect(body.reminderTime).toBe('07:30')
    expect(body.notifications).toBe(false)
    expect(body.cardName).toBe('')
    expect(typeof body.tzOffsetMin).toBe('number')
    // Why is no longer asked.
    expect('motive' in body).toBe(false)
    expect(onComplete).toHaveBeenCalledWith({ kanaKnown: 'none' })
    // The far end of the funnel: no field changed, no name, an account
    // the learner boarded with already.
    expect(done()).toHaveLength(1)
    expect(done()[0]).toMatchObject({
      kana_known: 'none', level: 'N5', pace: 10, lines: 'vocab,kanji,grammar',
      edited_goal: false, edited_rhythm: false, edited_hour: false, edited_lines: false,
      named: false, kept: 'already',
    })
    expect('level_how' in done()[0]).toBe(false)
  })

  it('a reader of both scripts: the level on the line, the test its quiet way, and a card from N4 to N3', async () => {
    const { screen } = await renderFlow()
    await click(screen, '[data-kana="both"]')
    await settle()
    // Both read: the level is a stop of its own, and the track grows one.
    expect(stepOf(screen)).toBe('level')
    expect(stepsOf(screen)).toBe('2/3')
    expect(q(screen, '[data-level="novice"] .brd-stn__ring').textContent).toBe('あ')
    // The volumes price the line: N5's ~100 kanji.
    expect(q(screen, '[data-level="N5"] .brd-stn__desc').textContent).toContain('100')
    // The test is a quiet way over the gate, not a question of its own.
    expect(q(screen, '[data-action="level-test"]').textContent).toBe(fr.brdLevelTest)
    // No pick, no way on.
    expect(q(screen, '[data-action="continue"]').disabled).toBe(true)
    await click(screen, '[data-level="N4"]')
    await click(screen, '[data-action="continue"]')
    await settle()

    expect(stepOf(screen)).toBe('card')
    expect(code(screen, 'level').textContent).toBe('N4')
    expect(code(screen, 'level').getAttribute('lang')).toBeNull()
    expect(code(screen, 'destination').textContent).toBe('N3')
    await click(screen, '[data-action="issue"]')
    await settle(80)
    const body = posted()
    expect(body.jlptLevel).toBe('N4')
    expect(body.goalLevel).toBe('N3')
    expect(body.kanaKnown).toBe('both')
    expect(done()[0]).toMatchObject({ level: 'N4', level_how: 'pick' })
  })

  it('every printed field is a door: a pick in its sheet reprints the card and rides on the contract', async () => {
    const { screen } = await renderFlow()
    await toCardBeginner(screen)

    // Objectif: the stops ahead, the hardest on top, each its arrival.
    await door(screen, 'destination')
    const goals = [...sheet().querySelectorAll('[data-goal]')]
    expect(goals.map(g => g.dataset.goal)).toEqual(['N1', 'N2', 'N3', 'N4', 'N5', 'novice'])
    expect(inSheet('[data-goal="N5"]').getAttribute('aria-pressed')).toBe('true')
    for (const g of goals) expect(g.querySelector('.brd-goal__date').textContent).toMatch(/\d{4}$/)
    // The kana's own stop, a destination of its own, in its sign.
    expect(inSheet('[data-goal="novice"] .brd-goal__dot').textContent).toBe('あ')
    await clickSheet('[data-goal="N4"]')
    // A pick is a save, and shuts the sheet.
    expect(sheet()).toBeNull()
    expect(code(screen, 'destination').textContent).toBe('N4')

    // Rythme: four trains, the recommended one lit.
    await door(screen, 'service')
    expect(sheet().querySelectorAll('[data-rhythm]')).toHaveLength(4)
    expect(inSheet('[data-rhythm="10"]').getAttribute('aria-pressed')).toBe('true')
    expect(inSheet('[data-rhythm="10"] .brd-train__tag')).not.toBeNull()
    await clickSheet('[data-rhythm="20"]')
    expect(sheet()).toBeNull()
    expect(printed(screen, 'service')).toBe('Express · 20 / jour')

    // Départ: the flaps turn and the sheet stays; a ride is a pick.
    await door(screen, 'hour')
    expect(inSheet('.brd-board__flaps').getAttribute('aria-label')).toBe('07:30')
    await clickSheet(`[aria-label="${fr.brdHalfLater}"]`)
    expect(sheet()).not.toBeNull()
    expect(inSheet('.brd-board__flaps').getAttribute('aria-label')).toBe('08:00')
    expect(printed(screen, 'hour')).toBe('Matin · 08:00')
    // On the web, no reminder: the calendar instead.
    expect(inSheet('[data-action="remind"]')).toBeNull()
    expect(inSheet('[data-action="agenda"]')).not.toBeNull()
    await clickSheet('[data-hour="pm"]')
    expect(sheet()).toBeNull()
    expect(printed(screen, 'hour')).toBe('Soir · 21:00')

    // Lignes: a check is a switch, so the sheet stays; never none.
    await door(screen, 'lines')
    expect([...sheet().querySelectorAll('[data-line]')].map(el => el.getAttribute('aria-pressed'))).toEqual(['true', 'true', 'true'])
    await clickSheet('[data-line="grammar"]')
    expect(inSheet('[data-line="grammar"]').getAttribute('aria-pressed')).toBe('false')
    expect(live(screen).querySelectorAll('[data-door="lines"] .pcb__line')).toHaveLength(2)
    await clickSheet('[data-line="kanji"]')
    await clickSheet('[data-line="vocab"]')
    // The last line on refuses to go off, and says so.
    expect(inSheet('[data-line="vocab"]').getAttribute('aria-pressed')).toBe('true')
    expect(inSheet('.brd-arrive--none[role="alert"]')).not.toBeNull()
    await clickSheet('[data-line="kanji"]')
    expect(inSheet('.brd-arrive--none')).toBeNull()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await settle(60)
    expect(sheet()).toBeNull()

    // Nom: typed, so its own gate; printed on the signature.
    await door(screen, 'name')
    type(inSheet('.brd-plate__field'), '  Camille ')
    await settle(20)
    expect(inSheet('.brd-plate__count').textContent).toBe('7 / 24')
    await clickSheet('[data-action="name-save"]')
    expect(sheet()).toBeNull()
    expect(q(screen, '.pcb__sign-name').textContent).toBe('Camille')
    expect(q(screen, '.pcb__sign-name--empty')).toBeNull()

    await click(screen, '[data-action="issue"]')
    await settle(80)
    const body = posted()
    expect(body.goalLevel).toBe('N4')
    expect(body.dailyNewTarget).toBe(20)
    expect(body.rhythmMin).toBe(20)
    expect(body.dailyDeparture).toBe('pm')
    expect(body.reminderTime).toBe('21:00')
    expect(body.lines).toEqual(['vocab', 'kanji'])
    expect(body.cardName).toBe('Camille')
    expect(done()[0]).toMatchObject({
      edited_goal: true, edited_rhythm: true, edited_hour: true, edited_lines: true, named: true,
    })
  })

  it('the origin goes back to the question that set it, every answer kept', async () => {
    const { screen } = await renderFlow()
    await toCardBeginner(screen)
    await click(screen, '[data-door="level"]')
    await settle()
    expect(stepOf(screen)).toBe('kana')
    expect(q(screen, '[data-kana="none"]').getAttribute('aria-pressed')).toBe('true')
    // A reader this time: the line, then a card from where they said.
    await click(screen, '[data-kana="both"]')
    await settle()
    await click(screen, '[data-level="N3"]')
    await click(screen, '[data-action="continue"]')
    await settle()
    expect(code(screen, 'level').textContent).toBe('N3')
    await click(screen, '[data-door="level"]')
    await settle()
    expect(stepOf(screen)).toBe('level')
    expect(q(screen, '[data-level="N3"]').getAttribute('aria-pressed')).toBe('true')
  })

  it('a reader at N1 has no stop ahead: the card prints no destination and posts none', async () => {
    const { screen } = await renderFlow()
    await toCardReader(screen, 'N1')
    expect(code(screen, 'destination').textContent).toBe('—')
    expect(q(screen, '.pcb__valid')).toBeNull()
    await click(screen, '[data-action="issue"]')
    await settle(80)
    const body = posted()
    expect(body.jlptLevel).toBe('N1')
    expect('goalLevel' in body).toBe(false)
    expect('goalTargetDate' in body).toBe(false)
  })

  // ── 実力診断 from the line (plan 224; its quiet way, plan 247) ──
  // The climb, mocked as the server answers it: one question at a time,
  // then the verdict. The line comes back with the stop reached chosen
  // and each level asked carrying its score.
  const question = (id, level) => ({
    id, sectionId: level, kind: 'reading', type: 'mcq-text', promptJp: `${id}の問題`,
    choices: ['一', '二', '三', '四'].map((textJp, i) => ({ id: `c${i + 1}`, textJp })),
  })
  function climb(...steps) {
    const queue = [...steps]
    apiJsonWithTimeout.mockImplementation(async (path, _s, opts) => {
      if (path === '/api/onboarding/complete') return { jlptLevel: 'N4', dailyNewTarget: 10, onboardedAt: 'x' }
      if (path.startsWith('/api/onboarding/placement/')) return queue.shift()
      throw new Error(`unexpected ${path} ${opts?.body ?? ''}`)
    })
  }
  const asking = (id, level, perLevel = {}) => ({ seed: 9, done: false, question: question(id, level), level, perLevel })
  const sent = () => apiJsonWithTimeout.mock.calls
    .filter(c => c[0] === '/api/onboarding/placement/answer')
    .map(c => JSON.parse(c[2].body))

  async function toTest(screen) {
    await click(screen, '[data-kana="both"]')
    await settle()
    expect(stepOf(screen)).toBe('level')
    await click(screen, '[data-action="level-test"]')
    await settle()
    expect(stepOf(screen)).toBe('test')
    // The test is the level's own stop.
    expect(stepsOf(screen)).toBe('2/3')
  }

  it('finds the level by the test, and lands on the line with the stop it reached chosen', async () => {
    climb(
      asking('q1', 'N5'),
      asking('q2', 'N4', { N5: { correct: 3, total: 3, cleared: true } }),
      { seed: 9, done: true, recommendedLevel: 'N4', correct: 4, total: 6, perLevel: {
        N5: { correct: 3, total: 3, cleared: true }, N4: { correct: 1, total: 3, cleared: false },
      } },
    )
    const { screen, onComplete } = await renderFlow()
    await toTest(screen)
    expect(q(screen, '.onb-climb__rung--at').textContent).toBe('N5')
    // Nothing picked, no way on.
    expect(q(screen, '[data-action="continue"]').disabled).toBe(true)
    await click(screen, '.mcq-row')
    await click(screen, '[data-action="continue"]')
    await settle(60)
    expect(sent()[0]).toEqual({ seed: 9, answers: { q1: 'c1' } })
    await click(screen, '.mcq-row:nth-child(2)')
    await click(screen, '[data-action="continue"]')
    await settle()

    expect(stepOf(screen)).toBe('level')
    expect(q(screen, '[data-level="N4"]').getAttribute('aria-pressed')).toBe('true')
    expect(q(screen, '.brd__q').textContent).toContain('N4')
    expect(q(screen, '[data-level="N5"] .brd-tag').textContent).toBe('3 / 3')
    expect(q(screen, '[data-level="N4"] .brd-tag--miss').textContent).toBe('1 / 3')

    // Back goes to the question before the line, never into a test run.
    await click(screen, '.brd__back')
    await settle()
    expect(stepOf(screen)).toBe('kana')
    await click(screen, '[data-kana="both"]')
    await settle()
    await click(screen, '[data-action="continue"]')
    await settle()
    expect(stepOf(screen)).toBe('card')
    await click(screen, '[data-action="issue"]')
    await settle(80)
    expect(done()[0]).toMatchObject({ level_how: 'test', placed: 'N4' })
    expect(onComplete).toHaveBeenCalledTimes(1)
  })

  it('stops where it gets too hard, and “I know my level” goes back to the line unmarked', async () => {
    climb(asking('q1', 'N5'), { seed: 9, done: true, recommendedLevel: 'N5', correct: 0, total: 0, perLevel: {
      N5: { correct: 0, total: 0, cleared: false },
    } })
    const { screen } = await renderFlow()
    await toTest(screen)
    await click(screen, '[data-action="climb-stop"]')
    await settle()
    expect(sent()[0]).toEqual({ seed: 9, answers: {}, stop: true })
    expect(stepOf(screen)).toBe('level')
    expect(q(screen, '[data-level="N5"]').getAttribute('aria-pressed')).toBe('true')

    climb(asking('q1', 'N5'))
    await click(screen, '[data-action="level-test"]')
    await settle()
    expect(stepOf(screen)).toBe('test')
    await click(screen, '[data-action="climb-pick"]')
    await settle()
    expect(stepOf(screen)).toBe('level')
    expect(q(screen, '.brd-tag')).toBeNull()
  })

  it('a failed save keeps the card on screen with the error and the gate live', async () => {
    apiJsonWithTimeout.mockRejectedValue(new Error('down'))
    const { screen, onComplete } = await renderFlow()
    await toCardReader(screen)
    await click(screen, '[data-action="issue"]')
    await settle(80)
    expect(stepOf(screen)).toBe('card')
    expect(q(screen, '.brd__error')?.dataset.error).toBe('network')
    expect(q(screen, '[data-action="issue"]').disabled).toBe(false)
    expect(onComplete).not.toHaveBeenCalled()
  })

  // A refusal is not a connection: the office answering 422 wore the same
  // "check your connection" line as a dead network once (2026-09-09).
  it('says the office refused when the office answered, not that the line is down', async () => {
    apiJsonWithTimeout.mockRejectedValue(new ApiError(422, { detail: 'refused' }, '/api/onboarding/complete'))
    const { screen, onComplete } = await renderFlow()
    await toCardReader(screen)
    await click(screen, '[data-action="issue"]')
    await settle(80)
    const line = q(screen, '.brd__error')
    expect(line?.dataset.error).toBe('refused')
    // The refusal, and the way to tell us under it (plan 247).
    expect(line.textContent.startsWith(fr.brdPassRefused)).toBe(true)
    expect(line.querySelector('[data-action="report"]').textContent).toBe(fr.reportProblem)
    expect(stepOf(screen)).toBe('card')
    expect(q(screen, '[data-action="issue"]').disabled).toBe(false)
    expect(onComplete).not.toHaveBeenCalled()
  })

  it('the train pulls: the leaving car slides out beside the arriving one, then is dropped', async () => {
    const { screen } = await renderFlow()
    await click(screen, '[data-kana="none"]')
    await settle(30)
    const out = screen.container.querySelector('.brd__car--out')
    expect(out).not.toBeNull()
    expect(out.dataset.dir).toBe('fwd')
    expect(screen.container.querySelector('.brd__car--in').dataset.dir).toBe('fwd')
    expect(getComputedStyle(out).animationName).toBe('brd-pull-out')
    await settle()
    expect(screen.container.querySelector('.brd__car--out')).toBeNull()
    // Back runs it in reverse.
    await click(screen, 'button.brd__back')
    await settle(30)
    expect(screen.container.querySelector('.brd__car--out').dataset.dir).toBe('back')
    expect(getComputedStyle(screen.container.querySelector('.brd__car--out')).animationName).toBe('brd-pull-out-back')
    await settle()
  })

  it('dryRun issues the card and writes nothing', async () => {
    const { screen, onComplete } = await renderFlow({ dryRun: true })
    await toCardBeginner(screen)
    await click(screen, '[data-action="issue"]')
    await settle(80)
    expect(onComplete).toHaveBeenCalledTimes(1)
    expect(apiJsonWithTimeout).not.toHaveBeenCalled()
    expect(done()).toHaveLength(0)
  })

  it('leaves for Welcome from the first question, where the sign-in is', async () => {
    const onExit = vi.fn()
    const { screen } = await renderFlow({ onExit })
    expect(stepOf(screen)).toBe('kana')
    screen.container.querySelector('button.brd__back').click()
    await settle(20)
    expect(onExit).toHaveBeenCalledTimes(1)
    // Once inside the flow, back is back again.
    await click(screen, '[data-kana="hiragana"]')
    await settle()
    expect(stepOf(screen)).toBe('reveal')
    screen.container.querySelector('button.brd__back').click()
    await settle()
    expect(stepOf(screen)).toBe('kana')
    expect(onExit).toHaveBeenCalledTimes(1)
  })

  // ── Where the card lives ─────────────────────────────────────────
  it('a guest’s card says it lives on this device, and the account sheet keeps it by a link', async () => {
    updateUser.mockResolvedValue({ data: { user: { email: null, new_email: 'patou@gmail.com', is_anonymous: true } }, error: null })
    const { screen } = await renderFlow({ guest: true })
    await toCardBeginner(screen)
    expect(q(screen, '.brd-keep-line').dataset.kept).toBe('device')
    await click(screen, '[data-action="keep"]')
    await settle(60)
    expect(sheet()).not.toBeNull()
    // Google, or an address; no password anywhere.
    expect(sheet().querySelectorAll('.auth-provider')).toHaveLength(1)
    expect(inSheet('input[type="password"]')).toBeNull()
    expect(inSheet('[data-action="account-link"]').disabled).toBe(true)
    type(inSheet('input[type="email"]'), 'patou@gmail.com')
    await settle(20)
    expect(inSheet('[data-action="account-link"]').disabled).toBe(false)
    await clickSheet('[data-action="account-link"]')
    await settle(60)
    // The address alone, the learner's language for the mail's template,
    // and the link back to this origin.
    expect(updateUser).toHaveBeenCalledWith(
      { email: 'patou@gmail.com', data: { lang: 'fr' } },
      { emailRedirectTo: `${window.location.origin}/` },
    )
    expect(sheet()).toBeNull()
    expect(q(screen, '.brd-keep-line').dataset.kept).toBe('sent')
    expect(q(screen, '.brd-keep-line').textContent).toContain('patou@gmail.com')
    await click(screen, '[data-action="issue"]')
    await settle(80)
    expect(done()[0]).toMatchObject({ kept: 'link' })
  })

  it('takes « Plus tard » for an answer: the guest rides on, the card says so', async () => {
    const { screen } = await renderFlow({ guest: true })
    await toCardBeginner(screen)
    await click(screen, '[data-action="keep"]')
    await settle(60)
    await clickSheet('[data-action="account-later"]')
    expect(sheet()).toBeNull()
    expect(q(screen, '.brd-keep-line').dataset.kept).toBe('device')
    await click(screen, '[data-action="issue"]')
    await settle(80)
    // The same single POST, on the same account the guest filled in.
    expect(completes()).toHaveLength(1)
    expect(done()[0]).toMatchObject({ kept: 'none' })
  })

  // Plan 269: the gate asks a guest for an address before it issues,
  // once, and « Continuer en invité » issues the card as it stands.
  it('asks a guest for an address before issuing, and lets them go on as a guest', async () => {
    const { screen } = await renderFlow({ guest: true })
    await toCardBeginner(screen)
    await click(screen, '[data-action="issue"]')
    await settle(60)
    expect(sheet()).not.toBeNull()
    expect(completes()).toHaveLength(0)
    expect(sheet().textContent).toContain(fr.brdAccountAsk)
    expect(inSheet('[data-action="account-later"]')).toBeNull()
    expect(inSheet('[data-action="account-guest"]').textContent).toBe(fr.brdStayGuest)
    await clickSheet('[data-action="account-guest"]')
    await settle(80)
    expect(sheet()).toBeNull()
    expect(completes()).toHaveLength(1)
    expect(done()[0]).toMatchObject({ kept: 'none' })
  })

  it('issues the card once the address the gate asked for is sent', async () => {
    updateUser.mockResolvedValue({ data: { user: { email: null, new_email: 'patou@gmail.com', is_anonymous: true } }, error: null })
    const { screen } = await renderFlow({ guest: true })
    await toCardBeginner(screen)
    await click(screen, '[data-action="issue"]')
    await settle(60)
    type(inSheet('input[type="email"]'), 'patou@gmail.com')
    await settle(20)
    await clickSheet('[data-action="account-link"]')
    await settle(80)
    expect(completes()).toHaveLength(1)
    expect(done()[0]).toMatchObject({ kept: 'link' })
  })

  it('asks once: shut without an answer, the gate issues on the next press', async () => {
    const { screen } = await renderFlow({ guest: true })
    await toCardBeginner(screen)
    await click(screen, '[data-action="issue"]')
    await settle(60)
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await settle(60)
    expect(sheet()).toBeNull()
    expect(completes()).toHaveLength(0)
    await click(screen, '[data-action="issue"]')
    await settle(80)
    expect(completes()).toHaveLength(1)
  })

  it('never asks an account boarded with', async () => {
    const { screen } = await renderFlow({ user: { email: 'aiko@example.com' } })
    await toCardBeginner(screen)
    await click(screen, '[data-action="issue"]')
    await settle(80)
    expect(sheet()).toBeNull()
    expect(completes()).toHaveLength(1)
  })

  it('an account boarded with says where the card is kept, and offers nothing', async () => {
    const { screen } = await renderFlow({ user: { email: 'aiko@example.com' } })
    await toCardBeginner(screen)
    const line = q(screen, '.brd-keep-line')
    expect(line.dataset.kept).toBe('account')
    expect(line.textContent).toContain('aiko@example.com')
    expect(q(screen, '[data-action="keep"]')).toBeNull()
  })

  // ── 名札 — whose pass it is (docs/oauth.md) ──────────────────────
  // Google's chooser can land a learner on an account no pass carried:
  // a NEW pass, with their journey on the other one. The card's line
  // says the address and holds the way to another account; a guest's
  // has nothing to switch from.
  it('tells a session with an address whose pass it is, and opens the way to another', async () => {
    const onSignIn = vi.fn()
    const { screen } = await renderFlow({ user: { email: 'aiko@example.com' }, onSignIn })
    await toCardBeginner(screen)
    const line = q(screen, '.brd-keep-line')
    expect(line.querySelector('.brd-keep-line__txt').textContent).toBe(fr.brdKeptEmail('aiko@example.com'))
    const door = q(screen, '[data-action="switch-account"]')
    expect(door.textContent).toBe(fr.brdKeptSwitch)
    await click(screen, '[data-action="switch-account"]')
    expect(onSignIn).toHaveBeenCalledTimes(1)
    // Nothing was issued on the way out.
    expect(completes()).toHaveLength(0)
  })

  it('offers a guest no account to switch from', async () => {
    const { screen } = await renderFlow({ guest: true, user: { email: null, is_anonymous: true }, onSignIn: vi.fn() })
    await toCardBeginner(screen)
    expect(q(screen, '.brd-keep-line').dataset.kept).toBe('device')
    expect(q(screen, '[data-action="switch-account"]')).toBeNull()
  })

  // ── 改札 — coming back from Google, on the web ──────────────────
  // The web leaves the page for Google and returns as a FRESH load: the
  // stash puts the learner back on the card, which says it is kept when
  // the round trip worked and reopens the account's sheet when it did not.
  it('comes back from Google onto the card, kept', async () => {
    stashed()
    const { screen } = await renderFlow({ guest: false })
    expect(stepOf(screen)).toBe('card')
    expect(sheet()).toBeNull()
    expect(q(screen, '.brd-keep-line').dataset.kept).toBe('google')
    expect(q(screen, '.brd-keep-line').textContent).toBe(fr.brdKeptGoogle)
    expect(code(screen, 'destination').textContent).toBe('N3')
    await click(screen, '[data-action="issue"]')
    await settle(80)
    expect(done()[0]).toMatchObject({ kept: 'google' })
  })

  it('says which Google account the card came back kept on', async () => {
    stashed()
    const { screen } = await renderFlow({ guest: false, user: { email: 'aiko@gmail.com', app_metadata: { provider: 'google' } }, onSignIn: vi.fn() })
    expect(stepOf(screen)).toBe('card')
    const line = q(screen, '.brd-keep-line')
    expect(line.dataset.kept).toBe('google')
    expect(line.querySelector('.brd-keep-line__txt').textContent).toBe(fr.brdKeptEmail('aiko@gmail.com'))
    expect(q(screen, '[data-action="switch-account"]')).toBeTruthy()
  })

  it('comes back from a refused round trip to the account sheet, with the reason on it', async () => {
    stashed()
    oauthRefusal.current = {
      error: 'server_error',
      code: 'identity_already_exists',
      description: 'Identity is already linked to another user',
    }
    const { screen } = await renderFlow({ guest: true })
    expect(stepOf(screen)).toBe('card')
    expect(inSheet('[data-oauth="refused"]')).not.toBeNull()
    // That Google account is somebody's pass already: offered as a
    // sign-in beside the link that could not happen.
    expect(sheet().querySelectorAll('.auth-provider')).toHaveLength(2)
  })

  it('offers no second Google button for a refusal signing in cannot answer', async () => {
    stashed()
    oauthRefusal.current = { error: 'server_error', code: 'manual_linking_disabled', description: 'Manual linking is disabled' }
    await renderFlow({ guest: true })
    expect(inSheet('[data-oauth="refused"]')).not.toBeNull()
    expect(sheet().querySelectorAll('.auth-provider')).toHaveLength(1)
  })

  // Supabase's refusal on the claim quotes the address it was about to
  // MAIL, which for a guest is empty: `Email address "" is invalid`, with
  // the learner's own address filled in one line above it.
  it('answers the link road in its own words, and stands the Google line down', async () => {
    stashed()
    oauthRefusal.current = {
      error: 'server_error',
      code: 'identity_already_exists',
      description: 'Identity is already linked to another user',
    }
    updateUser.mockResolvedValue({ data: {}, error: { code: 'email_address_invalid', message: 'Email address "" is invalid' } })
    await renderFlow({ guest: true })
    type(inSheet('input[type="email"]'), 'patou@gmail.com')
    await settle(20)
    await clickSheet('[data-action="account-link"]')
    await settle(60)
    const said = sheet().textContent
    expect(said).not.toContain('""')
    expect(said).toContain(fr.claimEmailUnreachable)
    // The older line steps aside rather than stacking under the new one…
    expect(inSheet('[data-oauth="refused"]')).toBeNull()
    // …while the way out of that refusal still stands.
    expect(sheet().querySelectorAll('.auth-provider')).toHaveLength(2)
  })

  // ── The hour's reminder, by platform ─────────────────────────────
  it('on a native shell the hour’s sheet carries the reminder, and the OS’s answer is the answer', async () => {
    nudgeRef.current = true
    const { screen } = await renderFlow()
    await toCardBeginner(screen)
    await door(screen, 'hour')
    expect(inSheet('[data-action="agenda"]')).toBeNull()
    expect(inSheet('[data-action="remind"]').getAttribute('aria-pressed')).toBe('false')
    await clickSheet('[data-action="remind"]')
    await settle(40)
    expect(requestNudge).toHaveBeenCalledTimes(1)
    expect(inSheet('[data-action="remind"]').getAttribute('aria-pressed')).toBe('true')
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await settle(60)
    await click(screen, '[data-action="issue"]')
    await settle(80)
    expect(posted().notifications).toBe(true)
  })

  it('on the web the hour’s sheet hands the learner a daily event for their own calendar', async () => {
    const { screen } = await renderFlow()
    await toCardBeginner(screen)
    await door(screen, 'hour')
    await clickSheet('[data-action="agenda"]')
    expect(saved).toHaveBeenCalledTimes(1)
    const ics = saved.mock.calls[0][0]
    expect(ics).toContain('BEGIN:VCALENDAR')
    expect(ics).toContain('RRULE:FREQ=DAILY')
    expect(ics).toMatch(/DTSTART:\d{8}T073000/)
    expect(ics).toContain(`SUMMARY:${fr.brdAgendaTitle}`)
  })

  // A welcome is announced as one: a fresh account's 200 are named as
  // given on the card that carries them.
  it('says the welcome is a gift on a fresh card', async () => {
    seedCredits({ balance: 200, cap: 50, dailyRefill: 30, plan: 'free', unlimited: false })
    const { screen } = await renderFlow()
    await toCardBeginner(screen)
    const balance = q(screen, '.pcb__meter--balance')
    expect(balance.textContent).toContain('200')
    expect(balance.textContent).toContain(fr.brdCreditsOffered)
  })
})
