import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { LangProvider, useLang } from '../LangContext'
import * as credits from '../stores/credits'
import { ATTRIBUTIONS } from '../domain/attributions'
import '../index.css'

// ── Settings (plan 074; the pass's contract, plan 139) ────────────
// The pass printed with its contract, the list under it, and the pages
// they open. Pinned here: the parts that fail quietly —
//   1. every door is reachable and prints its value, the pass's fields
//      included, and the addresses of the pages that were split land
//      where their content went;
//   2. the level strip WRITES — through the confirm sheet, whose
//      figures come from the preview — and Stay writes nothing;
//   3. the rating bars write, and name the bar's own words;
//   4. the reset and the deletion are genuinely two-step;
//   5. Destination and Service WRITE the things they claim to — a
//      destination issued, a destination handed back, a service
//      reprinted — and each prices its choices before one is made;
//      the hour reprints on its own page.

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
  readingPace: 'standard',
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

// A pace picked here is mirrored into this browser's localStorage
// (stores/readingPace), which every later file in the lane shares: the
// first ride's test would read the untimed pace chosen below.
afterEach(() => { window.localStorage.removeItem('jl.readingPace') })

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

describe('SettingsScreen — the card and the list', () => {
  it('prints the card\'s contract and seven rows plus the pass, each printing its value', async () => {
    const screen = await mount()
    await settle()
    const root = screen.container

    // The contract, on the card's back (plan 173): the boarding level and
    // the destination, then the service, the hour and the lines, each a
    // door to its own page.
    expect(root.querySelector('.pcard-slot--settings .pcard').dataset.side).toBe('back')
    const fields = [...root.querySelectorAll('.pcard-slot--settings .stg-door')]
    expect(fields.map(f => f.dataset.page)).toEqual(['level', 'destination', 'service', 'hour', 'lines'])
    expect(fields[0].textContent).toContain('N5')
    expect(fields[1].textContent).toContain(T.settingsGoalNoneShort)
    expect(fields[2].textContent).toContain(`${T.paceName.rapid} · 10`)
    expect(fields[3].textContent).toContain(T.destFlexible)
    // No destination, so no date to be valid until.
    expect(root.querySelector('.pcb__valid')).toBeNull()

    // Eight doors to pages, then the pass — which opens the offer sheet
    // rather than navigating, so it is last and is not one of PAGES.
    const rows = [...root.querySelectorAll('.stg-row')]
    expect(rows.map(r => r.dataset.page)).toEqual(['display', 'sound', 'agenda', 'rating', 'reading', 'help', 'account', 'credits', 'pass'])
    const value = i => rows[i].querySelector('.stg-row__value').textContent
    expect(value(2)).toBe(T.agdRowEmpty)
    expect(value(3)).toBe(T.settingsRatingScaleOption.simple)
    expect(value(4)).toBe(T.readingPaceOption.standard)
    expect(value(6)).toBe('dev@…')
    expect(value(7)).toBe(T.settingsCreditsCount(ATTRIBUTIONS.length))
    // What can be seen is drawn beside the words: the served bar's dots,
    // and the standard pace's clock, half the slowest one's.
    expect(rows[3].querySelectorAll('.stg-dots__dot')).toHaveLength(4)
    expect(rows[0].querySelector('.stg-swatch')).not.toBeNull()
    expect(rows[4].querySelector('.stg-pace__fill').style.width).toBe('50%')

    // A door navigates, and React Router renders a navigation as a
    // transition: the page arrives when React gets to it, not after a
    // fixed pause, so each arrival is waited for rather than timed (a
    // 30ms settle lost that race on a loaded CI runner).
    const title = () => screen.container.querySelector('h1.bar__title')?.textContent
    rows[6].click()
    await vi.waitFor(() => expect(title()).toBe(T.account))
    // ‹ Settings brings the column back.
    screen.container.querySelector('.stage__leave').click()
    await vi.waitFor(() => expect(screen.container.querySelectorAll('.stg-row')).toHaveLength(9))

    screen.container.querySelector('.pcard-slot--settings .stg-door[data-page="service"]').click()
    await vi.waitFor(() => expect(title()).toBe(T.destService))
  })

  it('prints the destination and its validity when the card has one', async () => {
    journey = WITH_GOAL
    seedJourneyStatus(WITH_GOAL)
    await refreshJourney()
    const screen = await mount()
    await settle()
    const root = screen.container
    expect(root.querySelector('.stg-door[data-page="destination"]').textContent).toContain('N3')
    expect(root.querySelector('.pcb__valid').textContent).toMatch(/2031/)
  })

  it('an unknown page falls back to the list', async () => {
    const screen = await mount('/profile/settings/nothing')
    await settle()
    expect(screen.container.querySelectorAll('.stg-row')).toHaveLength(9)
  })

  // Learning went to the pass's fields and Data into the account page
  // (plan 139): an address kept from before lands where it went.
  it('lands the old Learning address on the level', async () => {
    const screen = await mount('/profile/settings/learning')
    await settle()
    expect(screen.container.querySelector('.lvlstrip')).not.toBeNull()
  })

  it('lands the old Data address on the account, whose second half it is', async () => {
    const screen = await mount('/profile/settings/data')
    await settle()
    expect(screen.container.querySelector('[data-action="reset"]')).not.toBeNull()
    expect(screen.container.querySelector('h1.bar__title').textContent).toBe(T.account)
  })

  // ── The pass row (the paywall's settings door) ──────────────────
  it('opens the offer from the pass row, and records which door it was', async () => {
    const screen = await mount()
    await settle()
    const pass = screen.container.querySelector('.stg-row[data-page="pass"]')
    expect(pass).not.toBeNull()
    expect(credits.peekPaywall()).toBe(null)

    pass.click()
    await settle(30)
    // The source is what the whole funnel slices on, so it is pinned.
    expect(credits.peekPaywall()).toEqual({ source: 'settings', screen: 'discover', limit: null, waiting: null, taken: false })

    credits.closePaywall()
  })

  it('offers no pass to a learner who already holds one', async () => {
    // A pass holder must never be sold a pass; the row leaves the list
    // entirely rather than rendering disabled.
    credits.seedCredits({ balance: null, unlimited: true, plan: 'pass' })
    const screen = await mount()
    await settle()
    expect(screen.container.querySelector('.stg-row[data-page="pass"]')).toBeNull()
    expect(screen.container.querySelectorAll('.stg-row')).toHaveLength(8)

    // The credits store is module state: leave it as the rest of this
    // file expects to find it, or the pass row vanishes from every
    // later describe for no visible reason.
    credits.seedCredits({ balance: 30, unlimited: false, plan: 'free' })
  })
})

describe('SettingsScreen — the level, the bar and the service', () => {
  it('marks the profile level, previews a move and writes it from the sheet', async () => {
    apiJson.mockImplementation(async path => (
      String(path).startsWith('/api/profile/learning/preview')
        ? { direction: 'up', markedKnown: 1318, spreadWeeks: 6 }
        : {}
    ))
    const screen = await mount('/profile/settings/level')
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
    const screen = await mount('/profile/settings/level')
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

  it('the bars write, and are the bars they offer', async () => {
    const screen = await mount('/profile/settings/rating')
    await settle()
    const root = screen.container

    // 2 / 4 / 6 buttons, shortest first, with the served one marked.
    const cards = [...root.querySelectorAll('.grades .grade')]
    expect(cards).toHaveLength(3)
    expect(cards.map(c => c.getAttribute('aria-checked'))).toEqual(['false', 'true', 'false'])
    // Each is the rating bar itself, drawn: two, four and six tiles.
    expect(cards.map(c => c.querySelectorAll('.rating-bar__btn').length)).toEqual([2, 4, 6])
    expect(cards[0].querySelector('button')).toBeNull()

    // The words of the served scale, worst-first, exactly as the bar
    // draws them — named on the radio, since the drawing is hidden from
    // a screen reader. In French, which is what LangProvider defaults to
    // — spelled out rather than rebuilt from the locale table, because a
    // caption assembled from the same source it is being checked against
    // would pass however wrong the assembly was.
    expect(cards[1].getAttribute('aria-label')).toContain('Raté · Presque · Difficile · Correct')
    expect(cards[0].getAttribute('aria-label')).toContain('Raté · Correct')

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
    const screen = await mount('/profile/settings/rating')
    await settle()
    const cards = [...screen.container.querySelectorAll('.grades .grade')]
    expect(cards[0].getAttribute('aria-checked')).toBe('true')
  })

  // ── The reading pace ──────────────────────────────────────────
  it('offers each reading pace as the run\'s clock at that pace, and writes the pick', async () => {
    const screen = await mount('/profile/settings/reading')
    await settle()
    const cards = [...screen.container.querySelectorAll('.paces .pace')]
    expect(cards.map(c => c.dataset.pace)).toEqual(['standard', 'relaxed', 'slow', 'untimed'])
    expect(cards.map(c => c.getAttribute('aria-checked'))).toEqual(['true', 'false', 'false', 'false'])

    // The consequence before the choice: the seconds a short sentence
    // stays up at each pace, on the run's own clock, the slowest timed
    // one filling it -- and no clock at all for the last.
    const label = c => c.querySelector('.timer__label').textContent
    expect(cards.slice(0, 3).map(label)).toEqual(['10.0s', '15.0s', '20.0s'])
    expect(label(cards[3])).toBe(T.readingUntimed)
    expect(cards.map(c => c.querySelector('.timer__fill').style.width)).toEqual(['50%', '75%', '100%', '100%'])
    // Named in words on the radio, since the clock is hidden from a
    // screen reader.
    expect(cards[3].getAttribute('aria-label')).toContain(T.readingPaceOption.untimed)

    cards[3].click()
    await settle(30)
    const call = apiJson.mock.calls.find(c => c[0] === '/api/profile/learning')
    expect(call, 'picking a pace must PATCH the learning profile').toBeTruthy()
    expect(call[2].method).toBe('PATCH')
    expect(JSON.parse(call[2].body)).toEqual({ readingPace: 'untimed' })
  })

  it('without a destination, a service is saved on the spot', async () => {
    const screen = await mount('/profile/settings/service')
    await settle()
    const root = screen.container
    // No stop to ride to, so no lines — the three cards, and the way to
    // choose a destination.
    expect(root.querySelector('.svc-chart')).toBeNull()
    expect(root.querySelector('[data-action="goal-set"]')).not.toBeNull()
    const cards = [...root.querySelectorAll('.svc-grid .svc')]
    expect(cards.map(c => c.getAttribute('aria-checked'))).toEqual(['false', 'true', 'false'])
    cards[2].click()
    await settle(30)
    const call = apiJson.mock.calls.find(c => c[0] === '/api/profile/learning')
    expect(JSON.parse(call[2].body)).toEqual({ dailyNewTarget: 20 })
  })
})

describe('SettingsScreen — the lines', () => {
  it('toggles a line through the learning PATCH, and never the last one out', async () => {
    profile = { ...PROFILE, lines: ['vocab', 'kanji'] }
    await refreshSummary()
    const screen = await mount('/profile/settings/lines')
    await settle()
    const toggles = [...screen.container.querySelectorAll('[data-line]')]
    expect(toggles.map(b => b.getAttribute('aria-checked'))).toEqual(['true', 'true', 'false'])
    expect(toggles.map(b => b.disabled)).toEqual([false, false, false])
    toggles[2].click()   // the grammar, on
    await settle(30)
    const call = apiJson.mock.calls.find(c => c[0] === '/api/profile/learning')
    expect(JSON.parse(call[2].body)).toEqual({ lines: ['vocab', 'kanji', 'grammar'] })
  })

  it('the last line on cannot be switched off', async () => {
    profile = { ...PROFILE, lines: ['grammar'] }
    await refreshSummary()
    const screen = await mount('/profile/settings/lines')
    await settle()
    const toggles = [...screen.container.querySelectorAll('[data-line]')]
    expect(toggles.map(b => b.getAttribute('aria-checked'))).toEqual(['false', 'false', 'true'])
    expect(toggles[2].disabled).toBe(true)
    toggles[2].click()
    await settle(30)
    expect(apiJson.mock.calls.find(c => c[0] === '/api/profile/learning')).toBeUndefined()
  })
})

describe('SettingsScreen — Data', () => {
  it('reset fires only after the second, explicit press', async () => {
    const screen = await mount('/profile/settings/account')
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
    const screen = await mount('/profile/settings/account')
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

  // Muted, the mute stood as a third preset card, lit and reading
  // "Unmute · every channel" beside a lit Full station, and the row
  // printed "Mute": a muted app read as sound on. The row says the state
  // now, beside a crossed speaker; the page heads its switch with the
  // state, and the way back is its one filled action.
  it('says the sound is off in its row, beside a crossed speaker', async () => {
    const { setMuted } = await import('../lib/audio/settings')
    setMuted(true)
    try {
      const screen = await mount()
      await settle()
      const row = screen.container.querySelector('.stg-row[data-page="sound"]')
      expect(row.querySelector('.stg-row__value').textContent).toBe(T.soundOff)
      expect(row.querySelector('.stg-mute')).not.toBeNull()
      expect(row.querySelector('.stg-meter')).toBeNull()
    } finally {
      setMuted(false)
    }
  })

  it('heads the page with the sound off, and turns it back on', async () => {
    const { setMuted } = await import('../lib/audio/settings')
    setMuted(true)
    try {
      const screen = await mount('/profile/settings/sound')
      await settle()
      const root = screen.container
      const power = root.querySelector('.snd-switch')
      expect(power.querySelector('.slip__name').textContent).toBe(T.soundOff)
      expect(power.querySelector('.slip__hint').textContent).toBe(T.soundOffHint)
      const act = power.querySelector('[data-action="mute"]')
      expect(act.textContent).toBe(T.unmute)
      expect(act.classList.contains('btn-primary')).toBe(true)
      // The mute is no preset: the two presets alone are cards.
      expect([...root.querySelectorAll('[data-preset]')].map(b => b.dataset.preset)).toEqual(['quiet', 'full'])

      act.click()
      await settle(30)
      expect(window.localStorage.getItem('jp-app-muted')).toBe('0')
      expect(power.querySelector('.slip__name').textContent).toBe(T.soundOn)
      expect(power.querySelector('.slip__hint')).toBeNull()
      expect(act.textContent).toBe(T.mute)
      expect(act.classList.contains('btn-secondary')).toBe(true)
    } finally {
      setMuted(false)
    }
  })
})

describe('SettingsScreen — Destination', () => {
  it('issues a destination onto a pass that has none, each stop priced', async () => {
    const screen = await mount('/profile/settings/destination')
    await settle()
    const root = screen.container
    // The stops ahead of N5, none chosen; nothing to reprint or hand back yet.
    const chips = [...root.querySelectorAll('.dest')]
    expect(chips.map(c => c.querySelector('.dest__code').textContent)).toEqual(['N4', 'N3', 'N2', 'N1'])
    expect(root.querySelector('[data-action="goal-reprint"]').disabled).toBe(true)
    expect(root.querySelector('[data-action="goal-drop"]').disabled).toBe(true)
    // Every stop says when the pass's service reaches it, before one is
    // chosen, and a further stop is reached later.
    const dates = chips.map(c => c.querySelector('.dest__when').textContent)
    expect(dates.every(d => /\d{4}/.test(d))).toBe(true)
    expect(new Set(dates).size).toBe(4)

    chips[1].click() // N3
    await settle(30)
    expect(root.querySelector('[data-action="goal-reprint"]').disabled).toBe(false)
    // The line the pass will print, from this service's own arithmetic.
    expect(root.querySelector('.dest-line__date')).not.toBeNull()
    // The line is inked as far as the stop chosen.
    expect(chips.map(c => c.classList.contains('dest--ridden'))).toEqual([true, true, false, false])

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
    expect(on.querySelector('.dest__tag').textContent).toBe(T.destOnPass)
    expect(root.querySelector('.dest-line__date').textContent).toMatch(/2031/)
    expect(root.querySelector('[data-action="goal-reprint"]').disabled).toBe(true)

    root.querySelector('[data-action="goal-drop"]').click()
    await settle(30)
    const call = apiJson.mock.calls.find(c => c[0] === '/api/journey/goal' && c[2]?.method === 'DELETE')
    expect(call, 'Hand it back IS the 払戻').toBeTruthy()
  })
})

describe('SettingsScreen — Service', () => {
  it('draws each service as a line to the destination, the learner\'s own pace dashed', async () => {
    journey = WITH_GOAL
    seedJourneyStatus(WITH_GOAL)
    await refreshJourney()
    const screen = await mount('/profile/settings/service')
    await settle()
    const root = screen.container
    const rows = [...root.querySelectorAll('.svc-row[data-pace]')]
    expect(rows.map(r => r.dataset.pace)).toEqual(['5', '10', '20'])
    // The faster the service, the shorter its line to the stop.
    const reach = rows.map(r => parseFloat(r.querySelector('.svc-row__rail').style.width))
    expect(reach[0]).toBeGreaterThan(reach[1])
    expect(reach[1]).toBeGreaterThan(reach[2])
    rows.forEach(r => expect(r.querySelector('.svc-row__when').textContent).toMatch(/\d{4}/))
    // The service on the pass says so, and is the one checked.
    expect(rows[1].getAttribute('aria-checked')).toBe('true')
    expect(rows[1].querySelector('.svc-row__tag').textContent).toBe(T.destOnPass)
    // The last fortnight's own pace, a line and not a choice.
    const yours = root.querySelector('.svc-row--yours')
    expect(yours.querySelector('.svc-row__rail--dashed')).not.toBeNull()
    expect(yours.getAttribute('role')).toBeNull()
    expect(root.querySelector('[data-action="pace-reprint"]').disabled).toBe(true)
  })

  it('a changed service is a reprint of the same stop, not a new contract', async () => {
    journey = WITH_GOAL
    seedJourneyStatus(WITH_GOAL)
    await refreshJourney()
    const screen = await mount('/profile/settings/service')
    await settle()
    const root = screen.container
    root.querySelector('.svc-row[data-pace="20"]').click() // Express
    await settle(30)
    expect(apiJson.mock.calls.some(c => c[0] === '/api/journey/reprint')).toBe(false)
    root.querySelector('[data-action="pace-reprint"]').click()
    await settle(30)
    const call = apiJson.mock.calls.find(c => c[0] === '/api/journey/reprint')
    expect(call).toBeTruthy()
    const body = JSON.parse(call[2].body)
    expect(body.dailyNewTarget).toBe(20)
    expect(body.goalLevel).toBeUndefined()
    expect(new Date(body.goalTargetDate).getTime()).toBeGreaterThan(Date.now())
  })
})

describe('SettingsScreen — the daily ride', () => {
  it('reprints the pass when the daily hour changes', async () => {
    const screen = await mount('/profile/settings/hour')
    await settle()
    screen.container.querySelector('[data-hour="am"]').click()
    await settle(30)
    const call = apiJson.mock.calls.find(c => c[0] === '/api/journey/reprint')
    expect(call, 'the hour is a reprint, not a new contract').toBeTruthy()
    expect(JSON.parse(call[2].body)).toEqual({ dailyDeparture: 'am' })
  })
})
