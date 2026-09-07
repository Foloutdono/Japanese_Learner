import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { LangProvider } from '../LangContext'
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
vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: async () => ({ data: { session: { access_token: 'tok' } } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
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

async function renderFlow({ onComplete = vi.fn(), username = 'Tester', dryRun = false } = {}) {
  const screen = await render(
    <LangProvider>
      <BoardingFlow
        session={{ access_token: 'tok' }}
        initialProfile={{ username, level: 1, xp: 0, xpPrevLevel: 0, xpForNext: 100 }}
        onComplete={onComplete}
        dryRun={dryRun}
      />
    </LangProvider>
  )
  await settle(120)
  return { screen, onComplete }
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
  apiJson.mockImplementation(async path => (path === '/api/onboarding/volumes' ? VOLUMES : {}))
  apiJsonWithTimeout.mockImplementation(async path => {
    if (path === '/api/onboarding/complete') return { jlptLevel: 'N5', dailyNewTarget: 10, onboardedAt: 'x' }
    throw new Error(`unexpected ${path}`)
  })
})

describe('BoardingFlow', () => {
  it('walks name → why → kana (both) → level → goal → rhythm → time → building → plan → pass and POSTs the whole contract once', async () => {
    const { screen, onComplete } = await renderFlow()

    // 1/7 on the web: no nudge stop. The first screen has no back.
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
    expect(q(screen, '.brd-issue__seal').textContent).toBe('発行')
    // The balance on the pass's foot: 30 of 50.
    await settle(80)
    expect(q(screen, '.balance-line').textContent).toContain('30')
    expect(q(screen, '.balance-line').textContent).toContain('/ 50')
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

  it('kana → one script → the reveal, then the goal with the level set to N5; back keeps every answer', async () => {
    const { screen } = await renderFlow()
    await passName(screen, 'fun')
    await click(screen, '[data-kana="hiragana"]')
    await settle()

    expect(stepOf(screen)).toBe('reveal')
    expect(screen.container.querySelector('.brd__count').textContent).toBe('4/7')
    expect(live(screen).querySelectorAll('.brd-kana__read')).toHaveLength(2)
    await click(screen, '[data-action="continue"]')
    await settle()

    // Never the level list: a reader of one script boards at N5.
    expect(stepOf(screen)).toBe('goal')
    expect(q(screen, '.brd__hint').textContent).toContain('N5')
    expect(q(screen, '[data-goal="N4"]').getAttribute('aria-pressed')).toBe('true')

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
    await click(screen, '[data-action="continue"]')   // the goal (N4 preselected)
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
})
