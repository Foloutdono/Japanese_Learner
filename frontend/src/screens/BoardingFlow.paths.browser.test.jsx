import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { userEvent } from 'vitest/browser'
import { LangProvider } from '../LangContext'
import fr from '../locales/fr/index.js'
import { ApiError } from '../lib/api'
import '../index.css'

// ── No dead end on the way to the card (plan 247) ─────────────────
// The boarding is the one screen a learner cannot route around: the app
// stands behind it, and a beginner who is stuck on it has no other way
// in. So every road is walked here with its failures put in its way,
// and each screen is held to the same two promises: a way on, and a way
// back. The kana's four answers each reach the card; every sheet the
// card opens can be shut (Escape, the scrim, a pick, or its own gate);
// the test survives its server failing at either end; the gate says
// which of three things went wrong when the card cannot be issued, and
// keeps itself pressable; the phone's Back shuts a sheet before it
// leaves the card; a goal picked rides through a return to the level; a
// link sent to a wrong address is mended from the line under the card;
// a phone that will not ask again is said to; no volumes still issue;
// and an old stash is never resumed.

const apiJson = vi.fn()
const apiJsonWithTimeout = vi.fn()
const apiFetch = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({}) }))
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
const nudgeRef = { current: false }
const nudgeState = { current: 'prompt' }
const requestNudge = vi.fn(async () => false)
vi.mock('../lib/platform', () => ({
  isNative: () => nudgeRef.current,
  canNudge: () => nudgeRef.current,
  requestNudgePermission: () => requestNudge(),
  nudgePermission: async () => nudgeState.current,
}))
vi.mock('../lib/authRedirect', async (importOriginal) => ({
  ...(await importOriginal()),
  authRedirectError: () => null,
}))
vi.mock('../lib/audio', async (importOriginal) => ({
  ...(await importOriginal()),
  playPlatformChime: vi.fn(),
  playClick: vi.fn(),
}))
vi.mock('../lib/track', async (importOriginal) => ({ ...(await importOriginal()), track: vi.fn() }))
vi.mock('../lib/calendarFile', async (importOriginal) => ({ ...(await importOriginal()), saveCalendar: vi.fn() }))
globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })

const { default: BoardingFlow } = await import('./BoardingFlow')
const { seedCredits } = await import('../stores/credits')

const VOLUMES = {
  vocab: { N5: 667, N4: 634, N3: 1832, N2: 1796, N1: 3476 },
  kanji: { N5: 103, N4: 166, N3: 367, N2: 367, N1: 1232 },
  grammar: { N5: 71, N4: 71, N3: 71, N2: 71, N1: 71 },
  kana: 224,
}
const CREDITS = { balance: 30, cap: 50, dailyRefill: 30, nextCreditAt: '2026-09-08T00:00:00+09:00', plan: 'free', unlimited: false }
const QUESTION = {
  id: 'q1', sectionId: 'N5', kind: 'context', type: 'mcq-text', promptJp: '（　）を　のみます。',
  choices: ['みず', 'ほん', 'いす', 'まど'].map((textJp, i) => ({ id: `c${i + 1}`, textJp })),
}
const STASH_KEY = 'jp-boarding-stash'

const settle = (ms = 340) => new Promise(r => setTimeout(r, ms))
const stepOf = screen => screen.container.querySelector('.brd')?.dataset.step
const live = screen => screen.container.querySelector('.brd__car:not(.brd__car--out)')
const q = (screen, sel) => live(screen)?.querySelector(sel) ?? screen.container.querySelector(sel)
const sheet = () => document.querySelector('.brd-sheet')
const inSheet = sel => sheet()?.querySelector(sel) ?? null
const completes = () => apiJsonWithTimeout.mock.calls.filter(c => c[0] === '/api/onboarding/complete')

async function click(screen, sel) {
  const el = q(screen, sel)
  expect(el, sel).toBeTruthy()
  el.click()
  await settle(20)
}
async function clickSheet(sel) {
  const el = inSheet(sel)
  expect(el, sel).toBeTruthy()
  el.click()
  await settle(80)
}
const setValue = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
function type(el, value) {
  setValue.call(el, value)
  el.dispatchEvent(new Event('input', { bubbles: true }))
}
const popped = () => new Promise(r => window.addEventListener('popstate', () => setTimeout(r, 80), { once: true }))

async function renderFlow({ onComplete = vi.fn(), onExit = vi.fn(), guest = false } = {}) {
  const screen = await render(
    <LangProvider>
      <BoardingFlow session={{ access_token: 'tok' }} onComplete={onComplete} onExit={onExit} guest={guest} />
    </LangProvider>
  )
  await settle(120)
  return { screen, onComplete, onExit }
}

async function toCardReader(screen, level = 'N4') {
  await click(screen, '[data-kana="both"]')
  await settle()
  await click(screen, `[data-level="${level}"]`)
  await click(screen, '[data-action="continue"]')
  await settle()
  expect(stepOf(screen)).toBe('card')
}

beforeEach(() => {
  apiJson.mockReset()
  apiJsonWithTimeout.mockReset()
  updateUser.mockReset()
  requestNudge.mockReset()
  requestNudge.mockImplementation(async () => false)
  nudgeRef.current = false
  nudgeState.current = 'prompt'
  sessionStorage.removeItem(STASH_KEY)
  seedCredits(CREDITS)
  apiJson.mockImplementation(async path => (path === '/api/onboarding/volumes' ? VOLUMES : {}))
  apiJsonWithTimeout.mockImplementation(async path => {
    if (path === '/api/onboarding/complete') return { jlptLevel: 'N5', dailyNewTarget: 10, onboardedAt: 'x' }
    throw new Error(`unexpected ${path}`)
  })
})

describe('every road from the kana reaches the card', () => {
  it.each(['none', 'hiragana', 'katakana', 'both'])('« %s »: a way on and a way back at every screen, every answer kept', async kana => {
    const { screen, onComplete, onExit } = await renderFlow()
    // The kana: four answers, and the way out of the boarding.
    expect(live(screen).querySelectorAll('[data-kana]')).toHaveLength(4)
    expect(q(screen, 'button.brd__back')).not.toBeNull()

    const answer = async () => {
      await click(screen, `[data-kana="${kana}"]`)
      await settle()
      if (kana !== 'both') {
        expect(stepOf(screen)).toBe('reveal')
        return
      }
      expect(stepOf(screen)).toBe('level')
      // Nothing picked, nothing to go on with -- and the way to find it out.
      expect(q(screen, '[data-action="level-test"]')).not.toBeNull()
    }
    await answer()
    if (kana === 'both') {
      expect(q(screen, '[data-action="continue"]').disabled).toBe(true)
      await click(screen, '[data-level="N3"]')
    }
    expect(q(screen, '[data-action="continue"]').disabled).toBe(false)

    // Back to the kana, its answer kept; on again, the level kept too.
    await click(screen, 'button.brd__back')
    await settle()
    expect(stepOf(screen)).toBe('kana')
    expect(q(screen, `[data-kana="${kana}"]`).getAttribute('aria-pressed')).toBe('true')
    await answer()
    if (kana === 'both') expect(q(screen, '[data-level="N3"]').getAttribute('aria-pressed')).toBe('true')
    await click(screen, '[data-action="continue"]')
    await settle()
    expect(stepOf(screen)).toBe('card')

    // The card: no head, and its origin is the way back to the question
    // that set it -- the level, or the kana.
    expect(q(screen, 'button.brd__back')).toBeNull()
    await click(screen, '[data-door="level"]')
    await settle()
    expect(stepOf(screen)).toBe(kana === 'both' ? 'level' : 'kana')
    if (kana === 'both') await click(screen, '[data-action="continue"]')
    else await answer()
    if (kana !== 'both') await click(screen, '[data-action="continue"]')
    await settle()
    expect(stepOf(screen)).toBe('card')

    // And it issues, once.
    expect(q(screen, '[data-action="issue"]').disabled).toBe(false)
    await click(screen, '[data-action="issue"]')
    await settle(80)
    expect(completes()).toHaveLength(1)
    expect(onComplete).toHaveBeenCalledTimes(1)
    expect(onExit).not.toHaveBeenCalled()
  })

  it('leaves the boarding from the kana, and only from there', async () => {
    const { screen, onExit } = await renderFlow()
    await click(screen, 'button.brd__back')
    expect(onExit).toHaveBeenCalledTimes(1)
  })
})

describe('every sheet the card opens can be shut', () => {
  it('by Escape, by the scrim, by a pick or by its own gate, the card reprinting what it set', async () => {
    const { screen } = await renderFlow({ guest: true })
    await toCardReader(screen, 'N4')
    const doors = [
      ['[data-door="destination"]', 'goal'],
      ['[data-door="service"]', 'rhythm'],
      ['[data-door="hour"]', 'hour'],
      ['[data-door="lines"]', 'lines'],
      ['[data-door="name"]', 'name'],
      ['[data-action="keep"]', 'account'],
    ]
    for (const [open, kind] of doors) {
      // Escape.
      await click(screen, open)
      await settle(120)
      expect(document.querySelector(`.brd-sheet--${kind}`), kind).not.toBeNull()
      await userEvent.keyboard('{Escape}')
      await settle(120)
      expect(sheet(), `${kind}: Escape`).toBeNull()
      // The scrim.
      await click(screen, open)
      await settle(120)
      document.querySelector('.scrim').click()
      await settle(120)
      expect(sheet(), `${kind}: the scrim`).toBeNull()
      expect(stepOf(screen)).toBe('card')
    }

    // A pick shuts the pick's sheets.
    await click(screen, '[data-door="destination"]')
    await clickSheet('[data-goal="N2"]')
    expect(sheet()).toBeNull()
    expect(q(screen, '[data-door="destination"] .pcb__code').textContent).toBe('N2')
    await click(screen, '[data-door="service"]')
    await clickSheet('[data-rhythm="20"]')
    expect(sheet()).toBeNull()

    // The switches' sheets shut by their own gate, the drums and the
    // switches having turned under it.
    await click(screen, '[data-door="hour"]')
    await clickSheet('.brd-clock__step')
    expect(sheet()).not.toBeNull()
    await clickSheet('[data-action="sheet-done"]')
    expect(sheet()).toBeNull()
    expect(q(screen, '[data-door="hour"]').getAttribute('aria-label')).toMatch(/08:30$/)
    await click(screen, '[data-door="lines"]')
    await clickSheet('[data-line="kanji"]')
    expect(sheet()).not.toBeNull()
    expect(inSheet('[data-action="sheet-done"]').textContent).toContain(fr.brdSheetDone)
    await clickSheet('[data-action="sheet-done"]')
    expect(sheet()).toBeNull()
    expect(q(screen, '[data-door="lines"]').querySelectorAll('.pcb__line')).toHaveLength(2)

    // The typed ones by theirs: the name, and the account's « Plus tard ».
    await click(screen, '[data-door="name"]')
    await settle(120)
    type(inSheet('.brd-plate__field'), 'Aiko')
    await clickSheet('[data-action="name-save"]')
    expect(sheet()).toBeNull()
    expect(q(screen, '.pcb__sign-name').textContent).toBe('Aiko')
    await click(screen, '[data-action="keep"]')
    await settle(120)
    await clickSheet('[data-action="account-later"]')
    expect(sheet()).toBeNull()
    expect(q(screen, '.brd-keep-line').dataset.kept).toBe('device')
  }, 30000)
})

describe('the phone\'s Back', () => {
  it('shuts an open sheet and keeps the card; the next Back goes to the question', async () => {
    const { screen } = await renderFlow()
    await toCardReader(screen, 'N4')
    await click(screen, '[data-door="hour"]')
    await settle(120)
    expect(sheet()).not.toBeNull()
    let back = popped()
    window.history.back()
    await back
    await settle()
    expect(sheet()).toBeNull()
    expect(stepOf(screen)).toBe('card')
    // The guard went back in: Back now steps to the level, as it did.
    back = popped()
    window.history.back()
    await back
    await settle()
    expect(stepOf(screen)).toBe('level')
    expect(q(screen, '[data-level="N4"]').getAttribute('aria-pressed')).toBe('true')
  })
})

describe('a goal picked on the card', () => {
  it('rides through a return to the level, and gives way when the level passes it', async () => {
    const { screen } = await renderFlow()
    await toCardReader(screen, 'N4')
    await click(screen, '[data-door="destination"]')
    await clickSheet('[data-goal="N2"]')
    // Back to the line and on again, the level unchanged: N2 rides on.
    await click(screen, '[data-door="level"]')
    await settle()
    await click(screen, '[data-action="continue"]')
    await settle()
    expect(q(screen, '[data-door="destination"] .pcb__code').textContent).toBe('N2')
    // A level past it: the goal is the new level's next stop.
    await click(screen, '[data-door="level"]')
    await settle()
    await click(screen, '[data-level="N2"]')
    await click(screen, '[data-action="continue"]')
    await settle()
    expect(q(screen, '[data-door="destination"] .pcb__code').textContent).toBe('N1')
  })

  it('never picked, follows the level: its next stop', async () => {
    const { screen } = await renderFlow()
    await toCardReader(screen, 'N4')
    expect(q(screen, '[data-door="destination"] .pcb__code').textContent).toBe('N3')
    await click(screen, '[data-door="level"]')
    await settle()
    await click(screen, '[data-level="N5"]')
    await click(screen, '[data-action="continue"]')
    await settle()
    expect(q(screen, '[data-door="destination"] .pcb__code').textContent).toBe('N4')
  })
})

describe('the test never strands', () => {
  it('a start that fails, an answer that fails: each says so, retries, and the ways out stay', async () => {
    let starts = 0
    let answers = 0
    apiJsonWithTimeout.mockImplementation(async path => {
      if (path === '/api/onboarding/placement/start') {
        starts += 1
        if (starts === 1) throw new TypeError('Failed to fetch')
        return { seed: 7, done: false, level: 'N5', perLevel: {}, question: QUESTION }
      }
      if (path === '/api/onboarding/placement/answer') {
        answers += 1
        if (answers === 1) throw new ApiError(503, null, path)
        return { seed: 7, done: true, recommendedLevel: 'N4', perLevel: { N5: { correct: 3, total: 3, cleared: true } }, correct: 3, total: 3 }
      }
      return { jlptLevel: 'N4', dailyNewTarget: 10, onboardedAt: 'x' }
    })
    const { screen } = await renderFlow()
    await click(screen, '[data-kana="both"]')
    await settle()
    await click(screen, '[data-action="level-test"]')
    await settle()
    expect(stepOf(screen)).toBe('test')
    // The start failed: the reason, a retry, and both ways out.
    expect(q(screen, '[data-action="climb-retry"]')).not.toBeNull()
    expect(q(screen, '[data-action="climb-pick"]')).not.toBeNull()
    expect(q(screen, 'button.brd__back')).not.toBeNull()
    await click(screen, '[data-action="climb-retry"]')
    await settle()
    expect(q(screen, '.mcq-row')).not.toBeNull()
    // An answer that fails: said, and sent again.
    q(screen, '.mcq-row').click()
    await settle(40)
    await click(screen, '[data-action="continue"]')
    await settle()
    expect(q(screen, '[data-action="climb-retry"]')).not.toBeNull()
    await click(screen, '[data-action="climb-retry"]')
    await settle()
    // The verdict lands on the line, the level it reached picked.
    expect(stepOf(screen)).toBe('level')
    expect(q(screen, '[data-level="N4"]').getAttribute('aria-pressed')).toBe('true')
    expect(q(screen, '[data-action="continue"]').disabled).toBe(false)
  })

  it('a test that never answers is still left for the line by « Je connais mon niveau »', async () => {
    apiJsonWithTimeout.mockImplementation(async () => { throw new TypeError('Failed to fetch') })
    const { screen } = await renderFlow()
    await click(screen, '[data-kana="both"]')
    await settle()
    await click(screen, '[data-action="level-test"]')
    await settle()
    await click(screen, '[data-action="climb-pick"]')
    await settle()
    expect(stepOf(screen)).toBe('level')
    await click(screen, '[data-level="N5"]')
    expect(q(screen, '[data-action="continue"]').disabled).toBe(false)
  })
})

describe('issuing the card', () => {
  it('says which of three went wrong, keeps the gate, and issues on the press that gets through', async () => {
    const outcomes = [
      () => { throw new TypeError('Failed to fetch') },
      () => { throw new ApiError(503, null, '/api/onboarding/complete') },
      () => { throw new ApiError(422, { detail: 'refused' }, '/api/onboarding/complete') },
      () => ({ jlptLevel: 'N4', dailyNewTarget: 10, onboardedAt: 'x' }),
    ]
    apiJsonWithTimeout.mockImplementation(async path => {
      if (path === '/api/onboarding/complete') return outcomes.shift()()
      return {}
    })
    const { screen, onComplete } = await renderFlow()
    await toCardReader(screen, 'N4')
    const press = async () => { await click(screen, '[data-action="issue"]'); await settle(80) }
    const said = () => q(screen, '.brd__error')

    await press()
    expect(said().dataset.error).toBe('network')
    expect(said().textContent).toBe(fr.onbPassError)
    expect(q(screen, '[data-action="issue"]').disabled).toBe(false)

    await press()
    expect(said().dataset.error).toBe('busy')
    expect(said().textContent).toBe(fr.brdPassBusy)
    expect(q(screen, '[data-action="issue"]').disabled).toBe(false)

    await press()
    expect(said().dataset.error).toBe('refused')
    expect(said().textContent.startsWith(fr.brdPassRefused)).toBe(true)
    // The way to tell us, over the card: shut by Back, the card kept.
    await click(screen, '[data-action="report"]')
    await settle(150)
    expect(document.querySelector('.fb-sheet')).not.toBeNull()
    const back = popped()
    window.history.back()
    await back
    await settle(150)
    expect(document.querySelector('.fb-sheet')).toBeNull()
    expect(stepOf(screen)).toBe('card')

    await press()
    expect(onComplete).toHaveBeenCalledTimes(1)
    expect(completes()).toHaveLength(4)
  })

  it('issues with no volumes at all: the card filled in, its date left to the office', async () => {
    apiJson.mockImplementation(async () => { throw new TypeError('Failed to fetch') })
    const { screen, onComplete } = await renderFlow()
    await toCardReader(screen, 'N4')
    await click(screen, '[data-door="destination"]')
    await settle(120)
    expect(sheet().querySelectorAll('[data-goal]').length).toBeGreaterThan(0)
    await userEvent.keyboard('{Escape}')
    await settle(120)
    await click(screen, '[data-action="issue"]')
    await settle(80)
    expect(onComplete).toHaveBeenCalledTimes(1)
    const body = JSON.parse(completes()[0][2].body)
    expect(body.goalLevel).toBe('N3')
    expect(body).not.toHaveProperty('goalTargetDate')
  })
})

describe('keeping the card', () => {
  it('mends a link sent to a wrong address from the line under the card', async () => {
    updateUser.mockResolvedValue({ data: { user: {} }, error: null })
    const { screen } = await renderFlow({ guest: true })
    await toCardReader(screen, 'N4')
    await click(screen, '[data-action="keep"]')
    await settle(120)
    type(inSheet('input[type="email"]'), 'aiko@exemple.fr')
    await clickSheet('[data-action="account-link"]')
    await settle(80)
    expect(q(screen, '.brd-keep-line').dataset.kept).toBe('sent')
    expect(q(screen, '.brd-keep-line').textContent).toContain('aiko@exemple.fr')
    // « Changer »: the sheet again, on the address it went to.
    await click(screen, '[data-action="keep"]')
    await settle(120)
    expect(inSheet('input[type="email"]').value).toBe('aiko@exemple.fr')
    expect(inSheet('[data-note="sent"]').textContent).toBe(fr.brdLinkSentNote('aiko@exemple.fr'))
    type(inSheet('input[type="email"]'), 'aiko@example.fr')
    await clickSheet('[data-action="account-link"]')
    await settle(80)
    expect(q(screen, '.brd-keep-line').textContent).toContain('aiko@example.fr')
    expect(updateUser.mock.calls.map(c => c[0].email)).toEqual(['aiko@exemple.fr', 'aiko@example.fr'])
  })
})

describe('the reminder on a native shell', () => {
  it('says why it stays off when the phone will not ask again, and nothing once allowed', async () => {
    nudgeRef.current = true
    nudgeState.current = 'denied'
    const { screen } = await renderFlow()
    await toCardReader(screen, 'N4')
    await click(screen, '[data-door="hour"]')
    await settle(120)
    await clickSheet('[data-action="remind"]')
    await settle(60)
    expect(inSheet('[data-action="remind"]').getAttribute('aria-pressed')).toBe('false')
    expect(inSheet('[data-note="denied"]').textContent).toBe(fr.notifDenied)
    // Allowed in the phone's settings since: the next press is granted.
    requestNudge.mockImplementation(async () => true)
    nudgeState.current = 'granted'
    await clickSheet('[data-action="remind"]')
    await settle(60)
    expect(inSheet('[data-action="remind"]').getAttribute('aria-pressed')).toBe('true')
    expect(inSheet('[data-note="denied"]')).toBeNull()
  })
})

describe('the stash a Google round trip leaves', () => {
  const answers = {
    kana: 'both', levelChoice: 'N4', jlpt: 'N4', placed: null, goal: 'N3',
    lines: ['vocab', 'kanji', 'grammar'], rhythm: 10, minute: 450, notifications: false, cardName: '',
  }
  const stashed = at => sessionStorage.setItem(STASH_KEY, JSON.stringify({
    answers, step: 'card', sheet: null, history: ['kana', 'level'], at,
  }))

  it('is resumed within the hour', async () => {
    stashed(Date.now() - 5 * 60 * 1000)
    const { screen } = await renderFlow()
    expect(stepOf(screen)).toBe('card')
  })

  it('is never resumed past it: the boarding starts at the kana', async () => {
    stashed(Date.now() - 2 * 60 * 60 * 1000)
    const { screen } = await renderFlow()
    expect(stepOf(screen)).toBe('kana')
    expect(sessionStorage.getItem(STASH_KEY)).toBeNull()
  })
})
