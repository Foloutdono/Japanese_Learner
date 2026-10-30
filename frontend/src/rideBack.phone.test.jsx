import { describe, it, expect, vi, beforeEach, onTestFinished } from 'vitest'
import { render } from 'vitest-browser-react'
import './index.css'

// ── 試乗 — Back on the first ride, at phone width ─────────────────
// Reported 2026-10-17 from the trail: a new learner on Android Chrome
// used the back gesture on the reading ride and landed on the ride's
// first card. Each screen of the ride replaces the one before it, and
// the front door it was boarded from as well, so the entry behind the
// ride was the one the boarding began on: '/app', which sends a learner
// whose profile has no tutorialAt to the ride -- begun again from
// nothing, with no ride_done to say the learner had left.
//
// The whole app, on a real router, over that history. Back is now the
// head's Skip on the cards and the reading (the stamp, ride_done, the
// day's gate) once any sheet open over them is closed, and the frame's ‹
// on the introduction, its Skip on the first screen; and a second Back
// finds the front door sending to the gate, never the ride.

const apiJsonWithTimeout = vi.hoisted(() => vi.fn())
const apiJson = vi.hoisted(() => vi.fn())
vi.mock('./lib/api', () => ({
  api: p => p,
  apiFetch: vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ dailyNewTarget: 10 }) })),
  apiJson: (...a) => apiJson(...a),
  apiJsonWithTimeout: (...a) => apiJsonWithTimeout(...a),
  apiUpload: vi.fn(),
  ApiError: class ApiError extends Error {},
}))
vi.mock('./lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: async () => ({ data: { session: { access_token: 'tok', user: { id: 'user-1' } } } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
      signOut: async () => {},
    },
  },
}))
const track = vi.hoisted(() => vi.fn())
vi.mock('./lib/track', async o => ({ ...(await o()), track: (...a) => track(...a) }))
vi.mock('./lib/audio', async o => ({
  ...(await o()), playClick: vi.fn(), playUi: vi.fn(), playSfx: vi.fn(), playCorrect: vi.fn(),
  playWrong: vi.fn(), playKana: vi.fn(), preloadKana: vi.fn(), speakJapanese: vi.fn(),
}))
globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })

const { default: App } = await import('./App')
const { apiFetch } = await import('./lib/api')
const { refreshSummary } = await import('./stores/profileSummary')

const CARDS = [
  { card_id: 'vocab_N5__こんにちは', source: 'vocab', mode: 'vocab.flashcard.f2b', direction: 'f2b', kanji: '', kana: 'こんにちは', meaning: 'hello', level: 'N5', romaji: 'konnichiwa', stage: null, review_preview: null, hints: {} },
  { card_id: 'vocab_N5_駅_えき', source: 'vocab', mode: 'vocab.flashcard.f2b', direction: 'f2b', kanji: '駅', kana: 'えき', meaning: 'station', level: 'N5', romaji: 'eki', stage: null, review_preview: null, hints: {} },
]
const SENTENCE = {
  phrase: '駅で友だちに会います。', romaji: 'eki de tomodachi ni aimasu.',
  translation: 'I meet a friend at the station.', translation_lang: 'en',
  display_seconds: 30, grammar: 'で',
}
const VOLUMES = {
  vocab: { N5: 678, N4: 643, N3: 1738, N2: 1767, N1: 3229 },
  kanji: { N5: 103, N4: 144, N3: 366, N2: 367, N1: 1232 },
  grammar: { N5: 93, N4: 110, N3: 110, N2: 115, N1: 117 },
  kana: 238,
}
const PROFILE = { username: 'Tester', onboardedAt: '2026-10-17T21:40:00Z', jlptLevel: 'N5', kanaKnown: 'both', tutorialAt: null, guided: {} }

const settle = (ms = 120) => new Promise(r => setTimeout(r, ms))
const at = path => vi.waitFor(() => expect(window.location.pathname).toBe(path), { timeout: 4000 })
const found = (root, sel) => vi.waitFor(() => expect(root.querySelector(sel)).not.toBeNull(), { timeout: 4000 })
const posts = () => apiJson.mock.calls.filter(([, , init]) => init?.method === 'POST')
const rideDone = () => track.mock.calls.filter(([n]) => n === 'ride_done').map(([, p]) => p)
const views = () => track.mock.calls.filter(([n]) => n === 'screen_view').map(([, p]) => p.route)
const live = root => root.querySelector('.brd__car:not(.brd__car--out)')

/** The app booted over the history the learner had: the entry the
 *  boarding began on, under the one the router mounts on. */
async function boot(profile = PROFILE) {
  apiJsonWithTimeout.mockResolvedValue(profile)
  window.history.replaceState(null, '', '/app')
  window.history.pushState(null, '', '/app')
  const screen = await render(<App />)
  return screen.container
}

/** The bar lit: the card turned, and nothing left to open first. */
const graded = root => vi.waitFor(() => expect(root.querySelector('.rating-bar--idle')).toBeNull(), { timeout: 4000 })

/** Both cards turned and graded, then Continue: on to the reading. */
async function rideTheCards(root) {
  await found(root, '.flashcard')
  root.querySelector('.flashcard').click()
  // A phone looks the known card up before it grades it (plan 133).
  await found(root, '[data-guide="card.lookup"]')
  root.querySelector('[data-guide="card.lookup"]').click()
  await found(document, '.dict-sheet__scrim')
  document.querySelector('.dict-sheet__scrim').click()
  await graded(root)
  root.querySelector('.rating-bar__btn--q4').click()
  await vi.waitFor(() => expect(root.querySelector('.flashcard')?.textContent).toContain('駅'), { timeout: 4000 })
  root.querySelector('.flashcard').click()
  await graded(root)
  root.querySelector('.rating-bar__btn--q1').click()
  await found(root, '.ride__done')
  root.querySelector('.btn-depart').click()
}

/** Back from the day's gate: the front door, which a stamped ride
 *  sends on to the gate again -- never to the ride. */
async function backFromTheGate() {
  await vi.waitFor(() => expect(views().at(-1)).toBe('/today'), { timeout: 4000 })
  window.history.back()
  await vi.waitFor(() => expect(views().slice(-2)).toEqual(['/app', '/today']), { timeout: 4000 })
  expect(window.location.pathname).toBe('/today')
}

/** The sentence written and graded: the lesson over, into the station
 *  (plan 291: no plate after it). */
async function rideTheReading(root) {
  await found(root, '.sentence')
  const input = root.querySelector('input')
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, 'eki de tomodachi ni aimasu')
  input.dispatchEvent(new Event('input', { bubbles: true }))
  await settle(50)
  root.querySelector('.stage__foot button').click()
  await graded(root)
  root.querySelector('.rating-bar__btn--q4').click()
  await at('/today')
}

beforeEach(() => {
  // The cards' note on the device (lib/rideProgress.js), one learner's.
  window.localStorage.removeItem('tsuji.ride.cards:user-1')
  track.mockReset()
  apiJson.mockReset()
  apiJson.mockImplementation(async url => {
    if (String(url).startsWith('/api/onboarding/ride?')) return { cards: CARDS, sentence: SENTENCE }
    if (String(url) === '/api/onboarding/ride/done') return { tutorialAt: '2026-10-17T21:47:00Z', skipped: true }
    if (String(url) === '/api/onboarding/volumes') return VOLUMES
    return { total: 0, by_source: {}, lanes: [], next_due: null }
  })
})

describe('Back on the first ride, at 390×844', () => {
  it('skips the lesson from the reading ride rather than boarding it again', async () => {
    expect(window.innerWidth).toBe(390)
    const root = await boot()
    await at('/ride/cards')
    await rideTheCards(root)
    await at('/ride/reading')
    await found(root, '.sentence')

    window.history.back()
    await at('/today')
    const done = posts().find(([u]) => u === '/api/onboarding/ride/done')
    expect(JSON.parse(done[2].body)).toEqual({ skipped: true })
    expect(rideDone()).toEqual([expect.objectContaining({ skipped: true, at: 'reading' })])
    // The trail the learner left, without the ride boarded a second time.
    await vi.waitFor(() => expect(views()).toEqual(['/app', '/ride/cards', '/ride/reading', '/today']), { timeout: 4000 })

    // Behind the gate, nothing of the cards, which Continue took with it.
    await backFromTheGate()
    expect(views().filter(v => v.startsWith('/ride'))).toEqual(['/ride/cards', '/ride/reading'])
  })

  // The known card asks a phone to open its entry, and Back is how an
  // Android hand closes a sheet: that Back closes it, the next skips.
  it('closes the card\'s entry first, then skips the lesson from the cards', async () => {
    const root = await boot()
    await at('/ride/cards')
    await found(root, '.flashcard')
    root.querySelector('.flashcard').click()
    await found(root, '[data-guide="card.lookup"]')
    root.querySelector('[data-guide="card.lookup"]').click()
    await found(document, '.dict-sheet')

    window.history.back()
    await vi.waitFor(() => expect(document.querySelector('.dict-sheet')).toBeNull(), { timeout: 4000 })
    await graded(root)
    expect(window.location.pathname).toBe('/ride/cards')
    expect(rideDone()).toEqual([])
    // The guard stands again for the Back after it.
    await vi.waitFor(() => expect(window.history.state?.guard).toBe(true), { timeout: 4000 })

    window.history.back()
    await at('/today')
    expect(rideDone()).toEqual([expect.objectContaining({ skipped: true, at: 'cards' })])
    await backFromTheGate()
  })

  // 入門 (plan 170): the learner with no kana boards the introduction,
  // whose ‹ goes back a screen. Back does the same, and on the first
  // screen, which has no ‹, takes its Skip to the cards -- which skip as
  // everyone's do.
  it('walks the introduction back a screen at a time, skips it from the first, and the ride from the cards', async () => {
    const root = await boot({ ...PROFILE, kanaKnown: 'none' })
    await at('/ride/intro')
    await found(root, 'main.brd.nyu')
    const stepOf = () => root.querySelector('main.brd.nyu').dataset.step
    const onStep = step => vi.waitFor(() => expect(stepOf()).toBe(step), { timeout: 4000 })
    const guarded = () => vi.waitFor(() => expect(window.history.state?.guard).toBe(true), { timeout: 4000 })
    const next = async step => {
      live(root).querySelector('[data-action="continue"]').click()
      await onStep(step)
      await settle(400)   // the pull between screens
    }
    await next('sounds')
    await next('table')
    await guarded()

    window.history.back()
    await onStep('sounds')
    expect(window.location.pathname).toBe('/ride/intro')
    await guarded()
    window.history.back()
    await onStep('scripts')
    expect(window.location.pathname).toBe('/ride/intro')
    await guarded()

    window.history.back()
    await at('/ride/cards')
    await found(root, '.flashcard')
    window.history.back()
    await at('/today')
    expect(rideDone()).toEqual([expect.objectContaining({ skipped: true, at: 'cards' })])
  })

  // Chrome's back button passes over an entry a page added without a
  // tap since it was reached (the history intervention), and the ride's
  // guard is stood on mount: a phone's Back can land past it, on the
  // front door, in one pop -- where React renders the door, unmounting
  // the ride, before a listener the ride added could hear it.
  // history.back() is exempt from the rule, so the skip is played as the
  // go(-2) the button makes of it.
  it('sends to the gate when Back passes over the guard to the front door', async () => {
    const root = await boot()
    await at('/ride/cards')
    await rideTheCards(root)
    await at('/ride/reading')
    await found(root, '.sentence')

    window.history.go(-2)
    await at('/today')
    expect(rideDone()).toEqual([expect.objectContaining({ skipped: true, at: 'reading' })])
    await settle(300)
    expect(views().filter(v => v === '/ride/cards')).toHaveLength(1)
    expect(window.location.pathname).toBe('/today')
  })
})

// ── The lesson is over at its grade ─────────────────────────────────
// Reported 2026-10-18 from the trail: a learner reached the reading's
// plate, left it some other way than its button, and the front door
// boarded them onto the first card again. The stamp is the grade's, and
// on a phone the grade is the way into the station since plan 291; the
// cards done leave a note the door reads.
describe('A ride left before its last button, at 390×844', () => {
  it('is stamped the moment the sentence is graded, and the grade enters the station', async () => {
    const root = await boot()
    await at('/ride/cards')
    await rideTheCards(root)
    await at('/ride/reading')
    await rideTheReading(root)

    const done = posts().find(([u]) => u === '/api/onboarding/ride/done')
    expect(JSON.parse(done[2].body)).toEqual({ skipped: false })
    expect(rideDone()).toEqual([expect.objectContaining({ skipped: false, at: 'reading' })])
    expect(views().at(-1)).toBe('/today')

    await backFromTheGate()
    expect(rideDone()).toHaveLength(1)
    expect(posts().filter(([u]) => u === '/api/onboarding/ride/done')).toHaveLength(1)
  })

  // 入門 (plan 170): the learner with no kana has no sentence to read, so
  // the cards' last button stamps the lesson and enters the station.
  it('takes a learner with no kana from the cards into the station', async () => {
    // The summary the cards read says so, as /api/profile does.
    const answer = apiFetch.getMockImplementation()
    apiFetch.mockImplementation(async () => ({ ok: true, status: 200, json: async () => ({ dailyNewTarget: 10, kanaKnown: 'none' }) }))
    onTestFinished(async () => {
      apiFetch.mockImplementation(answer)
      await refreshSummary()
    })
    await refreshSummary()
    const root = await boot({ ...PROFILE, kanaKnown: 'none' })
    await at('/ride/intro')
    await found(root, 'main.brd.nyu')
    await vi.waitFor(() => expect(window.history.state?.guard).toBe(true), { timeout: 4000 })
    // The introduction's first screen: Back is its Skip, to the cards.
    window.history.back()
    await at('/ride/cards')
    await rideTheCards(root)

    await at('/today')
    const done = posts().find(([u]) => u === '/api/onboarding/ride/done')
    expect(JSON.parse(done[2].body)).toEqual({ skipped: false })
    expect(rideDone()).toEqual([expect.objectContaining({ skipped: false, at: 'cards' })])
    expect(views()).not.toContain('/ride/reading')
    await backFromTheGate()
  })

  it('boards the reading, not the first card, after a reload between the halves', async () => {
    const first = await boot()
    await at('/ride/cards')
    await rideTheCards(first)
    await at('/ride/reading')
    await found(first, '.sentence')

    // The page loaded again, the ride unstamped.
    const again = await boot()
    await at('/ride/reading')
    await found(again, '.sentence')
    expect(views().at(-1)).toBe('/ride/reading')
  })
})
