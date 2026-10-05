import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { LangProvider } from '../LangContext'
import '../index.css'

// ── 試乗 — the reading ride (plan 099) ───────────────────────────
// The sentence, the clock, the field, the measure against the ticket
// office's own check, the rating, and the plate: the platforms on the
// pass from the same map the server enforces, the offer under it, the
// open-for-now line keyed on the server's `enforced`, and "Enter the
// station" as the lesson's one stamp. Skip is the same stamp.

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
const creditsRef = { current: null }
vi.mock('../stores/credits', async (o) => ({
  ...(await o()),
  useCredits: () => creditsRef.current,
}))
vi.mock('../lib/audio', async (o) => ({
  ...(await o()), playCorrect: vi.fn(), playWrong: vi.fn(), playClick: vi.fn(), playSfx: vi.fn(), speakJapanese: vi.fn(),
}))
globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })

const { default: RideReading } = await import('./RideReading')
const { default: fr } = await import('../locales/fr/index.js')
const { PASS_PLATFORMS } = await import('../domain/paywall')
const { seedSummary, forgetSummary } = await import('../stores/profileSummary')

const SENTENCE = {
  phrase: '駅で友だちに会います。', romaji: 'eki de tomodachi ni aimasu.',
  translation: 'I meet a friend at the station.', translation_lang: 'en',
  display_seconds: 0.4, grammar: 'で',
}
const FREE = { balance: 200, cap: 50, dailyRefill: 30, nextCreditAt: null, plan: 'free', unlimited: false, enforced: false }
const settle = (ms = 120) => new Promise(r => setTimeout(r, ms))
// A controlled input: React listens to its own value tracker, so the
// prototype's setter is what makes a programmatic value an onChange.
function type(input, value) {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, value)
  input.dispatchEvent(new Event('input', { bubbles: true }))
}
const posts = () => apiJson.mock.calls.filter(([, , init]) => init?.method === 'POST')

function mount(props = {}) {
  return render(
    <LangProvider>
      <MemoryRouter initialEntries={['/ride/reading']}>
        <Routes>
          <Route path="/today" element={<div className="gate-probe">today</div>} />
          <Route path="/ride/reading" element={<RideReading session={{ access_token: 'tok' }} {...props} />} />
        </Routes>
      </MemoryRouter>
    </LangProvider>
  )
}

function serve() {
  apiJson.mockImplementation(async (url, _s, init) => {
    if (String(url).startsWith('/api/onboarding/ride?')) return { cards: [], sentence: SENTENCE }
    if (String(url) === '/api/onboarding/ride/check') return { accuracy: 100, matched: 'romaji' }
    if (String(url) === '/api/onboarding/ride/done') return { tutorialAt: 'x', skipped: JSON.parse(init.body).skipped }
    return {}
  })
}

beforeEach(() => {
  apiJson.mockReset()
  track.mockReset()
  creditsRef.current = FREE
})

describe('RideReading', () => {
  it('reads, writes, measures, rates, and the plate stamps the lesson on Enter', async () => {
    serve()
    const onDone = vi.fn()
    const screen = await mount({ onDone })
    await settle(150)
    const root = screen.container
    expect(root.querySelector('.stage__where-jp').textContent).toBe('試乗')
    expect(root.querySelector('.stage__leave').textContent).toContain(fr.rideSkip)
    // The sentence, the clock, the field; the note over the sentence.
    expect(root.querySelector('.sentence').textContent).toBe(SENTENCE.phrase)
    expect(root.querySelector('.timer')).toBeTruthy()
    expect(document.querySelector('.guide-callout__text').textContent).toContain(fr.rideReadFront)
    // The clock runs out: the sentence is covered and the note moves
    // to the field.
    await settle(700)
    expect(root.querySelector('.sentence--covered')).toBeTruthy()
    expect(document.querySelector('.guide-callout__text').textContent).toContain(fr.rideReadType)

    type(root.querySelector('input'), 'eki de tomodachi ni aimasu')
    await settle(50)
    root.querySelector('.stage__foot button').click()
    await settle(200)
    // The practice card (plan 184): the sentence leading, the answer in
    // its well with the measure from the office's own check at its end;
    // the note over the bar.
    expect(root.querySelector('.pcard-lead__jp').textContent).toBe(SENTENCE.phrase)
    expect(root.querySelector('.pcard-well__fig b').textContent).toBe('100%')
    const check = posts().find(([u]) => u === '/api/onboarding/ride/check')
    expect(JSON.parse(check[2].body)).toEqual({ answer: 'eki de tomodachi ni aimasu' })
    expect(document.querySelector('.guide-callout__text').textContent).toContain(fr.rideReadMeasure)

    root.querySelector('.rating-bar__btn--q4').click()
    await settle(200)
    // The plate: the six platforms from the map, the offer, the open
    // line (nothing enforced), the one filled action. No note.
    const plate = root.querySelector('.ride__plate')
    expect(plate).toBeTruthy()
    expect(plate.querySelectorAll('.ride__plate-item')).toHaveLength(Object.keys(PASS_PLATFORMS).length)
    expect(plate.querySelector('[data-action="paywall-open"]').dataset.source).toBe('ride')
    expect(plate.querySelector('.ride__done-note').textContent).toContain(fr.ridePlateOpen)
    expect(document.querySelector('.guide-callout')).toBeNull()
    // No result was posted anywhere: the ride is not a reading run.
    expect(posts().some(([u]) => /reading/.test(String(u)))).toBe(false)

    root.querySelector('[data-action="enter"]').click()
    await settle(200)
    const done = posts().find(([u]) => u === '/api/onboarding/ride/done')
    expect(JSON.parse(done[2].body)).toEqual({ skipped: false })
    expect(onDone).toHaveBeenCalledTimes(1)
    expect(root.querySelector('.gate-probe')).toBeTruthy()
    const steps = track.mock.calls.filter(([n]) => n === 'ride_step').map(([, p]) => `${p.step}>${p.to}`)
    expect(steps).toEqual(['read>type', 'type>measure', 'measure>pass'])
    expect(track.mock.calls.find(([n]) => n === 'ride_done')[1]).toMatchObject({ skipped: false, at: 'reading' })
  })

  it('under enforcement the plate drops the open-for-now line', async () => {
    serve()
    creditsRef.current = { ...FREE, enforced: true }
    const screen = await mount({ dryRun: true, sentence: { ...SENTENCE, display_seconds: 5 } })
    await settle(100)
    const root = screen.container
    type(root.querySelector('input'), 'eki')
    await settle(50)
    root.querySelector('.stage__foot button').click()
    await settle(100)
    root.querySelector('.rating-bar__btn--q1').click()
    await settle(100)
    expect(root.querySelector('.ride__plate')).toBeTruthy()
    expect(root.querySelector('.ride__done-note')).toBeNull()
  })

  it('Skip stamps the lesson as skipped and leaves for the app', async () => {
    serve()
    const onDone = vi.fn()
    const screen = await mount({ onDone })
    await settle(150)
    screen.container.querySelector('.stage__leave').click()
    await settle(200)
    const done = posts().find(([u]) => u === '/api/onboarding/ride/done')
    expect(JSON.parse(done[2].body)).toEqual({ skipped: true })
    expect(onDone).toHaveBeenCalledTimes(1)
    expect(screen.container.querySelector('.gate-probe')).toBeTruthy()
    expect(track.mock.calls.find(([n]) => n === 'ride_done')[1]).toMatchObject({ skipped: true, at: 'reading' })
  })

  // 入門 (plan 170): a learner with no kana was handed the map of the
  // language instead of a sentence, so their ride is the plate alone --
  // no sentence asked for -- and Enter stamps the lesson as it does at
  // the reading's end.
  it('is the plate alone for a learner who reads no kana', async () => {
    serve()
    seedSummary({ kanaKnown: 'none' })
    try {
      const onDone = vi.fn()
      const screen = await mount({ onDone })
      await settle(150)
      const root = screen.container
      expect(root.querySelector('.ride__plate')).toBeTruthy()
      expect(root.querySelector('.sentence')).toBeNull()
      expect(apiJson.mock.calls.some(([u]) => String(u).startsWith('/api/onboarding/ride?'))).toBe(false)
      root.querySelector('[data-action="enter"]').click()
      await settle(200)
      const done = posts().find(([u]) => u === '/api/onboarding/ride/done')
      expect(JSON.parse(done[2].body)).toEqual({ skipped: false })
      expect(onDone).toHaveBeenCalledTimes(1)
    } finally {
      forgetSummary()
    }
  })

  it('a sentence that cannot be served leaves for the app without a stamp', async () => {
    apiJson.mockImplementation(async (url) => {
      if (String(url).startsWith('/api/onboarding/ride?')) throw new Error('offline')
      return {}
    })
    const screen = await mount()
    await settle(200)
    expect(screen.container.querySelector('.gate-probe')).toBeTruthy()
    expect(posts()).toHaveLength(0)
  })
})
