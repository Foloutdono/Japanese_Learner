import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom'
import { LangProvider } from './LangContext'
import './index.css'

// ── 終着 — the day's run, finished on Today, on a phone (plan 250) ────
// /today/clear is Today with the run's tally in the router's state. The
// print of the hour waits under the empty dial while the server answers,
// the bars away in their places; the answer plays on the gate itself --
// every day the seal slammed onto the disc, what the day was under it,
// the board and the shut gate -- the bars drawn back in at the chrome
// beat and the fare said on the pass at its own; at the rest the URL is
// /today. A tap skips to the rest and plays no sound. A partial run
// keeps its bars and leaves the gate open on the cards left. A finish
// with no run, or one shown before a reload, is the gate as it stands.

const api = vi.hoisted(() => ({ next: null }))
const day = vi.hoisted(() => ({ today: null }))
const sounds = vi.hoisted(() => {
  const letGo = vi.fn()
  return {
    playStamp: vi.fn(), playDayClear: vi.fn(), playMilestone: vi.fn(), playPassClip: vi.fn(), playArrival: vi.fn(),
    letGo, holdAmbianceHour: vi.fn(() => letGo),
  }
})
vi.mock('./lib/api', () => ({
  api: p => p,
  apiFetch: vi.fn(async () => ({ ok: true, status: 200, json: async () => ({}) })),
  apiJson: vi.fn(path => (path === '/api/today/clear' ? api.next() : Promise.resolve({}))),
  apiJsonWithTimeout: vi.fn(async () => ({})),
  apiUpload: vi.fn(),
  ApiError: class extends Error {},
}))
vi.mock('./lib/supabase', () => ({
  supabase: { auth: {
    getSession: async () => ({ data: { session: { access_token: 'tok' } } }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
  } },
}))
vi.mock('./lib/audio', async o => ({
  ...(await o()), ...sounds,
  playClick: vi.fn(), playUi: vi.fn(), playAnnouncement: vi.fn(), startAmbiance: vi.fn(), stopAmbiance: vi.fn(),
}))
vi.mock('./stores/today', () => ({
  useTodaySummary: () => ({ data: day.today, failed: false }),
  refreshToday: vi.fn(), refetchToday: vi.fn(() => Promise.resolve()), seedTodaySummary: vi.fn(),
}))
vi.mock('./stores/journey', () => ({
  useJourneyStatus: () => ({ data: null, failed: false }),
  useVolumes: () => ({ data: null }),
  refreshJourney: vi.fn(), seedJourneyStatus: vi.fn(), openStatus: vi.fn(),
}))
vi.mock('./stores/profileSummary', async o => ({ ...(await o()),
  useProfileSummary: () => ({
    level: 14, xp: 30621, xpPrevLevel: 30000, xpForNext: 30970, jlptLevel: 'N5',
    streak: 6, week: [], guided: { today: true },
  }),
  useProfileSummaryState: () => ({ summary: null, failed: false }),
  refreshSummary: vi.fn(),
  applyXpGain: vi.fn(() => ({ leveledUp: false, newLevel: 14 })),
  applyStreak: vi.fn(),
}))
globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })

const { Shell } = await import('./components/chrome/Shell')
const { default: TodayScreen } = await import('./screens/TodayScreen')
const { resetDayClear, runKey } = await import('./stores/dayClear')
const { apiJson } = await import('./lib/api')
const { RUN_DAY, CLEAR_DAY, RUN_MONTH30, CLEAR_MONTH30, RUN_PARTIAL, CLEAR_PARTIAL, TODAY_PARTIAL, todayCleared } = await import('./components/dayclear/fixtures')

const SESSION = { access_token: 't' }
const settle = (ms = 60) => new Promise(r => setTimeout(r, ms))
const $ = sel => document.querySelector(sel)
const text = sel => $(sel)?.textContent.replace(/\s+/g, ' ').trim()

function deferred() {
  let resolve
  let reject
  const promise = new Promise((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}

// Where the router stands, for the finish's way back to /today.
function Where() {
  return <output className="where">{useLocation().pathname}</output>
}

function mount(state) {
  return render(
    <LangProvider>
      <MemoryRouter initialEntries={[{ pathname: '/today/clear', state }]}>
        <Where />
        <Routes>
          <Route element={<Shell />}>
            <Route path="/today" element={<TodayScreen session={SESSION} />} />
            <Route path="/today/clear" element={<TodayScreen session={SESSION} />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </LangProvider>
  )
}

// Polls until `fn` holds (or the time is up), for a beat on the clock.
async function until(fn, ms = 4000) {
  const end = Date.now() + ms
  while (!fn() && Date.now() < end) await settle(25)
  return fn()
}

beforeEach(() => {
  resetDayClear()
  vi.clearAllMocks()
  try { localStorage.setItem('lang', 'fr') } catch { /* private mode */ }
})

describe('/today/clear on a phone', () => {
  it('waits on the print with the bars away, plays the day, then hands Today back', async () => {
    const answer = deferred()
    api.next = () => answer.promise
    day.today = todayCleared(RUN_DAY)
    await mount({ run: RUN_DAY })
    await settle()
    // The wait: the print, the dial empty, the bars away in their places.
    expect($('.tdy-wait')).not.toBeNull()
    expect($('.hud.hud--away')).not.toBeNull()
    expect($('.tabbar.tabbar--away')).not.toBeNull()

    answer.resolve(CLEAR_DAY)
    expect(await until(() => $('.tdy--fin.tdy--clear'))).toBeTruthy()
    // The day's seal on the disc, the bars still away until their beat.
    expect(await until(() => $('.tdy-dial__seal'))).toBeTruthy()
    expect($('.hud--away')).not.toBeNull()
    // What the day was, its fare and prime, the week.
    expect(await until(() => text('.tdy-fin-fare'))).toBe('+252 xp · dont +55 de prime de série')
    expect(text('.tdy-recap:not(.tdy-fin-fare)')).toBe('32 cartes aujourd’hui')
    // The chrome beat: the bars are back.
    expect(await until(() => !$('.hud--away') && !$('.tabbar--away'))).toBe(true)
    // The fare said whole on the pass at its beat, and to a screen reader.
    expect(await until(() => text('.hud-fare'))).toBe('+252xp')
    expect([...document.querySelectorAll('[aria-live="polite"]')].some(n => n.textContent === '+252 XP')).toBe(true)
    // The board: the run's wrong pile, tomorrow; the gate shut.
    expect(await until(() => $('.btn-depart--gate'))).toBeTruthy()
    expect(text('[data-action="review-missed"] .tdy-next__n')).toBe('6cartes')
    expect($('.btn-depart--gate').disabled).toBe(true)
    // The rest: Today's own address, the finish's sounds played once.
    expect(await until(() => text('.where') === '/today')).toBe(true)
    expect($('.tdy--fin')).not.toBeNull()
    expect(sounds.playStamp).toHaveBeenCalledTimes(1)
    expect(sounds.playDayClear).toHaveBeenCalledTimes(1)
  })

  it('skips to the rest on a tap, and plays no sound', async () => {
    api.next = () => Promise.resolve(CLEAR_DAY)
    day.today = todayCleared(RUN_DAY)
    await mount({ run: RUN_DAY })
    expect(await until(() => $('.tdy--fin.tdy--clear'))).toBeTruthy()
    $('main.today').click()
    await settle(80)
    expect($('.tdy--fin.clrk--skip')).not.toBeNull()
    expect($('.btn-depart--gate')).not.toBeNull()
    expect($('[data-action="review-missed"]')).not.toBeNull()
    expect($('.hud--away')).toBeNull()
    expect(await until(() => text('.where') === '/today')).toBe(true)
    expect(sounds.playStamp).not.toHaveBeenCalled()
    expect(sounds.playDayClear).not.toHaveBeenCalled()
  })

  it('hears the month\'s night: the night\'s lake held while Today shows it', async () => {
    api.next = () => Promise.resolve(CLEAR_MONTH30)
    day.today = todayCleared(RUN_MONTH30)
    const screen = await mount({ run: RUN_MONTH30 })
    expect(await until(() => $('.tdy--fin.tdy--clear'))).toBeTruthy()
    expect(sounds.holdAmbianceHour).toHaveBeenCalledWith('night')
    expect(await until(() => text('.where') === '/today', 6000)).toBe(true)
    // The rest is still the night's; leaving Today gives the clock back.
    expect(sounds.letGo).not.toHaveBeenCalled()
    await screen.unmount()
    expect(sounds.letGo).toHaveBeenCalledTimes(1)
  })

  it('keeps the bars for a partial run and opens the gate on the cards left', async () => {
    api.next = () => Promise.resolve(CLEAR_PARTIAL)
    day.today = TODAY_PARTIAL
    await mount({ run: RUN_PARTIAL })
    expect(await until(() => $('.tdy--fin'))).toBeTruthy()
    expect($('.hud--away')).toBeNull()
    expect($('.tabbar--away')).toBeNull()
    // The day's thread on the dial; done and left said under it.
    expect(await until(() => $('.tdy-dial__thread'))).toBeTruthy()
    expect(await until(() => $('.tdy-key--fare'))).toBeTruthy()
    expect([...document.querySelectorAll('.tdy-key--fare .tdy-key__item')].map(n => n.textContent.trim()))
      .toEqual(['20 faites', '14 restent'])
    const gate = await until(() => $('.btn-depart--gate'))
    expect(gate.disabled).toBe(false)
    expect(gate.textContent).toContain('Continuer')
    expect(await until(() => text('.where') === '/today')).toBe(true)
    expect(sounds.playArrival).toHaveBeenCalledTimes(1)
  })

  it('shows the error with a way to ask again, and plays the answer that comes', async () => {
    let calls = 0
    api.next = () => (calls++ === 0 ? Promise.reject(new Error('offline')) : Promise.resolve(CLEAR_DAY))
    day.today = todayCleared(RUN_DAY)
    await mount({ run: RUN_DAY })
    const retry = await until(() => [...document.querySelectorAll('button')].find(b => b.textContent === 'Réessayer'))
    expect(retry).toBeTruthy()
    // The bars come back for the error.
    expect($('.hud--away')).toBeNull()
    retry.click()
    expect(await until(() => $('.tdy--fin.tdy--clear'))).toBeTruthy()
  })

  it('goes to the gate with no run to finish', async () => {
    api.next = () => Promise.resolve(CLEAR_DAY)
    day.today = todayCleared(RUN_DAY)
    await mount(null)
    expect(await until(() => text('.where') === '/today')).toBe(true)
    expect($('.tdy--fin')).toBeNull()
    expect(apiJson).not.toHaveBeenCalledWith('/api/today/clear', expect.anything(), expect.anything())
  })

  it('shows the gate as it stands on a reload, asking nothing', async () => {
    // What a reload leaves: the router's state (history.state survives
    // it) and the tab's note of the run it asked for, and no answer in
    // the store -- so no second ask and no second finish.
    window.sessionStorage.setItem('tsuji.dayClear.asked', runKey(RUN_DAY))
    api.next = () => Promise.resolve({ ...CLEAR_DAY, already: true })
    day.today = todayCleared(RUN_DAY)
    await mount({ run: RUN_DAY })
    expect(await until(() => text('.where') === '/today')).toBe(true)
    await settle()
    expect($('.tdy--fin')).toBeNull()
    expect($('.tdy--clear')).not.toBeNull()
    expect(apiJson).not.toHaveBeenCalledWith('/api/today/clear', expect.anything(), expect.anything())
  })
})
