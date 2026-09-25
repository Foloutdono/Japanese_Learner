import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { LangProvider } from '../LangContext'
import '../index.css'

// ── 試乗 — the test ride (plan 098) ──────────────────────────────
// The two cards on the real stage: flip, rate, flip, rate, the done
// screen, Continue — and not one request to a review endpoint. Skip is
// the head's ‹ and posts the same stamp with `skipped: true`; a
// payload that cannot be served leaves for the app without a stamp.

const apiJson = vi.fn()
vi.mock('../lib/api', () => ({
  api: p => p,
  apiFetch: vi.fn(async () => ({ ok: true, status: 200, json: async () => ({}) })),
  apiJson: (...a) => apiJson(...a),
  apiJsonWithTimeout: vi.fn(),
  apiUpload: vi.fn(),
  ApiError: class ApiError extends Error {},
}))
const track = vi.fn()
vi.mock('../lib/track', () => ({ track: (...a) => track(...a), flush: vi.fn() }))
const summaryRef = { current: null }
vi.mock('../stores/profileSummary', async (o) => ({
  ...(await o()),
  useProfileSummary: () => summaryRef.current,
}))
vi.mock('../stores/credits', async (o) => ({
  ...(await o()),
  useCredits: () => ({ balance: 200, cap: 50, dailyRefill: 30, refillAt: null, plan: 'free', unlimited: false, enforced: false }),
}))
const speakJapanese = vi.fn()
vi.mock('../lib/audio', async (o) => ({
  ...(await o()), playKana: vi.fn(), playCorrect: vi.fn(), playWrong: vi.fn(),
  playClick: vi.fn(), playUi: vi.fn(), playSfx: vi.fn(), speakJapanese: (...a) => speakJapanese(...a),
}))
globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })

const { default: RideRun } = await import('./RideRun')
// The lane runs fr-FR, and the browser's storage is one origin shared
// by every file in it: setting `lang` here once flipped the copy under
// TranslationRun's and ComprehensionRun's assertions mid-run. So the
// copy is asserted from the French table itself.
const { default: fr } = await import('../locales/fr/index.js')

const KNOWN = {
  card_id: 'vocab_N3__こんにちは', source: 'vocab', mode: 'vocab.flashcard.f2b', direction: 'f2b',
  kanji: '', kana: 'こんにちは', meaning: 'hello', level: 'N3', romaji: 'konnichiwa',
  stage: null, review_preview: null, hints: {},
}
const UNKNOWN = {
  card_id: 'vocab_N5_駅_えき', source: 'vocab', mode: 'vocab.flashcard.f2b', direction: 'f2b',
  kanji: '駅', kana: 'えき', meaning: 'station', level: 'N5', romaji: 'eki',
  stage: null, review_preview: null, hints: { indice_3: [{ text: '駅', reading: 'えき' }] },
}

const settle = (ms = 120) => new Promise(r => setTimeout(r, ms))

function mount(props = {}) {
  return render(
    <LangProvider>
      <MemoryRouter initialEntries={['/ride/cards']}>
        <Routes>
          <Route path="/today" element={<div className="gate-probe">today</div>} />
          <Route path="/ride/reading" element={<div className="reading-probe">reading</div>} />
          <Route path="/ride/cards" element={<RideRun session={{ access_token: 'tok' }} {...props} />} />
        </Routes>
      </MemoryRouter>
    </LangProvider>
  )
}

function serve() {
  apiJson.mockImplementation(async (url) => {
    if (String(url).startsWith('/api/onboarding/ride?')) return { cards: [KNOWN, UNKNOWN], sentence: {} }
    return {}
  })
}

const posts = () => apiJson.mock.calls.filter(([, , init]) => init?.method === 'POST')
const rateButton = (root, q) => root.querySelector(`.rating-bar__btn--q${q}`)
// Plan 132: the known card, turned, waits on its dictionary entry --
// the 🔍 opens it in a sheet, the scrim closes it, and only then does
// the bar light.
async function lookUp(root) {
  root.querySelector('[data-guide="card.lookup"]').click()
  await settle(120)
  document.querySelector('.dict-sheet__scrim').click()
  await settle(120)
}

beforeEach(() => {
  apiJson.mockReset()
  track.mockReset()
  speakJapanese.mockReset()
  localStorage.clear()
  summaryRef.current = { kanaKnown: 'both', dailyNewTarget: 10 }
})

describe('RideRun', () => {
  it('flips and rates two cards on the stage, then Continue goes on to the reading ride without a stamp', async () => {
    serve()
    const onDone = vi.fn()
    const screen = await mount({ onDone })
    await settle(200)
    const root = screen.container
    // The stage: ‹ Skip, the pair, the remaining pill.
    expect(root.querySelector('main.stage')).toBeTruthy()
    expect(root.querySelector('.stage__leave').textContent).toContain(fr.rideSkip)
    expect(root.querySelector('.stage__where-jp').textContent).toBe('試乗')
    expect(root.querySelector('.today-remaining').textContent).toBe('2')
    // The known card, front up, and the first note over it.
    expect(root.querySelector('.flashcard').textContent).toContain('こんにちは')
    expect(document.querySelector('.guide-callout__text').textContent).toContain(fr.rideKnownFront)
    expect(root.querySelector('[data-guide="ride.card"]')).toBeTruthy()
    // The bar is reserved but inert until the flip.
    expect(root.querySelector('.rating-bar--idle')).toBeTruthy()

    root.querySelector('.flashcard').click()
    await settle(80)
    // Turned: the note points at the 🔍, and the bar stays inert until
    // the entry has been opened and closed (plan 132).
    expect(document.querySelector('.guide-callout__text').textContent).toContain(fr.rideKnownDict)
    expect(document.querySelector('.guide-callout').dataset.place).toBe('below')
    expect(root.querySelector('.rating-bar--idle')).toBeTruthy()
    window.dispatchEvent(new KeyboardEvent('keydown', { key: '1' }))
    await settle(600)
    // The key rated nothing: the known card is still on the stage.
    expect(root.querySelector('.today-remaining').textContent).toBe('2')
    root.querySelector('[data-guide="card.lookup"]').click()
    await settle(120)
    // The sheet is open, and no note stands over it.
    expect(document.querySelector('.dict-sheet')).toBeTruthy()
    expect(document.querySelector('.guide-callout')).toBeNull()
    document.querySelector('.dict-sheet__scrim').click()
    await settle(120)
    expect(document.querySelector('.dict-sheet')).toBeNull()
    expect(root.querySelector('.rating-bar--idle')).toBeNull()
    expect(document.querySelector('.guide-callout__text').textContent).toContain(fr.rideKnownBack)
    expect(document.querySelector('.guide-callout').dataset.place).toBe('above')

    rateButton(root, 4).click()
    await settle(600)
    // The second card: the unknown one, front up, the pill down to 1.
    expect(root.querySelector('.flashcard').textContent).toContain('駅')
    expect(root.querySelector('.today-remaining').textContent).toBe('1')
    expect(document.querySelector('.guide-callout__text').textContent).toContain(fr.rideUnknownFront)

    root.querySelector('.flashcard').click()
    await settle(80)
    // The second card is graded straight away: the door was shown once.
    expect(document.querySelector('.guide-callout__text').textContent).toContain(fr.rideUnknownBack)
    rateButton(root, 1).click()
    await settle(600)

    // The done screen: the pace in the sentence, no guess note, the
    // one filled action; no card, no note, no pill.
    expect(root.querySelector('.ride__done')).toBeTruthy()
    expect(root.querySelector('.ride__done-text').textContent).toContain('10 mots nouveaux par jour')
    expect(root.querySelector('.ride__done-note')).toBeNull()
    expect(root.querySelector('.flashcard')).toBeNull()
    expect(document.querySelector('.guide-callout')).toBeNull()
    expect(root.querySelector('.today-remaining')).toBeNull()

    // Nothing was reviewed and nothing stamped: the lesson's stamp is
    // the reading ride's plate (plan 099). Continue goes there.
    expect(posts()).toHaveLength(0)
    root.querySelector('.btn-depart').click()
    await settle(200)
    expect(posts()).toHaveLength(0)
    expect(apiJson.mock.calls.some(([u]) => /review/.test(String(u)))).toBe(false)
    expect(onDone).not.toHaveBeenCalled()
    expect(root.querySelector('.reading-probe')).toBeTruthy()

    // The trail: every transition, the last one onto the reading ride;
    // no ride_done here -- only a skip ends the lesson on this screen.
    const steps = track.mock.calls.filter(([n]) => n === 'ride_step').map(([, p]) => `${p.step}>${p.to}`)
    expect(steps).toEqual(['known>known-dict', 'known-dict>known-back', 'known-back>unknown', 'unknown>unknown-back', 'unknown-back>done', 'done>reading'])
    expect(track.mock.calls.find(([n]) => n === 'ride_done')).toBeUndefined()
  })

  it('answers a guessed second card gently, and the keyboard rates like the bar', async () => {
    serve()
    const screen = await mount()
    await settle(200)
    const root = screen.container
    root.querySelector('.flashcard').click()
    await settle(80)
    await lookUp(root)
    // "1" is the best answer on every bar (RatingBar's contract).
    window.dispatchEvent(new KeyboardEvent('keydown', { key: '1' }))
    await settle(600)
    root.querySelector('.flashcard').click()
    await settle(80)
    window.dispatchEvent(new KeyboardEvent('keydown', { key: '1' }))
    await settle(600)
    expect(root.querySelector('.ride__done')).toBeTruthy()
    expect(root.querySelector('.ride__done-note').textContent).toContain(fr.rideGuessed)
  })

  it('Skip is the head\'s ‹ and stamps the ride as skipped', async () => {
    serve()
    const onDone = vi.fn()
    const screen = await mount({ onDone })
    await settle(200)
    screen.container.querySelector('.stage__leave').click()
    await settle(200)
    const [url, , init] = posts()[0]
    expect(url).toBe('/api/onboarding/ride/done')
    expect(JSON.parse(init.body)).toEqual({ skipped: true })
    expect(onDone).toHaveBeenCalledTimes(1)
    expect(screen.container.querySelector('.gate-probe')).toBeTruthy()
    expect(track.mock.calls.find(([n]) => n === 'ride_done')[1]).toMatchObject({ skipped: true, at: 'cards' })
  })

  it('a ride that cannot be served is never a locked door: leaves for the app, stamps nothing', async () => {
    apiJson.mockImplementation(async (url) => {
      if (String(url).startsWith('/api/onboarding/ride?')) throw new Error('offline')
      return {}
    })
    const onDone = vi.fn()
    const screen = await mount({ onDone })
    await settle(200)
    expect(screen.container.querySelector('.gate-probe')).toBeTruthy()
    expect(posts()).toHaveLength(0)
    expect(onDone).toHaveBeenCalledTimes(1)
  })

  it('a learner with no kana gets the reading in letters over the word, and hears it on the flip', async () => {
    serve()
    summaryRef.current = { kanaKnown: 'none', dailyNewTarget: 5 }
    const screen = await mount()
    await settle(200)
    const root = screen.container
    expect(root.querySelector('.flashcard rt, .flashcard .furigana-word')?.textContent).toContain('konnichiwa')
    root.querySelector('.flashcard').click()
    await settle(80)
    expect(speakJapanese).toHaveBeenCalledWith('こんにちは')
  })

  it('keeps the note under the cutscene until it lifts', async () => {
    serve()
    const screen = await mount({ covered: true })
    await settle(200)
    expect(screen.container.querySelector('.flashcard')).toBeTruthy()
    expect(document.querySelector('.guide-callout')).toBeNull()
  })
})
