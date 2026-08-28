import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { LangProvider } from '../LangContext'

// ── The ticket office, walked end to end ───────────────────────
// The flow keeps everything in memory and POSTs exactly once, so what
// matters is: the steps chain in order, the choices survive to the
// final payload, skip completes with the defaults, and back() walks
// the VISITED path (level picked directly must never "return" to a
// placement test that never ran).

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

beforeEach(() => {
  apiJson.mockReset()
  apiJsonWithTimeout.mockReset()
  apiJson.mockImplementation(async path => {
    if (path === '/api/onboarding/volumes') return VOLUMES
    return {}
  })
})

describe('OnboardingFlow', () => {
  it('walks welcome → level → pace → projection → tour → pass and POSTs the choices once', async () => {
    apiJsonWithTimeout.mockImplementation(async path => {
      if (path === '/api/onboarding/complete') return { jlptLevel: 'N4', dailyNewTarget: 10, onboardedAt: 'x' }
      throw new Error(`unexpected ${path}`)
    })

    const { screen, onComplete } = await renderFlow()
    await settle()
    expect(stepOf(screen)).toBe('welcome')

    clickButton(screen, '.onb-action')            // Continuer
    await settle()
    expect(stepOf(screen)).toBe('level')

    clickButton(screen, '.route-stop', 'N4')
    await settle()
    expect(stepOf(screen)).toBe('pace')

    clickButton(screen, '.onb-pace', '快速')      // 10 / day
    await settle()
    expect(stepOf(screen)).toBe('projection')
    // The projection actually rendered from the volumes payload: the
    // N4 journey's first milestone is N4 itself.
    expect(screen.container.querySelector('.onb-map')).not.toBeNull()
    expect(screen.container.textContent).toContain('N4')

    clickButton(screen, '.onb-action')
    await settle()
    expect(stepOf(screen)).toBe('tour')

    clickButton(screen, '.onb-action')
    await settle()
    expect(stepOf(screen)).toBe('pass')
    expect(screen.container.querySelector('.onb-pass__level').textContent).toBe('N4')

    clickButton(screen, '.onb-action--board')
    await settle()

    const completeCalls = apiJsonWithTimeout.mock.calls.filter(c => c[0] === '/api/onboarding/complete')
    expect(completeCalls).toHaveLength(1)
    expect(JSON.parse(completeCalls[0][2].body)).toEqual({ jlptLevel: 'N4', dailyNewTarget: 10 })
    expect(onComplete).toHaveBeenCalledTimes(1)
  })

  it('skip completes immediately with N5 and the default pace', async () => {
    apiJsonWithTimeout.mockResolvedValue({ jlptLevel: 'N5', dailyNewTarget: 10, onboardedAt: 'x' })

    const { screen, onComplete } = await renderFlow()
    await settle()
    clickButton(screen, '.onb-action')            // → level
    await settle()

    clickButton(screen, '.onb-skip')
    await settle()

    const completeCalls = apiJsonWithTimeout.mock.calls.filter(c => c[0] === '/api/onboarding/complete')
    expect(completeCalls).toHaveLength(1)
    expect(JSON.parse(completeCalls[0][2].body)).toEqual({ jlptLevel: 'N5', dailyNewTarget: 10 })
    expect(onComplete).toHaveBeenCalledTimes(1)
  })

  it('back from pace returns to level, never to a placement that never ran', async () => {
    const { screen } = await renderFlow()
    await settle()
    clickButton(screen, '.onb-action')            // → level
    await settle()
    clickButton(screen, '.route-stop', 'N3')      // → pace, placement skipped
    await settle()
    expect(stepOf(screen)).toBe('pace')

    clickButton(screen, '.onb-back')
    await settle()
    expect(stepOf(screen)).toBe('level')
  })

  it('runs the placement branch: paper → answers → result → override → pace', async () => {
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
    clickButton(screen, '.onb-action')            // → level
    await settle()
    clickButton(screen, '.onb-alt--test')         // → placement
    await settle()
    expect(stepOf(screen)).toBe('placement')

    // Question 1 (N5): no stop-here escape inside the first block.
    expect([...screen.container.querySelectorAll('.onb-link')].some(b => b.textContent.includes('arrêter'))).toBe(false)
    clickButton(screen, '.mcq-row', 'あ')
    await settle(30)
    clickButton(screen, '.onb-action')            // next question
    await settle()

    // Question 2 (N4): past the first block, the escape appears.
    expect([...screen.container.querySelectorAll('.onb-link')].some(b => b.textContent.includes('arrêter'))).toBe(true)
    clickButton(screen, '.mcq-row', 'い')
    await settle(30)
    clickButton(screen, '.onb-action')            // finish → score
    await settle()

    // Result panel: recommendation marked, any station overridable.
    expect(screen.container.textContent).toContain('N4')
    clickButton(screen, '.onb-seg__btn', 'N3')    // override
    await settle(30)
    clickButton(screen, '.onb-action')            // continue
    await settle()
    expect(stepOf(screen)).toBe('pace')
  })

  it('skip names the level it will actually complete at, not always N5', async () => {
    const { screen } = await renderFlow()
    await settle()
    clickButton(screen, '.onb-action')            // → level
    await settle()
    expect(screen.container.querySelector('.onb-skip').textContent).toContain('N5')

    clickButton(screen, '.route-stop', 'N2')      // → pace, level chosen
    await settle()
    const skipBtn = screen.container.querySelector('.onb-skip')
    expect(skipBtn.textContent).toContain('N2')
    expect(skipBtn.textContent).not.toContain('N5')
  })

  it('back from pace redisplays the placement RESULT — never a fresh test', async () => {
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
    clickButton(screen, '.onb-action')            // → level
    await settle()
    clickButton(screen, '.onb-alt--test')         // → placement
    await settle()
    clickButton(screen, '.mcq-row', 'あ')
    await settle(30)
    clickButton(screen, '.onb-action')            // finish → score → result
    await settle()
    clickButton(screen, '.onb-action')            // continue → pace
    await settle()
    expect(stepOf(screen)).toBe('pace')

    clickButton(screen, '.onb-back')              // ← back to placement
    await settle()
    // The score panel, with all its answers intact — not a re-fetch.
    expect(screen.container.querySelector('.onb-result__levels')).not.toBeNull()
    const paperFetches = apiJsonWithTimeout.mock.calls.filter(c => c[0] === '/api/onboarding/placement')
    expect(paperFetches).toHaveLength(1)

    // A fresh test IS reachable — through the explicit retake link only.
    clickButton(screen, '.onb-result__retake')
    await settle()
    expect(screen.container.querySelector('.mcq-row')).not.toBeNull()
    expect(apiJsonWithTimeout.mock.calls.filter(c => c[0] === '/api/onboarding/placement')).toHaveLength(2)
  })

  it('the rapid pace card carries the recommended badge', async () => {
    const { screen } = await renderFlow()
    await settle()
    clickButton(screen, '.onb-action')            // → level
    await settle()
    clickButton(screen, '.route-stop', 'N4')      // → pace
    await settle()
    const badge = screen.container.querySelector('.onb-pace .onb-reco-badge')
    expect(badge).not.toBeNull()
    expect(badge.closest('.onb-pace').textContent).toContain('快速')
  })

  it('focus lands on the new step heading after advancing', async () => {
    const { screen } = await renderFlow()
    await settle()
    clickButton(screen, '.onb-action')            // → level
    await settle()
    expect(document.activeElement?.className ?? '').toContain('onb-step__title')
  })

  it('the arrival cutscene plays on first tour entry, is skippable, and never replays', async () => {
    const { screen } = await renderFlow()
    await settle()
    clickButton(screen, '.onb-action')            // → level
    await settle()
    clickButton(screen, '.route-stop', 'N4')      // → pace
    await settle()
    clickButton(screen, '.onb-pace', '快速')      // → projection
    await settle()
    clickButton(screen, '.onb-action')            // → tour: the arrival mounts
    await settle(80)
    expect(document.querySelector('.arrival')).not.toBeNull()
    // The tour is interactive UNDERNEATH the overlay from frame one.
    expect(screen.container.querySelector('.onb-tour')).not.toBeNull()

    window.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    await settle(80)
    expect(document.querySelector('.arrival')).toBeNull()

    clickButton(screen, '.onb-action')            // tour → pass
    await settle()
    clickButton(screen, '.onb-back')              // ← back to tour
    await settle(80)
    expect(stepOf(screen)).toBe('tour')
    expect(document.querySelector('.arrival')).toBeNull() // once means once
  })

  it('the tour demos answer and flip in place without advancing the step', async () => {
    const { screen } = await renderFlow()
    await settle()
    clickButton(screen, '.onb-action')
    await settle()
    clickButton(screen, '.route-stop', 'N4')
    await settle()
    clickButton(screen, '.onb-pace', '快速')
    await settle()
    clickButton(screen, '.onb-action')            // → tour
    window.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })) // skip the arrival
    await settle(80)

    // The exam demo grades the tap in place.
    clickButton(screen, '.mcq-row', 'わたし')
    await settle(30)
    expect(screen.container.querySelector('.mcq-row--correct')).not.toBeNull()
    expect(stepOf(screen)).toBe('tour')

    // The vocab flashcard flips to its meaning.
    screen.container.querySelector('.flashcard').click()
    await settle(80)
    expect(screen.container.querySelector('.meaning-display__primary')?.textContent ?? '')
      .toMatch(/cat/i)
    expect(stepOf(screen)).toBe('tour')
  })
})
