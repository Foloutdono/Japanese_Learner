import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { LangProvider } from '../LangContext'

// ── The ticket office, walked end to end ───────────────────────
// The flow keeps everything in memory and POSTs exactly once, so what
// matters is: the steps chain in order, the choices survive to the
// final payload, skip completes with the defaults, and back() walks
// the VISITED path. Plan 063's final shape (phase F): five scenes —
// 試乗 (a real card rated before any question) → 乗車駅 → 行先 (the
// departure board IS the control) → 案内 (the promise: the ghost
// track met before day one) → 定期券 (the application signs LAST,
// the pass prints, the gate opens).

const apiJson = vi.fn()
const apiJsonWithTimeout = vi.fn()
const apiFetch = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({}) }))

vi.mock('../lib/api', () => ({
  api: p => p,
  apiFetch: (...a) => apiFetch(...a),
  apiJson: (...a) => apiJson(...a),
  apiJsonWithTimeout: (...a) => apiJsonWithTimeout(...a),
  apiUpload: vi.fn(),
  ApiError: class ApiError extends Error {},
}))

// LangContext pulls the content-translation maps over the network on
// mount — same stub the AnalyzerScreen polling test uses.
globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })

const { default: OnboardingFlow } = await import('./OnboardingFlow')
const { DAYS_PER_MONTH, addDays } = await import('../domain/goalMath')

// The office computes goalTargetDate at POST time with a fresh clock;
// asserting equality across a possible midnight tick means accepting
// either side's date.
const isoInDays = days => addDays(new Date(), days).toISOString().slice(0, 10)

const VOLUMES = {
  vocab: { N5: 667, N4: 634, N3: 1832, N2: 1796, N1: 3476 },
  kanji: { N5: 103, N4: 166, N3: 367, N2: 367, N1: 1232 },
  grammar: { N5: 71, N4: 71, N3: 71, N2: 71, N1: 71 },
  kana: 224,
}

const CHOICES = [
  { id: 'c1', textJp: 'あ' }, { id: 'c2', textJp: 'い' },
  { id: 'c3', textJp: 'う' }, { id: 'c4', textJp: 'え' },
]
const question = (id, sectionId) => ({
  id, sectionId, sectionLabel: sectionId, mondaiId: `m_${id}`, mondaiNumber: 1,
  number: 1, type: 'mcq-text', kind: 'reading', promptJp: '毎月', choices: CHOICES,
})

const settle = (ms = 80) => new Promise(r => setTimeout(r, ms))

function stepOf(screen) {
  return screen.container.querySelector('.onb')?.dataset.step
}

function clickButton(screen, selector, text) {
  const all = [...screen.container.querySelectorAll(selector)]
  const btn = text ? all.find(b => b.textContent.includes(text)) : all[0]
  expect(btn, `${selector} ${text ?? ''}`).toBeTruthy()
  btn.click()
}

async function renderFlow(onComplete = vi.fn()) {
  const screen = await render(
    <LangProvider>
      <OnboardingFlow session={{ access_token: 'tok' }} initialProfile={{ username: 'Tester' }} onComplete={onComplete} />
    </LangProvider>
  )
  return { onComplete, screen }
}

// Scene one, cleared the quick way — the name is asked LAST now, so
// the ride skips straight to boarding.
async function passRide(screen) {
  expect(stepOf(screen)).toBe('ride')
  clickButton(screen, '.onb-ride__skip')
  await settle()
  expect(stepOf(screen)).toBe('level')
}

// Through 案内 to the pass: the promise scene has one Continue.
async function passPromise(screen) {
  expect(stepOf(screen)).toBe('map')
  window.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })) // skip the arrival
  await settle(80)
  clickButton(screen, '.onb-action')
  await settle()
  expect(stepOf(screen)).toBe('pass')
}

beforeEach(() => {
  apiJson.mockReset()
  apiJsonWithTimeout.mockReset()
  apiJson.mockImplementation(async path => {
    if (path === '/api/onboarding/volumes') return VOLUMES
    return {}
  })
})

describe('OnboardingFlow', () => {
  it('walks ride → level → goal → map → sign → pass and POSTs the full contract once', async () => {
    apiJsonWithTimeout.mockImplementation(async path => {
      if (path === '/api/onboarding/complete') return { jlptLevel: 'N4', dailyNewTarget: 15, onboardedAt: 'x' }
      throw new Error(`unexpected ${path}`)
    })

    const { screen, onComplete } = await renderFlow()
    await settle()
    await passRide(screen)

    clickButton(screen, '.onb-lvl', 'N4')
    await settle()
    expect(stepOf(screen)).toBe('goal')
    // Boarding at N4 points the destination two stops up: N2, by
    // date, twelve months — priced at 15/day; the charter is yours.
    expect(screen.container.querySelector('.onb-dest__chip[aria-pressed="true"] .onb-dest__roundel').textContent).toBe('N2')
    expect(screen.container.querySelector('.onb-board__row--yours')).not.toBeNull()

    const before = isoInDays(12 * DAYS_PER_MONTH)
    clickButton(screen, '.onb-action')            // Continue → the promise
    const after = isoInDays(12 * DAYS_PER_MONTH)
    await settle()
    await passPromise(screen)

    // Beat one: the application. Sign the daily hour as 夜.
    expect(screen.container.querySelector('.onb-form')).not.toBeNull()
    expect(screen.container.querySelector('.onb-pass')).toBeNull()
    clickButton(screen, '.onb-form__chip', '夜')
    await settle(30)
    expect(
      screen.container.querySelector('.onb-form__chip[aria-pressed="true"]').textContent
    ).toContain('夜')

    clickButton(screen, '.onb-action')            // 発行 — print
    await settle()

    // Beat two: the printed pass — route, honest service name, gold
    // 有効期限, the departure hour, the seal, the vow.
    const pass = screen.container.querySelector('.onb-pass')
    expect(pass).not.toBeNull()
    expect(pass.querySelector('.onb-pass__route').textContent).toContain('N4')
    expect(pass.querySelector('.onb-pass__route').textContent).toContain('N2')
    expect(pass.textContent).toContain('新快速')
    expect(pass.querySelector('.onb-pass__v--gold').textContent).not.toBe('—')
    expect(pass.textContent).toContain('21:00')
    expect(pass.querySelector('.onb-pass__seal')).not.toBeNull()
    const vow = screen.container.querySelector('.onb-vow')
    expect(vow.textContent).toContain('あなた')
    expect(vow.textContent).toContain('窓口')
    expect(vow.textContent).toContain('21:00')

    clickButton(screen, '.onb-action--board')
    await settle()

    const completeCalls = apiJsonWithTimeout.mock.calls.filter(c => c[0] === '/api/onboarding/complete')
    expect(completeCalls).toHaveLength(1)
    const body = JSON.parse(completeCalls[0][2].body)
    expect(body.jlptLevel).toBe('N4')
    expect(body.dailyNewTarget).toBe(15)
    expect(body.goalLevel).toBe('N2')
    expect([before, after]).toContain(body.goalTargetDate)
    expect(body.dailyDeparture).toBe('pm')
    expect(onComplete).toHaveBeenCalledTimes(1)
  })

  it('the first ride: flip, rate honestly, the stamp inks live, Continue appears', async () => {
    const { screen } = await renderFlow()
    await settle()
    expect(stepOf(screen)).toBe('ride')

    // Before the flip the bar is reserved space, not an instrument.
    expect(screen.container.querySelector('.rating-bar--idle')).not.toBeNull()
    expect(screen.container.querySelector('.onb-ride__won')).toBeNull()

    screen.container.querySelector('.flashcard').click()
    await settle()
    expect(screen.container.querySelector('.rating-bar--idle')).toBeNull()

    // ANY rating completes the scene — take the worst one on purpose.
    clickButton(screen, '.rating-bar__btn--q0')
    await settle()

    expect(screen.container.querySelector('.onb-ride__won')).not.toBeNull()
    expect(stepOf(screen)).toBe('ride')
    const first = screen.container.querySelector('.onb-line__stop')
    expect(first.className).toContain('onb-line__stop--past')
    expect(first.className).toContain('onb-line__stop--fresh')
    expect(first.querySelector('.onb-line__stamp').textContent).toBe('試')

    clickButton(screen, '.onb-action')            // Continue → boarding
    await settle()
    expect(stepOf(screen)).toBe('level')
    // Coming back shows the finished state, never a replay.
    clickButton(screen, '.onb-back')
    await settle()
    expect(screen.container.querySelector('.onb-ride__won')).not.toBeNull()
    expect(screen.container.querySelector('.rating-bar')).toBeNull()
  })

  it('boarding rows read the sign: jp station names, the sentences, the loads', async () => {
    const { screen } = await renderFlow()
    await settle()
    await passRide(screen)

    const rows = [...screen.container.querySelectorAll('.onb-lvl')]
    expect(rows).toHaveLength(5)
    expect(rows.map(r => r.querySelector('.onb-lvl__roundel').textContent))
      .toEqual(['N5', 'N4', 'N3', 'N2', 'N1'])
    expect(rows[0].textContent).toContain('入門')
    expect(rows[0].textContent).toContain('これはペンです。')
    expect(rows[4].textContent).toContain('終着')
    expect(rows[0].querySelector('.onb-lvl__load').textContent).toContain('841')
  })

  it('the stamp rally inks passed stops, and only the newest stamp is fresh', async () => {
    const { screen } = await renderFlow()
    await settle()
    await passRide(screen)                        // 試 inked
    clickButton(screen, '.onb-lvl', 'N4')         // → goal, 乗 inked
    await settle()

    const stops = [...screen.container.querySelectorAll('.onb-line__stop')]
    expect(stops).toHaveLength(5)
    const pastStamps = stops
      .filter(st => st.className.includes('--past'))
      .map(st => st.querySelector('.onb-line__stamp').textContent)
    expect(pastStamps).toEqual(['試', '乗'])
    expect(stops[3].querySelector('.onb-line__stamp').textContent).toBe('')
    const fresh = stops.filter(st => st.className.includes('--fresh'))
    expect(fresh).toHaveLength(1)
    expect(fresh[0].querySelector('.onb-line__stamp').textContent).toBe('乗')

    clickButton(screen, '.onb-back')
    await settle()
    expect(screen.container.querySelector('.onb-line__stop--fresh')).toBeNull()
  })

  it('skip completes immediately with N5 and the default pace', async () => {
    apiJsonWithTimeout.mockResolvedValue({ jlptLevel: 'N5', dailyNewTarget: 10, onboardedAt: 'x' })

    const { screen, onComplete } = await renderFlow()
    await settle()
    await passRide(screen)

    clickButton(screen, '.onb-skip')
    await settle()

    const completeCalls = apiJsonWithTimeout.mock.calls.filter(c => c[0] === '/api/onboarding/complete')
    expect(completeCalls).toHaveLength(1)
    expect(JSON.parse(completeCalls[0][2].body)).toEqual({ jlptLevel: 'N5', dailyNewTarget: 10 })
    expect(onComplete).toHaveBeenCalledTimes(1)
  })

  it('refuses an impossible date on the board itself, and the fixes repair it', async () => {
    const { screen } = await renderFlow()
    await settle()
    await passRide(screen)
    clickButton(screen, '.onb-lvl', 'N5')         // → goal (dest N3 by default)
    await settle()

    clickButton(screen, '.onb-dest__chip', 'N1')  // the far terminus…
    await settle(30)
    clickButton(screen, '.onb-months__chip', '3') // …in three months
    await settle(30)

    expect(screen.container.querySelector('.onb-board__row--void')).not.toBeNull()
    expect(screen.container.querySelector('.onb-board__notice')).not.toBeNull()
    const continueBtn = [...screen.container.querySelectorAll('.onb-action')].at(-1)
    expect(continueBtn.disabled).toBe(true)
    expect(screen.container.querySelector('.onb-call')).toBeNull()

    clickButton(screen, '.onb-board__fix')
    await settle(30)
    expect(screen.container.querySelector('.onb-board__notice')).toBeNull()
    expect(continueBtn.disabled).toBe(false)
    expect(screen.container.querySelector('.onb-call')).not.toBeNull()
  })

  it('the charter dial keeps its node across drags, and a date-mode row click adopts that service', async () => {
    const { screen } = await renderFlow()
    await settle()
    await passRide(screen)
    clickButton(screen, '.onb-lvl', 'N5')         // → goal, date mode
    await settle()

    clickButton(screen, '.onb-board__row', '特急')
    await settle(30)
    expect(screen.container.querySelector('.onb-mode__btn[aria-pressed="true"]').textContent).toContain('rythme')
    expect(screen.container.querySelector('.onb-board__row[aria-pressed="true"]').textContent).toContain('特急')

    const setValue = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    const drag = (el, v) => {
      setValue.call(el, v)
      el.dispatchEvent(new Event('input', { bubbles: true }))
    }
    const dial = screen.container.querySelector('.onb-board__dial')
    expect(dial).not.toBeNull()
    drag(dial, '8')
    await settle(30)
    expect(screen.container.querySelector('.onb-board__dial')).toBe(dial)
    drag(dial, '7')
    await settle(30)
    expect(screen.container.querySelector('.onb-board__dial')).toBe(dial)
    expect(screen.container.querySelector('.onb-board__row--charter[data-selected]')).not.toBeNull()
    expect(screen.container.querySelector('.onb-board__row[aria-pressed="true"]')).toBeNull()
  })

  it('未定 rides pace-only: no date controls, and the POST carries no goal and no hour', async () => {
    apiJsonWithTimeout.mockResolvedValue({ jlptLevel: 'N5', dailyNewTarget: 10, onboardedAt: 'x' })
    const { screen } = await renderFlow()
    await settle()
    await passRide(screen)
    clickButton(screen, '.onb-lvl', 'N5')         // → goal
    await settle()

    clickButton(screen, '.onb-dest__chip--free')
    await settle(30)
    expect(screen.container.querySelector('.onb-mode')).toBeNull()
    expect(screen.container.querySelector('.onb-months')).toBeNull()
    expect(screen.container.querySelector('.onb-call__stop--goal')).toBeNull()

    clickButton(screen, '.onb-action')            // Continue → the promise
    await settle()
    await passPromise(screen)
    clickButton(screen, '.onb-action')            // 発行 — print (no hour chosen)
    await settle()
    // A goal-less pass prints no validity.
    expect(screen.container.querySelector('.onb-pass__v--gold').textContent).toBe('—')
    clickButton(screen, '.onb-action--board')
    await settle()
    const body = JSON.parse(
      apiJsonWithTimeout.mock.calls.find(c => c[0] === '/api/onboarding/complete')[2].body
    )
    expect(body).toEqual({ jlptLevel: 'N5', dailyNewTarget: 10 })
  })

  it('the application signs last: the hour toggles, printing can be re-edited without losing it', async () => {
    const { screen } = await renderFlow()
    await settle()
    await passRide(screen)
    clickButton(screen, '.onb-lvl', 'N4')
    await settle()
    clickButton(screen, '.onb-action')
    await settle()
    await passPromise(screen)

    // 自由 is the standing default; picking 朝 rings it, picking it
    // again returns to 自由.
    expect(screen.container.querySelector('.onb-form__chip[aria-pressed="true"]').textContent).toContain('自由')
    clickButton(screen, '.onb-form__chip', '朝')
    await settle(30)
    expect(screen.container.querySelector('.onb-form__chip[aria-pressed="true"]').textContent).toContain('朝')

    clickButton(screen, '.onb-action')            // print
    await settle()
    expect(screen.container.querySelector('.onb-pass').textContent).toContain('07:30')

    clickButton(screen, '.onb-link', 'Modifier')  // ← edit the application
    await settle()
    expect(screen.container.querySelector('.onb-form')).not.toBeNull()
    // The signed hour survived the round trip.
    expect(screen.container.querySelector('.onb-form__chip[aria-pressed="true"]').textContent).toContain('朝')
  })

  it('back from the goal returns to level, never to a placement that never ran', async () => {
    const { screen } = await renderFlow()
    await settle()
    await passRide(screen)
    clickButton(screen, '.onb-lvl', 'N3')
    await settle()
    expect(stepOf(screen)).toBe('goal')

    clickButton(screen, '.onb-back')
    await settle()
    expect(stepOf(screen)).toBe('level')
  })

  it('runs the placement branch: paper → answers → result → override → goal', async () => {
    apiJsonWithTimeout.mockImplementation(async (path, _s, opts) => {
      if (path === '/api/onboarding/placement') {
        return { seed: 7, questions: [question('q1', 'N5'), question('q2', 'N4')] }
      }
      if (path === '/api/onboarding/placement/score') {
        expect(JSON.parse(opts.body).seed).toBe(7)
        return {
          recommendedLevel: 'N4', correct: 1, total: 2,
          perLevel: { N5: { correct: 1, total: 1, pct: 100 }, N4: { correct: 0, total: 1, pct: 0 } },
        }
      }
      throw new Error(`unexpected ${path}`)
    })

    const { screen } = await renderFlow()
    await settle()
    await passRide(screen)
    clickButton(screen, '.onb-alt--test')
    await settle()
    expect(stepOf(screen)).toBe('placement')

    expect([...screen.container.querySelectorAll('.onb-link')].some(b => b.textContent.includes('arrêter'))).toBe(false)
    clickButton(screen, '.mcq-row', 'あ')
    await settle(30)
    clickButton(screen, '.onb-action')
    await settle()

    expect([...screen.container.querySelectorAll('.onb-link')].some(b => b.textContent.includes('arrêter'))).toBe(true)
    clickButton(screen, '.mcq-row', 'い')
    await settle(30)
    clickButton(screen, '.onb-action')
    await settle()

    expect(screen.container.textContent).toContain('N4')
    clickButton(screen, '.onb-seg__btn', 'N3')
    await settle(30)
    clickButton(screen, '.onb-action')
    await settle()
    expect(stepOf(screen)).toBe('goal')
  })

  it('skip names the level it will actually complete at, not always N5', async () => {
    const { screen } = await renderFlow()
    await settle()
    await passRide(screen)
    expect(screen.container.querySelector('.onb-skip').textContent).toContain('N5')

    clickButton(screen, '.onb-lvl', 'N2')
    await settle()
    const skipBtn = screen.container.querySelector('.onb-skip')
    expect(skipBtn.textContent).toContain('N2')
    expect(skipBtn.textContent).not.toContain('N5')
  })

  it('back from the goal redisplays the placement RESULT — never a fresh test', async () => {
    apiJsonWithTimeout.mockImplementation(async path => {
      if (path === '/api/onboarding/placement') {
        return { seed: 7, questions: [question('q1', 'N5')] }
      }
      if (path === '/api/onboarding/placement/score') {
        return { recommendedLevel: 'N4', correct: 1, total: 1, perLevel: { N5: { correct: 1, total: 1, pct: 100 } } }
      }
      throw new Error(`unexpected ${path}`)
    })

    const { screen } = await renderFlow()
    await settle()
    await passRide(screen)
    clickButton(screen, '.onb-alt--test')
    await settle()
    clickButton(screen, '.mcq-row', 'あ')
    await settle(30)
    clickButton(screen, '.onb-action')
    await settle()
    clickButton(screen, '.onb-action')
    await settle()
    expect(stepOf(screen)).toBe('goal')

    clickButton(screen, '.onb-back')
    await settle()
    expect(screen.container.querySelector('.onb-result__levels')).not.toBeNull()
    const paperFetches = apiJsonWithTimeout.mock.calls.filter(c => c[0] === '/api/onboarding/placement')
    expect(paperFetches).toHaveLength(1)

    clickButton(screen, '.onb-result__retake')
    await settle()
    expect(screen.container.querySelector('.mcq-row')).not.toBeNull()
    expect(apiJsonWithTimeout.mock.calls.filter(c => c[0] === '/api/onboarding/placement')).toHaveLength(2)
  })

  it('推奨 marks the slowest sufficient service by date, the steady 快速 by pace', async () => {
    const { screen } = await renderFlow()
    await settle()
    await passRide(screen)
    clickButton(screen, '.onb-lvl', 'N4')         // → goal: N2 in 12 mo
    await settle()
    let reco = screen.container.querySelector('.onb-board__reco')
    expect(reco).not.toBeNull()
    expect(reco.closest('.onb-board__row').textContent).toContain('新快速')

    clickButton(screen, '.onb-mode__btn', 'rythme')
    await settle(30)
    reco = screen.container.querySelector('.onb-board__reco')
    expect(reco.closest('.onb-board__row').textContent).toContain('快速')
  })

  it('focus lands on the new step heading after advancing', async () => {
    const { screen } = await renderFlow()
    await settle()
    await passRide(screen)
    expect(document.activeElement?.className ?? '').toContain('onb-step__title')
  })

  it('the promise scene: the arrival plays once over the learner’s own line', async () => {
    const { screen } = await renderFlow()
    await settle()
    await passRide(screen)
    clickButton(screen, '.onb-lvl', 'N4')
    await settle()
    clickButton(screen, '.onb-action')            // → 案内: the arrival mounts
    await settle(80)
    expect(document.querySelector('.onb-arrival')).not.toBeNull()
    // The promise is mounted and readable UNDERNEATH the overlay: the
    // learner's own line (N4 → N2) on the shared two-lane track.
    const promise = screen.container.querySelector('.onb-promise')
    expect(promise).not.toBeNull()
    expect(promise.textContent).toContain('N2')
    expect(promise.querySelector('.jour-track')).not.toBeNull()
    expect(promise.querySelector('.jour-track__plan')).not.toBeNull()
    // …and the four lines are named beneath it.
    expect(screen.container.querySelectorAll('.onb-lines__roundel')).toHaveLength(4)

    window.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    await settle(80)
    expect(document.querySelector('.onb-arrival')).toBeNull()

    clickButton(screen, '.onb-action')            // promise → pass
    await settle()
    clickButton(screen, '.onb-back')              // ← back to the promise
    await settle(80)
    expect(stepOf(screen)).toBe('map')
    expect(document.querySelector('.onb-arrival')).toBeNull() // once means once
  })
})
