import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { LangProvider } from '../LangContext'
import fr from '../locales/fr/index.js'
import '../index.css'

// ── The boarding, walked end to end (plan 075) ─────────────────
// Everything stays in memory and POSTs exactly once on "Enter the
// station", so what matters is: the screens chain in the canvas's
// order, the kana check branches both ways, the choices survive to the
// final payload, back walks the VISITED path with every answer kept,
// the name is the one thing written early (and refused on its own
// screen), the pass prints the balance, and the train pulls between
// screens. The browser lane runs fr-FR, so every hook here is a class
// or a data attribute, never a sentence.

const apiJson = vi.fn()
const apiJsonWithTimeout = vi.fn()
const patchResponse = { current: null }
const CREDITS = { balance: 30, cap: 50, dailyRefill: 30, refillAt: '2026-09-08T00:00:00+09:00', plan: 'free', unlimited: false }
const apiFetch = vi.fn(async (path, _session, opts) => {
  if (path === '/api/credits') return { ok: true, status: 200, json: async () => CREDITS }
  if (path === '/api/profile' && opts?.method === 'PATCH') {
    return patchResponse.current ?? { ok: true, status: 200, json: async () => JSON.parse(opts.body) }
  }
  return { ok: true, status: 200, json: async () => ({}) }
})

vi.mock('../lib/api', () => ({
  api: p => p,
  apiFetch: (...a) => apiFetch(...a),
  apiJson: (...a) => apiJson(...a),
  apiJsonWithTimeout: (...a) => apiJsonWithTimeout(...a),
  apiUpload: vi.fn(),
  ApiError: class ApiError extends Error {},
}))
// The claim road: putting an address on the pass is one updateUser
// call (lib/guest.js), and what it REFUSES with is the whole point of
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
// The nudge is native-only; one test flips it on.
const nudgeRef = { current: false }
vi.mock('../lib/platform', () => ({
  isNative: () => nudgeRef.current,
  canNudge: () => nudgeRef.current,
  requestNudgePermission: async () => nudgeRef.current,
}))
// 改札 — what the Google round trip came back with. Only the pending
// refusal is faked: the message and the classification stay real, so a
// renamed code or a missing string fails here too.
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
// LangContext pulls the content-translation maps over the network on
// mount — same stub the AnalyzerScreen polling test uses.
globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })

const { default: BoardingFlow } = await import('./BoardingFlow')

const VOLUMES = {
  vocab: { N5: 667, N4: 634, N3: 1832, N2: 1796, N1: 3476 },
  kanji: { N5: 103, N4: 166, N3: 367, N2: 367, N1: 1232 },
  grammar: { N5: 71, N4: 71, N3: 71, N2: 71, N1: 71 },
  kana: 224,
}

// The stash the web writes before leaving for Google, and the answers
// it carries back — the shortest walk's, so the resumed flow can price
// a plan and print a pass without being asked anything again.
const STASH_KEY = 'jp-boarding-stash'
const RESUMED = {
  name: 'Tester', motive: 'trip', kana: 'both', levelChoice: 'N1', jlpt: 'N1',
  goal: null, rhythm: 10, minute: 480, notifications: false,
}

// The pull is 260 ms; a settle clears it and the leaving car with it.
const settle = (ms = 340) => new Promise(r => setTimeout(r, ms))
const stepOf = screen => screen.container.querySelector('.brd')?.dataset.step
const live = screen => screen.container.querySelector('.brd__car:not(.brd__car--out)')
// The head (the back button, the track) stands outside the cars.
const q = (screen, sel) => live(screen).querySelector(sel) ?? screen.container.querySelector(sel)

// A native click's state lands on the next tick, so every click waits
// one before the next lands on the state it moved.
async function click(screen, sel) {
  const el = q(screen, sel)
  expect(el, sel).toBeTruthy()
  el.click()
  await settle(20)
}

const setValue = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
function type(el, value) {
  setValue.call(el, value)
  el.dispatchEvent(new Event('input', { bubbles: true }))
}

async function renderFlow({
  onComplete = vi.fn(), username = 'Tester', dryRun = false,
  onExit = undefined, onSignIn = undefined, guest = false, email = null,
} = {}) {
  const screen = await render(
    <LangProvider>
      <BoardingFlow
        session={{ access_token: 'tok', ...(email ? { user: { email } } : {}) }}
        initialProfile={{ username, level: 1, xp: 0, xpPrevLevel: 0, xpForNext: 100 }}
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

// Name → … → plan, by the shortest road: both scripts, N1, so the goal
// stop drops out and every remaining answer is already the default.
async function walkToPlan(screen) {
  await passName(screen)
  await click(screen, '[data-kana="both"]')
  await settle()
  await click(screen, '[data-level="N1"]')
  await click(screen, '[data-action="continue"]')
  await settle()
  await click(screen, '[data-action="continue"]')
  await settle()
  await click(screen, '[data-action="continue"]')
  await settle()
  await passBuilding(screen)
}

// Name → why: the saved name is kept, so no write happens here.
async function passName(screen, motive = 'trip') {
  expect(stepOf(screen)).toBe('name')
  await click(screen, '[data-action="continue"]')
  await settle()
  expect(stepOf(screen)).toBe('why')
  await click(screen, `[data-motive="${motive}"]`)
  await click(screen, '[data-action="continue"]')
  await settle()
  expect(stepOf(screen)).toBe('kana')
}

// The building screen is a wait with a visible end; any tap cuts to it.
async function passBuilding(screen) {
  expect(stepOf(screen)).toBe('building')
  await settle(100)
  q(screen, '.brd__body--center').click()
  await settle(120)
  expect(stepOf(screen)).toBe('plan')
  // The arrival signboard plays once over the plan; any input skips it.
  expect(document.querySelector('.onb-arrival')).not.toBeNull()
  window.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
  await settle(80)
  expect(document.querySelector('.onb-arrival')).toBeNull()
}

beforeEach(() => {
  apiJson.mockReset()
  apiJsonWithTimeout.mockReset()
  apiFetch.mockClear()
  patchResponse.current = null
  nudgeRef.current = false
  oauthRefusal.current = null
  updateUser.mockReset()
  sessionStorage.removeItem(STASH_KEY)
  apiJson.mockImplementation(async path => (path === '/api/onboarding/volumes' ? VOLUMES : {}))
  apiJsonWithTimeout.mockImplementation(async path => {
    if (path === '/api/onboarding/complete') return { jlptLevel: 'N5', dailyNewTarget: 10, onboardedAt: 'x' }
    throw new Error(`unexpected ${path}`)
  })
})

describe('BoardingFlow', () => {
  it('walks name → why → kana (both) → level → goal → rhythm → time → building → plan → pass and POSTs the whole contract once', async () => {
    const { screen, onComplete } = await renderFlow()

    // 1/7 on the web: no nudge stop. Back on the first screen leaves the
    // flow, so with no `onExit` to leave for there is no button — the
    // guest boarding always passes one (see its own tests below).
    expect(stepOf(screen)).toBe('name')
    expect(screen.container.querySelector('.brd__count').textContent).toBe('1/7')
    expect(screen.container.querySelector('button.brd__back')).toBeNull()
    expect(document.activeElement?.className).toContain('brd-field')

    // A new name is written before the office moves on.
    type(q(screen, '.brd-field'), 'Aiko')
    await click(screen, '[data-action="continue"]')
    await settle()
    const patches = apiFetch.mock.calls.filter(c => c[0] === '/api/profile' && c[2]?.method === 'PATCH')
    expect(patches).toHaveLength(1)
    expect(JSON.parse(patches[0][2].body)).toEqual({ username: 'Aiko' })
    expect(stepOf(screen)).toBe('why')
    expect(q(screen, '.brd__q').textContent).toContain('Aiko')
    expect(q(screen, '.brd__q-em').textContent).toBe('Aiko')
    // Focus landed on the question.
    expect(document.activeElement?.className).toContain('brd__q')
    // No choice, no way on.
    expect(q(screen, '[data-action="continue"]').disabled).toBe(true)
    await click(screen, '[data-motive="trip"]')
    expect(q(screen, '[data-motive="trip"]').getAttribute('aria-pressed')).toBe('true')
    await click(screen, '[data-action="continue"]')
    await settle()

    expect(stepOf(screen)).toBe('kana')
    expect(screen.container.querySelector('.brd__count').textContent).toBe('3/7')
    // The answers are the foot: each one advances.
    expect(q(screen, '.brd__foot')).toBeNull()
    await click(screen, '[data-kana="both"]')
    await settle()
    expect(stepOf(screen)).toBe('level')
    expect(screen.container.querySelector('.brd__count').textContent).toBe('4/7')
    expect(q(screen, '[data-level="novice"] .brd-opt__code').textContent).toBe('—')
    // The volumes price the list: N5's ~100 kanji, N1's ~2,250.
    expect(q(screen, '[data-level="N5"] .brd-opt__desc').textContent).toContain('100')
    await click(screen, '[data-level="N5"]')
    await click(screen, '[data-action="continue"]')
    await settle()

    expect(stepOf(screen)).toBe('goal')
    // Only the stops ahead, the next one marked and preselected.
    expect(live(screen).querySelectorAll('[data-goal]')).toHaveLength(4)
    expect(q(screen, '[data-goal="N4"]').getAttribute('aria-pressed')).toBe('true')
    expect(q(screen, '[data-goal="N4"] .brd-tag')).not.toBeNull()
    expect(q(screen, '[data-goal="N3"] .brd-tag')).toBeNull()
    await click(screen, '[data-action="continue"]')
    await settle()

    expect(stepOf(screen)).toBe('rhythm')
    expect(q(screen, '[data-rhythm="10"]').getAttribute('aria-pressed')).toBe('true')
    expect(q(screen, '[data-rhythm="10"] .brd-tag')).not.toBeNull()
    await click(screen, '[data-rhythm="15"]')
    expect(q(screen, '[data-rhythm="15"]').getAttribute('aria-pressed')).toBe('true')
    await click(screen, '[data-action="continue"]')
    await settle()

    expect(stepOf(screen)).toBe('time')
    expect(screen.container.querySelector('.brd__count').textContent).toBe('7/7')
    expect(q(screen, '.brd-board__flaps').getAttribute('aria-label')).toBe('07:30')
    // ── The board settles rather than arriving set ──
    // A 発車標 lights with every drum turning and stops them one after
    // another from the left. The label is the hour throughout, so a
    // screen reader is told the time and never the shuffle.
    expect(live(screen).querySelectorAll('.brd-flap--spin').length).toBeGreaterThan(0)
    await settle(1100)
    expect(live(screen).querySelectorAll('.brd-flap--spin')).toHaveLength(0)
    expect([...live(screen).querySelectorAll('.brd-flap')].map(el => el.textContent).join(''))
      .toBe('0730')
    expect(q(screen, '[data-hour="am"]').getAttribute('aria-pressed')).toBe('true')
    await click(screen, '[data-hour="pm"]')
    expect(q(screen, '.brd-board__flaps').getAttribute('aria-label')).toBe('21:00')
    const knob = q(screen, '.brd-day__train')
    expect(knob.getAttribute('role')).toBe('slider')
    expect(knob.getAttribute('aria-valuetext')).toBe('21:00')
    knob.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }))
    await settle(30)
    expect(q(screen, '.brd-day__train').getAttribute('aria-valuetext')).toBe('20:30')
    expect(q(screen, '[data-hour="pm"]').getAttribute('aria-pressed')).toBe('true')
    await click(screen, '[data-action="continue"]')
    await settle()

    // The three arrival screens have no track and no back.
    expect(stepOf(screen)).toBe('building')
    expect(screen.container.querySelector('.brd__head')).toBeNull()
    expect(live(screen).querySelectorAll('.brd-step')).toHaveLength(4)
    await passBuilding(screen)
    expect(screen.container.querySelector('.brd__head')).toBeNull()
    expect(live(screen).querySelectorAll('.brd-bullet')).toHaveLength(4)
    expect(q(screen, '.brd-chart svg')).not.toBeNull()
    expect(q(screen, '.brd-bullet').textContent).toContain('~')
    expect(live(screen).querySelectorAll('.brd-bullet')[3].textContent).toContain('N4')
    await click(screen, '[data-action="continue"]')
    await settle()

    expect(stepOf(screen)).toBe('pass')
    const pass = q(screen, '.pass')
    expect(pass).not.toBeNull()
    expect(pass.textContent).toContain('Aiko')
    // The 発行 seal that used to land on the card is gone (owner's
    // call): the printed pass says it is issued by being printed.
    expect(screen.container.querySelector('.brd-issue__seal')).toBeNull()
    // The balance on the pass's foot: 30 of 50, counted up to rather
    // than printed — the figure climbs for about a second.
    await settle(1700)
    expect(q(screen, '.balance-line').textContent).toContain('30')
    expect(q(screen, '.balance-line').textContent).toContain('/ 50')
    // This account already had those 30; only a welcome is announced as
    // one, and this is not a welcome.
    expect(screen.container.querySelector('.brd-gift')).toBeNull()
    expect(apiJsonWithTimeout).not.toHaveBeenCalled()

    await click(screen, '[data-action="enter"]')
    await settle(80)
    const completes = apiJsonWithTimeout.mock.calls.filter(c => c[0] === '/api/onboarding/complete')
    expect(completes).toHaveLength(1)
    const body = JSON.parse(completes[0][2].body)
    expect(body.jlptLevel).toBe('N5')
    expect(body.dailyNewTarget).toBe(15)
    expect(body.goalLevel).toBe('N4')
    expect(body.goalTargetDate).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(body.dailyDeparture).toBe('pm')
    expect(body.motive).toBe('trip')
    expect(body.kanaKnown).toBe('both')
    expect(body.rhythmMin).toBe(15)
    expect(body.reminderTime).toBe('20:30')
    expect(body.notifications).toBe(false)
    expect(typeof body.tzOffsetMin).toBe('number')
    expect(onComplete).toHaveBeenCalledTimes(1)
  })

  // A reader of one script is a NOVICE, not an N5: they never saw the
  // level list AND their goal list opened at N4, so the goal they are
  // likeliest to have — reach N5 — was the one they could not pick
  // (owner's report). The office still stores N5 for them.
  it('kana → one script → the reveal, then the whole line ahead, the novice’s stop at its head', async () => {
    const { screen } = await renderFlow()
    await passName(screen, 'fun')
    await click(screen, '[data-kana="hiragana"]')
    await settle()

    expect(stepOf(screen)).toBe('reveal')
    expect(screen.container.querySelector('.brd__count').textContent).toBe('4/7')
    expect(live(screen).querySelectorAll('.brd-kana__read')).toHaveLength(2)
    await click(screen, '[data-action="continue"]')
    await settle()

    // Never the level list: the answer is the level. But it boards them
    // before the novice's own stop as well — that stop IS the kana, and
    // they read one script — so the whole line is ahead of them with the
    // kana at its head, and there is no stop behind them to name.
    expect(stepOf(screen)).toBe('goal')
    expect(q(screen, '.brd__hint').textContent).toBe('Tous les arrêts sont devant vous.')
    expect([...live(screen).querySelectorAll('[data-goal]')].map(el => el.dataset.goal))
      .toEqual(['novice', 'N5', 'N4', 'N3', 'N2', 'N1'])
    expect(q(screen, '[data-goal="novice"] .brd-opt__code').textContent).toBe('—')
    expect(q(screen, '[data-goal="novice"] .brd-tag')).not.toBeNull()
    // The default is still the nearest JLPT stop: the kana are an offer,
    // and taking them signs a pace and no destination.
    expect(q(screen, '[data-goal="N5"]').getAttribute('aria-pressed')).toBe('true')
    expect(q(screen, '[data-goal="novice"]').getAttribute('aria-pressed')).toBe('false')
    expect(q(screen, '[data-goal="N5"] .brd-tag')).toBeNull()

    // Back walks the visited path, answers intact.
    await click(screen, 'button.brd__back')
    await settle()
    expect(stepOf(screen)).toBe('reveal')
    await click(screen, 'button.brd__back')
    await settle()
    expect(stepOf(screen)).toBe('kana')
    expect(q(screen, '[data-kana="hiragana"]').getAttribute('aria-pressed')).toBe('true')
    await click(screen, 'button.brd__back')
    await settle()
    expect(stepOf(screen)).toBe('why')
    expect(q(screen, '[data-motive="fun"]').getAttribute('aria-pressed')).toBe('true')
    await click(screen, 'button.brd__back')
    await settle()
    expect(stepOf(screen)).toBe('name')
    expect(q(screen, '.brd-field').value).toBe('Tester')
    expect(screen.container.querySelector('button.brd__back')).toBeNull()
    // No write happened: the name never changed.
    expect(apiFetch.mock.calls.filter(c => c[0] === '/api/profile')).toHaveLength(0)
  })

  // ── The kana as a destination ──
  // The novice's stop is one a beginner can ride TO, and the office
  // signs it like any other: it goes onto the pass as goalLevel
  // 'novice' with a date, priced at the syllabary. The plan promises
  // signs rather than the word count and the motive's two lines, which
  // three weeks of kana could not honour.
  it('takes the novice’s own stop as the goal: the plan promises the kana, the office signs it', async () => {
    const { screen } = await renderFlow()
    await passName(screen, 'trip')
    await click(screen, '[data-kana="none"]')
    await settle()
    await click(screen, '[data-action="continue"]')   // the reveal
    await settle()

    expect(stepOf(screen)).toBe('goal')
    await click(screen, '[data-goal="novice"]')
    expect(q(screen, '[data-goal="novice"]').getAttribute('aria-pressed')).toBe('true')
    expect(q(screen, '[data-goal="N5"]').getAttribute('aria-pressed')).toBe('false')
    await click(screen, '[data-action="continue"]')
    await settle()
    await click(screen, '[data-action="continue"]')   // the rhythm
    await settle()
    await click(screen, '[data-action="continue"]')   // the hour
    await settle()

    // The destination stands alone on the building screen: they are
    // short of that stop, not standing on it, so no "Novice → Novice".
    // The first line is stamped after one tick (600 ms).
    expect(stepOf(screen)).toBe('building')
    await settle(700)
    expect(q(screen, '[data-build="goal"] .brd-step__val').textContent).toBe('Novice')
    await passBuilding(screen)

    // Three promises, none of them a word count or a motive's line.
    const bullets = [...live(screen).querySelectorAll('.brd-bullet')].map(el => el.textContent)
    expect(bullets).toHaveLength(3)
    expect(bullets[0]).toContain('kana')
    expect(bullets[2]).toBe('En route vers les kana')
    expect(bullets.join(' ')).not.toContain('mots')
    // The chart climbs to the signs on the ride, all 224 of them.
    expect(q(screen, '.brd-chart__lbl').textContent).toBe('~224 kana · révisions quotidiennes')

    await click(screen, '[data-action="continue"]')
    await settle()
    await click(screen, '[data-action="enter"]')
    await settle(80)
    const body = JSON.parse(apiJsonWithTimeout.mock.calls[0][2].body)
    expect(body.jlptLevel).toBe('N5')
    expect(body.kanaKnown).toBe('none')
    expect(body.goalLevel).toBe('novice')
    expect(body.goalTargetDate).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  // ── The welcome, counted onto the pass ──
  // The balance a fresh account is given is the one figure on that
  // screen the learner did not work for, and it printed like every
  // other: already there, in the same grey as the refill line under
  // it (owner's call — "transmitting the feeling that you are lucky to
  // receive this").
  it('counts the welcome onto a fresh pass, and says it is a gift', async () => {
    const { seedCredits } = await import('../stores/credits')
    seedCredits({ balance: 200, cap: 50, dailyRefill: 30, plan: 'free', unlimited: false })
    const { screen } = await renderFlow()
    await walkToPlan(screen)
    await click(screen, '[data-action="continue"]')
    await settle()
    expect(stepOf(screen)).toBe('pass')

    // The note names the gift while the figure climbs to it …
    expect(q(screen, '.brd-gift').textContent).toContain('200')
    expect(Number(q(screen, '.balance-line .jour-line__validity b').textContent)).toBeLessThan(200)
    // … and the figure lands on what the account actually holds.
    await settle(1700)
    expect(q(screen, '.balance-line .jour-line__validity b').textContent).toBe('200')
    seedCredits(CREDITS)
  })

  it('a reader of both scripts at N1 has no stop ahead: the goal is skipped and the track shortens', async () => {
    const { screen } = await renderFlow()
    await passName(screen)
    await click(screen, '[data-kana="both"]')
    await settle()
    await click(screen, '[data-level="N1"]')
    await click(screen, '[data-action="continue"]')
    await settle()
    expect(stepOf(screen)).toBe('rhythm')
    expect(screen.container.querySelector('.brd__count').textContent).toBe('5/6')
    await click(screen, '[data-action="continue"]')
    await settle()
    await click(screen, '[data-action="continue"]')
    await settle()
    await passBuilding(screen)
    await click(screen, '[data-action="continue"]')
    await settle()
    await click(screen, '[data-action="enter"]')
    await settle(80)
    const body = JSON.parse(apiJsonWithTimeout.mock.calls[0][2].body)
    expect(body.jlptLevel).toBe('N1')
    expect(body).not.toHaveProperty('goalLevel')
    expect(body).not.toHaveProperty('goalTargetDate')
  })

  it('refuses a taken or invalid name on its own screen, never on the pass', async () => {
    const { screen } = await renderFlow()
    type(q(screen, '.brd-field'), 'a')
    await click(screen, '[data-action="continue"]')
    await settle(60)
    expect(stepOf(screen)).toBe('name')
    expect(q(screen, '.brd__error')).not.toBeNull()
    expect(apiFetch.mock.calls.filter(c => c[0] === '/api/profile')).toHaveLength(0)

    patchResponse.current = { ok: false, status: 409, json: async () => ({ detail: 'Username already taken' }) }
    type(q(screen, '.brd-field'), 'Aiko')
    expect(q(screen, '.brd__error')).toBeNull() // typing clears the refusal
    await click(screen, '[data-action="continue"]')
    await settle(60)
    expect(stepOf(screen)).toBe('name')
    expect(q(screen, '.brd__error')).not.toBeNull()

    patchResponse.current = null
    await click(screen, '[data-action="continue"]')
    await settle()
    expect(stepOf(screen)).toBe('why')
  })

  it('on a native shell the nudge is the eighth stop and Allow signs the reminder', async () => {
    nudgeRef.current = true
    const { screen } = await renderFlow()
    expect(screen.container.querySelector('.brd__count').textContent).toBe('1/8')
    await passName(screen)
    await click(screen, '[data-kana="none"]')
    await settle()
    await click(screen, '[data-action="continue"]')   // the reveal
    await settle()
    await click(screen, '[data-action="continue"]')   // the goal (N5 preselected: a novice)
    await settle()
    await click(screen, '[data-action="continue"]')   // the rhythm
    await settle()
    await click(screen, '[data-action="continue"]')   // the hour
    await settle()
    expect(stepOf(screen)).toBe('nudge')
    expect(screen.container.querySelector('.brd__count').textContent).toBe('8/8')
    expect(q(screen, '.brd-notif__title').textContent).toContain('07:30')
    await click(screen, '[data-action="allow"]')
    await settle()
    await passBuilding(screen)
    await click(screen, '[data-action="continue"]')
    await settle()
    await click(screen, '[data-action="enter"]')
    await settle(80)
    const body = JSON.parse(apiJsonWithTimeout.mock.calls[0][2].body)
    expect(body.notifications).toBe(true)
    expect(body.reminderTime).toBe('07:30')
    expect(body.dailyDeparture).toBe('am')
    expect(body.kanaKnown).toBe('none')
    expect(body.jlptLevel).toBe('N5')
  })

  it('a failed save keeps the pass on screen with the error and the action live', async () => {
    apiJsonWithTimeout.mockRejectedValue(new Error('down'))
    const { screen, onComplete } = await renderFlow()
    await passName(screen)
    await click(screen, '[data-kana="both"]')
    await settle()
    await click(screen, '[data-level="N4"]')
    await click(screen, '[data-action="continue"]')
    await settle()
    await click(screen, '[data-action="continue"]')
    await settle()
    await click(screen, '[data-action="continue"]')
    await settle()
    await click(screen, '[data-action="continue"]')
    await settle()
    await passBuilding(screen)
    await click(screen, '[data-action="continue"]')
    await settle()
    await click(screen, '[data-action="enter"]')
    await settle(80)
    expect(stepOf(screen)).toBe('pass')
    expect(q(screen, '.brd__error')).not.toBeNull()
    expect(q(screen, '[data-action="enter"]').disabled).toBe(false)
    expect(onComplete).not.toHaveBeenCalled()
  })

  it('the train pulls: the leaving car slides out beside the arriving one, then is dropped', async () => {
    const { screen } = await renderFlow()
    await click(screen, '[data-action="continue"]')
    await settle(30)
    const out = screen.container.querySelector('.brd__car--out')
    expect(out).not.toBeNull()
    expect(out.dataset.dir).toBe('fwd')
    expect(out.dataset.step ?? stepOf(screen)).toBeTruthy()
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

  it('dryRun walks the whole ride and writes nothing', async () => {
    const { screen, onComplete } = await renderFlow({ dryRun: true })
    type(q(screen, '.brd-field'), 'Aiko')
    await click(screen, '[data-action="continue"]')
    await settle()
    expect(stepOf(screen)).toBe('why')
    await click(screen, '[data-motive="other"]')
    await click(screen, '[data-action="continue"]')
    await settle()
    await click(screen, '[data-kana="katakana"]')
    await settle()
    await click(screen, '[data-action="continue"]')
    await settle()
    await click(screen, '[data-action="continue"]')
    await settle()
    await click(screen, '[data-action="continue"]')
    await settle()
    await click(screen, '[data-action="continue"]')
    await settle()
    await passBuilding(screen)
    await click(screen, '[data-action="continue"]')
    await settle()
    await click(screen, '[data-action="enter"]')
    await settle(60)
    expect(onComplete).toHaveBeenCalledTimes(1)
    expect(apiJsonWithTimeout).not.toHaveBeenCalled()
    expect(apiFetch.mock.calls.filter(c => c[0] === '/api/profile')).toHaveLength(0)
  })

  // ── 仮乗車券 — boarding without an account ──────────────────────
  // The account moved from the door to the end of the line, and became
  // refusable. Three things carry that: a way back out of the first
  // question, a named way to an account you already have, and a last
  // stop that takes no for an answer.

  it('leaves for Welcome from the first question, where the sign-in is', async () => {
    const onExit = vi.fn()
    const { screen } = await renderFlow({ onExit })
    expect(stepOf(screen)).toBe('name')
    const back = screen.container.querySelector('button.brd__back')
    expect(back).not.toBeNull()
    back.click()
    await settle(20)
    expect(onExit).toHaveBeenCalledTimes(1)

    // Once inside the flow, back is back again — leaving is only ever
    // the first question's meaning of it.
    await click(screen, '[data-action="continue"]')
    await settle()
    expect(stepOf(screen)).toBe('why')
    screen.container.querySelector('button.brd__back').click()
    await settle()
    expect(stepOf(screen)).toBe('name')
    expect(onExit).toHaveBeenCalledTimes(1)
  })

  // ── the focus ring stands inside every box that clips ──
  // The name field is the full width of the body, the body scrolls, and
  // a box that scrolls one axis clips the other (`overflow-y: auto`
  // computes overflow-x to `auto` — the spec, not a quirk). An outline
  // is drawn OUTSIDE the border box and never counts as scrollable
  // overflow, so the focused field's ring was sliced off flush with its
  // own left and right edges: two corner arcs left hanging in the air,
  // no sides. Measured rather than described, and walked up the whole
  // chain — the frame's own clip had already been widened for this once
  // and the body inside it went on cutting anyway.
  it('keeps the focused name field’s ring clear of every clipping ancestor', async () => {
    const { screen } = await renderFlow()
    expect(stepOf(screen)).toBe('name')
    const field = q(screen, '.brd-field')
    field.focus()
    expect(document.activeElement).toBe(field)

    // A focused text input always matches :focus-visible, so this is
    // the ring as drawn. Reading it (rather than assuming 4) is what
    // keeps the gutters below honest if the ring is ever restyled.
    const ink = getComputedStyle(field)
    const reach = parseFloat(ink.outlineWidth) + parseFloat(ink.outlineOffset)
    expect(reach).toBe(4)

    const box = field.getBoundingClientRect()
    const clips = []
    for (let el = field.parentElement; el && el !== document.body; el = el.parentElement) {
      const s = getComputedStyle(el)
      if (s.overflowX === 'visible') continue
      // Overflow clips at the padding box, not the border box.
      const r = el.getBoundingClientRect()
      const left = r.left + parseFloat(s.borderLeftWidth)
      const right = r.right - parseFloat(s.borderRightWidth)
      clips.push([el.className, left, right])
      expect.soft(box.left - reach, `${el.className} cuts the ring on the left`).toBeGreaterThanOrEqual(left)
      expect.soft(box.right + reach, `${el.className} cuts the ring on the right`).toBeLessThanOrEqual(right)
    }
    // The body is one of them: if it ever stops clipping, the gutter it
    // carries for the ring is dead weight and this test proved nothing.
    expect(clips.map(c => c[0])).toContain('brd__body')
  })

  it('names the way to an account you already have, on the very first screen', async () => {
    const onSignIn = vi.fn()
    const { screen } = await renderFlow({ onSignIn })
    await click(screen, '[data-action="sign-in"]')
    expect(onSignIn).toHaveBeenCalledTimes(1)
  })

  // The boarding only ever runs on an account with no journey on it,
  // so an address on question one means a NEW pass for that address.
  // It is written for the learner who pressed "Continue with Google",
  // landed on a pass Supabase had just minted for an identity nobody
  // carried, and was shown seven questions with no hint that their own
  // journey was on another account — the sign-in link is right below.
  it('names the pass when there is an address on it, and the way out beside it', async () => {
    const { screen } = await renderFlow({ email: 'aiko@example.com', onSignIn: vi.fn() })
    expect(stepOf(screen)).toBe('name')
    const hint = q(screen, '.brd__hint')
    expect(hint?.textContent).toBe(fr.brdNameNewPass('aiko@example.com'))
    expect(q(screen, '[data-action="sign-in"]')).toBeTruthy()
  })

  it('says nothing of the sort on a guest pass, which has no address', async () => {
    const { screen } = await renderFlow({ guest: true })
    expect(stepOf(screen)).toBe('name')
    expect(q(screen, '.brd__hint')).toBeNull()
  })

  it('asks a guest for an account at the END, and takes no for an answer', async () => {
    const onSignIn = vi.fn()
    const { screen } = await renderFlow({ guest: true, onSignIn })
    await walkToPlan(screen)
    await click(screen, '[data-action="continue"]')
    await settle()

    // The last stop before the pass, not the first before anything.
    expect(stepOf(screen)).toBe('account')
    expect(apiJsonWithTimeout).not.toHaveBeenCalled()
    // Nothing is created from nothing here: no credentials, no way on
    // through the gold button.
    expect(q(screen, '[data-action="account-create"]').disabled).toBe(true)
    // …and the account you already have is reachable from here too.
    await click(screen, '[data-action="account-sign-in"]')
    expect(onSignIn).toHaveBeenCalledTimes(1)

    // The refusal is the point of the screen.
    await click(screen, '[data-action="account-skip"]')
    await settle()
    expect(stepOf(screen)).toBe('pass')
    await click(screen, '[data-action="enter"]')
    await settle(80)
    // Refusing the account changes nothing about the contract: the same
    // single POST, on the same real account the guest has been filling
    // in all along.
    expect(apiJsonWithTimeout.mock.calls.filter(c => c[0] === '/api/onboarding/complete')).toHaveLength(1)
  })

  it('does not ask twice: a learner who already has credentials goes straight to the pass', async () => {
    const { screen } = await renderFlow({ guest: false })
    await walkToPlan(screen)
    await click(screen, '[data-action="continue"]')
    await settle()
    expect(stepOf(screen)).toBe('pass')
  })

  // ── 改札 — coming back from Google, on the web ──────────────────
  // The web leaves the page for Google and returns as a FRESH load, so
  // the account step is the one screen this flow can be re-entered on
  // having already been answered. The button's own onDone never runs:
  // the navigation unmounted the component that would have called it.
  // Everything below is about what the learner is shown on that
  // return, which — before this — was the same question again, with
  // nothing said either way.

  it('comes back from a Google sign-in onto the pass, not onto the offer it just answered', async () => {
    sessionStorage.setItem(STASH_KEY, JSON.stringify({ answers: RESUMED, step: 'account', savedName: 'Tester' }))
    // No longer a guest: the round trip put credentials on the pass.
    const { screen } = await renderFlow({ guest: false })
    expect(stepOf(screen)).toBe('pass')
  })

  it('comes back from a refused round trip to the offer, with the reason on it', async () => {
    sessionStorage.setItem(STASH_KEY, JSON.stringify({ answers: RESUMED, step: 'account', savedName: 'Tester' }))
    // Still a guest: nothing was linked, so the offer still stands.
    oauthRefusal.current = {
      error: 'server_error',
      code: 'identity_already_exists',
      description: 'Identity is already linked to another user',
    }
    const { screen } = await renderFlow({ guest: true })
    expect(stepOf(screen)).toBe('account')
    expect(q(screen, '[data-oauth="refused"]')).not.toBeNull()
    // That Google account is somebody's pass already — so it is
    // offered as a sign-in beside the link that could not happen.
    expect(live(screen).querySelectorAll('.auth-provider')).toHaveLength(2)
  })

  it('offers no second Google button for a refusal signing in cannot answer', async () => {
    sessionStorage.setItem(STASH_KEY, JSON.stringify({ answers: RESUMED, step: 'account', savedName: 'Tester' }))
    oauthRefusal.current = { error: 'server_error', code: 'manual_linking_disabled', description: 'Manual linking is disabled' }
    const { screen } = await renderFlow({ guest: true })
    expect(q(screen, '[data-oauth="refused"]')).not.toBeNull()
    expect(live(screen).querySelectorAll('.auth-provider')).toHaveLength(1)
  })

  // ── Google turned them away, so they took the email road ────────
  // Both refusals at once is the state this screen was found in: the
  // Google line cannot expire (it is a fact about the page load), and
  // Supabase's own refusal on the claim quotes the address it was
  // about to MAIL — which for a guest is empty. So the learner read
  // `Email address "" is invalid` with their address filled in one
  // line above it, under a sentence about a road they had already
  // left. Neither half of that survives here.
  it('answers the email road in its own words, and stands the Google line down', async () => {
    sessionStorage.setItem(STASH_KEY, JSON.stringify({ answers: RESUMED, step: 'account', savedName: 'Tester' }))
    oauthRefusal.current = {
      error: 'server_error',
      code: 'identity_already_exists',
      description: 'Identity is already linked to another user',
    }
    updateUser.mockResolvedValue({
      data: {},
      error: { code: 'email_address_invalid', message: 'Email address "" is invalid' },
    })
    const { screen } = await renderFlow({ guest: true })
    expect(stepOf(screen)).toBe('account')
    expect(q(screen, '[data-oauth="refused"]')).not.toBeNull()

    type(q(screen, 'input[type="email"]'), 'patou@gmail.com')
    type(q(screen, 'input[type="password"]'), 'hunter22')
    await settle(20)
    // The address is a real one, so the gold button is a road again.
    expect(q(screen, '[data-action="account-create"]').disabled).toBe(false)
    await click(screen, '[data-action="account-create"]')
    await settle(60)

    const said = live(screen).textContent
    expect(updateUser).toHaveBeenCalledWith({ email: 'patou@gmail.com', password: 'hunter22' })
    expect(said).not.toContain('""')
    expect(said).toContain(fr.claimEmailUnreachable)
    // The older line steps aside rather than stacking under the new one…
    expect(q(screen, '[data-oauth="refused"]')).toBeNull()
    expect(said).not.toContain(fr.oauthAlreadyLinked)
    // …while the way OUT of that refusal is still standing, because it
    // is still true: that Google account is still somebody's pass.
    expect(live(screen).querySelectorAll('.auth-provider')).toHaveLength(2)
  })
})
