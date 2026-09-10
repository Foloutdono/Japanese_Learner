import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { LangProvider, useLang } from '../LangContext'
import '../index.css'

// ── Settings (plan 074) ───────────────────────────────────────────
// The list and its six pages. Pinned here: the parts that fail
// quietly —
//   1. every row is reachable and prints its value;
//   2. the level strip WRITES — through the confirm sheet, whose
//      figures come from the preview — and Stay writes nothing;
//   3. the grade cards write, and name the bar's own words;
//   4. the reset and the deletion are genuinely two-step;
//   5. Destination WRITES the three things it claims to — a
//      destination issued, a destination handed back, an hour
//      reprinted.

const apiJson = vi.fn()
const signOut = vi.fn(async () => {})
const apiFetch = vi.fn()

vi.mock('../lib/api', () => ({
  api: p => p,
  apiFetch: (...a) => apiFetch(...a),
  apiJson: (...a) => apiJson(...a),
  apiJsonWithTimeout: vi.fn(),
  apiUpload: vi.fn(),
  ApiError: class ApiError extends Error {},
}))

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: async () => ({ data: { session: { access_token: 'tok' } } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
      signOut: (...a) => signOut(...a),
    },
  },
}))

// Real settings store (the presets test needs the live volume model);
// only the players are stubbed. Spread importOriginal — other modules
// in the graph pull further names out of lib/audio.
vi.mock('../lib/audio', async (importOriginal) => ({
  ...(await importOriginal()),
  playClick: vi.fn(),
  playToggle: vi.fn(),
  playUi: vi.fn(),
}))

globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })

const { default: SettingsScreen } = await import('./SettingsScreen')
// The profile summary is a module-level cache with a 30s TTL, so a test
// that changes what /api/profile answers has to force the refetch — the
// mount alone would read the previous test's cached profile.
const { refreshSummary } = await import('../stores/profileSummary')
const { seedJourneyStatus, seedVolumes, refreshJourney } = await import('../stores/journey')

const settle = (ms = 80) => new Promise(r => setTimeout(r, ms))

const SESSION = { access_token: 'tok', user: { email: 'dev@example.com' } }

const PROFILE = {
  username: 'Tester', level: 3, xp: 10, xpPrevLevel: 0, xpForNext: 100,
  jlptLevel: 'N5', dailyNewTarget: 10, streak: 1, week: [],
  // Served, so the grade cards are deterministic here rather than
  // reading whatever this browser's localStorage mirror happens to hold.
  ratingScale: 'simple',
  // This learner reads both syllabaries, so the kana stop is behind
  // them and the counter offers the JLPT stops alone (the case where it
  // is still ahead has its own test below).
  kanaKnown: 'both',
}

// Shapes, not the real content volumes — the page only needs numbers
// that make its arithmetic finite.
const VOLUMES = {
  vocab: { N5: 800, N4: 600, N3: 1800, N2: 1800, N1: 2500 },
  kanji: { N5: 100, N4: 200, N3: 350, N2: 400, N1: 1200 },
  grammar: { N5: 80, N4: 80, N3: 120, N2: 140, N1: 200 },
  kana: 104,
}

const NO_GOAL = {
  goalStartLevel: null, goalLevel: null, goalTargetDate: null, goalSetAt: null,
  dailyDeparture: null, plannedPerDay: 10,
  itemsTotal: 9000, itemsDone: 40, actual14: 14, days14: 14,
}

const WITH_GOAL = {
  ...NO_GOAL,
  goalStartLevel: 'N5', goalLevel: 'N3', goalTargetDate: '2031-01-01',
  goalSetAt: '2026-01-01T00:00:00+00:00', itemsTotal: 3484,
}

// The locale's own strings, read from the provider rather than
// imported, so the cases hold in whichever language the lane runs.
let T
function Probe() {
  T = useLang().t
  return null
}

function mount(path = '/profile/settings') {
  return render(
    <LangProvider>
      <Probe />
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/profile" element={<div className="probe-profile" />} />
          <Route path="/profile/settings" element={<SettingsScreen session={SESSION} />} />
          <Route path="/profile/settings/:page" element={<SettingsScreen session={SESSION} />} />
        </Routes>
      </MemoryRouter>
    </LangProvider>
  )
}

let journey = NO_GOAL
let profile = PROFILE

beforeEach(async () => {
  journey = NO_GOAL
  profile = PROFILE
  apiJson.mockReset()
  apiFetch.mockReset()
  apiFetch.mockImplementation(async path => ({
    ok: true, status: 200,
    json: async () => {
      const p = String(path)
      if (p.startsWith('/api/journey/status')) return journey
      if (p.startsWith('/api/onboarding/volumes')) return VOLUMES
      if (p.startsWith('/api/profile')) return profile
      return {}
    },
  }))
  apiJson.mockResolvedValue({})
  seedVolumes(VOLUMES)
  seedJourneyStatus(NO_GOAL)
  await Promise.all([refreshSummary(), refreshJourney()])
})

describe('SettingsScreen — the list', () => {
  it('prints six rows with their values, each a door to its page', async () => {
    const screen = await mount()
    await settle()
    const rows = [...screen.container.querySelectorAll('.stg-row')]
    expect(rows).toHaveLength(6)
    expect(rows.map(r => r.dataset.page)).toEqual(['display', 'sound', 'learning', 'destination', 'data', 'account'])
    expect(rows[2].querySelector('.stg-row__value').textContent).toContain('N5 · 10')
    expect(rows[3].querySelector('.stg-row__value').textContent).toBe(T.settingsGoalNoneShort)
    expect(rows[5].querySelector('.stg-row__value').textContent).toBe('dev@…')

    rows[4].click()
    await settle(30)
    expect(screen.container.querySelector('h1.bar__title').textContent).toBe(T.settingsData)
    // ‹ Settings brings the list back.
    screen.container.querySelector('.stage__leave').click()
    await settle(30)
    expect(screen.container.querySelectorAll('.stg-row')).toHaveLength(6)
  })

  it('an unknown page falls back to the list', async () => {
    const screen = await mount('/profile/settings/nothing')
    await settle()
    expect(screen.container.querySelectorAll('.stg-row')).toHaveLength(6)
  })
})

describe('SettingsScreen — Learning', () => {
  it('marks the profile level, previews a move and writes it from the sheet', async () => {
    apiJson.mockImplementation(async path => (
      String(path).startsWith('/api/profile/learning/preview')
        ? { direction: 'up', markedKnown: 1318, spreadWeeks: 6 }
        : {}
    ))
    const screen = await mount('/profile/settings/learning')
    await settle()
    const root = screen.container

    const checked = root.querySelector('.lvlstrip__stop[aria-checked="true"]')
    expect(checked.textContent.startsWith('N5')).toBe(true)

    const stops = [...root.querySelectorAll('.lvlstrip__stop')]
    stops.find(s => s.textContent.startsWith('N3')).click()
    await settle()

    // The sheet first, with the preview's figures; nothing written yet.
    const sheet = document.querySelector('[role="dialog"].lvl-sheet')
    expect(sheet).not.toBeNull()
    expect(sheet.textContent).toContain('318')
    expect(apiJson.mock.calls.some(c => c[0] === '/api/profile/learning')).toBe(false)

    sheet.querySelector('[data-action="level-confirm"]').click()
    await settle()
    const call = apiJson.mock.calls.find(c => c[0] === '/api/profile/learning')
    expect(call, 'confirming the sheet must PATCH the learning profile').toBeTruthy()
    expect(call[2].method).toBe('PATCH')
    expect(JSON.parse(call[2].body)).toEqual({ jlptLevel: 'N3' })
    expect(document.querySelector('[role="dialog"].lvl-sheet')).toBeNull()
  })

  it('Stay writes nothing', async () => {
    apiJson.mockImplementation(async path => (
      String(path).startsWith('/api/profile/learning/preview')
        ? { direction: 'down', setAside: 224, deleted: 0 }
        : {}
    ))
    profile = { ...PROFILE, jlptLevel: 'N4' }
    await refreshSummary()
    const screen = await mount('/profile/settings/learning')
    await settle()
    const stops = [...screen.container.querySelectorAll('.lvlstrip__stop')]
    stops.find(s => s.textContent.startsWith('N5')).click()
    await settle()
    const sheet = document.querySelector('[role="dialog"].lvl-sheet')
    expect(sheet.textContent).toContain('224')
    sheet.querySelector('.btn-secondary').click()
    await settle(30)
    expect(document.querySelector('[role="dialog"].lvl-sheet')).toBeNull()
    expect(apiJson.mock.calls.some(c => c[0] === '/api/profile/learning')).toBe(false)
  })

  it('the grade cards write, and name the bar they are offering', async () => {
    const screen = await mount('/profile/settings/learning')
    await settle()
    const root = screen.container

    // 2 / 4 / 6 grades, shortest first, with the served one marked.
    const cards = [...root.querySelectorAll('.grades .svc')]
    expect(cards).toHaveLength(3)
    expect(cards.map(c => c.getAttribute('aria-checked'))).toEqual(['false', 'true', 'false'])

    // The words of the served scale, worst-first, exactly as the bar
    // draws them. In French, which is what LangProvider defaults to —
    // spelled out rather than rebuilt from the locale table, because a
    // caption assembled from the same source it is being checked
    // against would pass however wrong the assembly was.
    expect(cards[1].querySelector('.svc__words').textContent)
      .toBe('Raté · Presque · Difficile · Correct')
    expect(cards[0].querySelector('.svc__words').textContent).toBe('Raté · Correct')

    cards[2].click()
    await settle(30)
    const call = apiJson.mock.calls.find(c => c[0] === '/api/profile/learning')
    expect(call, 'picking a bar must PATCH the learning profile').toBeTruthy()
    expect(call[2].method).toBe('PATCH')
    expect(JSON.parse(call[2].body)).toEqual({ ratingScale: 'full' })
  })

  it('marks the two-button bar when that is what is served', async () => {
    profile = { ...PROFILE, ratingScale: 'binary' }
    await refreshSummary()
    const screen = await mount('/profile/settings/learning')
    await settle()
    const cards = [...screen.container.querySelectorAll('.grades .svc')]
    expect(cards[0].getAttribute('aria-checked')).toBe('true')
  })

  it('the pace cards write the service picked', async () => {
    const screen = await mount('/profile/settings/learning')
    await settle()
    const cards = [...screen.container.querySelectorAll('.svc-grid .svc')]
    expect(cards.map(c => c.getAttribute('aria-checked'))).toEqual(['false', 'true', 'false'])
    cards[2].click()
    await settle(30)
    const call = apiJson.mock.calls.find(c => c[0] === '/api/profile/learning')
    expect(JSON.parse(call[2].body)).toEqual({ dailyNewTarget: 20 })
  })
})

describe('SettingsScreen — Data', () => {
  it('reset fires only after the second, explicit press', async () => {
    const screen = await mount('/profile/settings/data')
    await settle()
    const root = screen.container

    root.querySelector('[data-action="reset"]').click()
    await settle(30)
    expect(root.querySelector('[data-action="reset-confirm"]')).toBeTruthy()
    expect(apiJson.mock.calls.some(c => c[0] === '/api/stats/reset')).toBe(false)

    root.querySelector('[data-action="reset-confirm"]').click()
    await settle(30)
    const call = apiJson.mock.calls.find(c => c[0] === '/api/stats/reset')
    expect(call).toBeTruthy()
    expect(call[2].method).toBe('DELETE')
  })

  it('deleting the account is two-step too, then signs this device out locally', async () => {
    const screen = await mount('/profile/settings/data')
    await settle()
    const root = screen.container

    root.querySelector('[data-action="delete-account"]').click()
    await settle(30)
    expect(root.querySelector('[data-action="delete-account-confirm"]')).toBeTruthy()
    expect(apiJson.mock.calls.some(c => c[0] === '/api/account')).toBe(false)
    // Arming the deletion never touches the reset's own confirm.
    expect(root.querySelector('[data-action="reset"]')).toBeTruthy()

    root.querySelector('[data-action="delete-account-confirm"]').click()
    await settle(30)
    const call = apiJson.mock.calls.find(c => c[0] === '/api/account')
    expect(call).toBeTruthy()
    expect(call[2].method).toBe('DELETE')
    expect(signOut).toHaveBeenCalledWith({ scope: 'local' })
  })
})

describe('SettingsScreen — Sound', () => {
  it('the quiet preset silences exactly the station theatre', async () => {
    const audio = await import('../lib/audio')
    const screen = await mount('/profile/settings/sound')
    await settle()
    const quiet = screen.container.querySelector('[data-preset="quiet"]')
    quiet.click()
    await settle(30)
    expect(quiet.getAttribute('aria-pressed')).toBe('true')

    // The model itself, not just the card: theatre at zero, study
    // channels untouched.
    const vols = JSON.parse(window.localStorage.getItem('jp-app-volumes') ?? '{}')
    expect(vols.ambiance).toBe(0)
    expect(vols.jingle).toBe(0)
    expect(vols.announcement).toBe(0)
    expect(vols.kana ?? audio.DEFAULT_VOLUMES.kana).toBe(audio.DEFAULT_VOLUMES.kana)
  })
})

describe('SettingsScreen — Destination', () => {
  it('issues a destination onto a pass that has none', async () => {
    const screen = await mount('/profile/settings/destination')
    await settle()
    const root = screen.container
    // The stops ahead of N5, none chosen; nothing to reprint or hand back yet.
    const chips = [...root.querySelectorAll('.dest')]
    expect(chips.map(c => c.querySelector('.dest__code').textContent)).toEqual(['N4', 'N3', 'N2', 'N1'])
    expect(root.querySelector('[data-action="goal-reprint"]').disabled).toBe(true)
    expect(root.querySelector('[data-action="goal-drop"]').disabled).toBe(true)

    chips[1].click() // N3
    await settle(30)
    expect(root.querySelector('[data-action="goal-reprint"]').disabled).toBe(false)
    // The line the pass will print, from this service's own arithmetic.
    expect(root.querySelector('.dest-line__date')).not.toBeNull()

    root.querySelector('[data-action="goal-reprint"]').click()
    await settle(30)
    const call = apiJson.mock.calls.find(c => c[0] === '/api/journey/goal' && c[2]?.method === 'POST')
    expect(call, 'pressing Reprint on a new stop must issue a contract').toBeTruthy()
    const body = JSON.parse(call[2].body)
    expect(body.goalLevel).toBe('N3')
    // The date is the one THIS configuration promises, measured from
    // now — never a date already spent.
    expect(new Date(body.goalTargetDate).getTime()).toBeGreaterThan(Date.now())
    // The pace travels with the contract: a date nobody can ride to is
    // not a promise.
    expect(body.dailyNewTarget).toBe(10)
  })

  // 手前の駅 — the kana as a destination, for a learner still short of
  // the syllabaries. The counter issues it like any other stop; the
  // office refuses it from any level above the first (routes/journey.py).
  it('offers the kana stop to a learner who cannot read both scripts, and issues it', async () => {
    profile = { ...PROFILE, kanaKnown: 'none' }
    await refreshSummary()
    const screen = await mount('/profile/settings/destination')
    await settle()
    const root = screen.container
    const chips = [...root.querySelectorAll('.dest')]
    expect(chips.map(c => c.querySelector('.dest__code').textContent)).toEqual(['—', 'N4', 'N3', 'N2', 'N1'])
    expect(chips[0].querySelector('.dest__load').textContent).toBe(T.brdNovice)

    chips[0].click()
    await settle(30)
    root.querySelector('[data-action="goal-reprint"]').click()
    await settle(30)
    const call = apiJson.mock.calls.find(c => c[0] === '/api/journey/goal' && c[2]?.method === 'POST')
    expect(call, 'the kana stop must be issuable like any other').toBeTruthy()
    const body = JSON.parse(call[2].body)
    expect(body.goalLevel).toBe('novice')
    // Priced at the syllabary alone: 104 signs at 10 a day is a ride of
    // days, not years, so the date is close rather than distant.
    const days = (new Date(body.goalTargetDate) - Date.now()) / 86400000
    expect(days).toBeGreaterThan(0)
    expect(days).toBeLessThan(30)
  })

  it('opens on the contract already printed, and Hand it back returns it', async () => {
    journey = WITH_GOAL
    seedJourneyStatus(WITH_GOAL)
    await refreshJourney()
    const screen = await mount('/profile/settings/destination')
    await settle()
    const root = screen.container
    // Opening on a fresh suggestion would quietly propose a different
    // promise than the one the pass carries.
    const on = root.querySelector('.dest--on')
    expect(on.querySelector('.dest__code').textContent).toBe('N3')
    expect(root.querySelector('.dest-line__date').textContent).toMatch(/2031/)
    expect(root.querySelector('[data-action="goal-reprint"]').disabled).toBe(true)

    root.querySelector('[data-action="goal-drop"]').click()
    await settle(30)
    const call = apiJson.mock.calls.find(c => c[0] === '/api/journey/goal' && c[2]?.method === 'DELETE')
    expect(call, 'Hand it back IS the 払戻').toBeTruthy()
  })

  it('a changed service on the same stop is a reprint, not a new contract', async () => {
    journey = WITH_GOAL
    seedJourneyStatus(WITH_GOAL)
    await refreshJourney()
    const screen = await mount('/profile/settings/destination')
    await settle()
    const root = screen.container
    root.querySelectorAll('.svc-grid .svc')[2].click() // Express
    await settle(30)
    root.querySelector('[data-action="goal-reprint"]').click()
    await settle(30)
    const call = apiJson.mock.calls.find(c => c[0] === '/api/journey/reprint')
    expect(call).toBeTruthy()
    const body = JSON.parse(call[2].body)
    expect(body.dailyNewTarget).toBe(20)
    expect(body.goalLevel).toBeUndefined()
    expect(new Date(body.goalTargetDate).getTime()).toBeGreaterThan(Date.now())
  })

  it('reprints the pass when the daily hour changes', async () => {
    const screen = await mount('/profile/settings/destination')
    await settle()
    screen.container.querySelector('[data-hour="am"]').click()
    await settle(30)
    const call = apiJson.mock.calls.find(c => c[0] === '/api/journey/reprint')
    expect(call, 'the hour is a reprint, not a new contract').toBeTruthy()
    expect(JSON.parse(call[2].body)).toEqual({ dailyDeparture: 'am' })
  })
})
