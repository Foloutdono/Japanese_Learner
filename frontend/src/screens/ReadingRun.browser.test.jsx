import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { LangProvider } from '../LangContext'
import { translations } from '../i18n'

// ── 読解 — the breakdown toggle, and what it may hide ──────────
// Pressing "show breakdown" is a TRADE: the registers above it (the
// phrase, its romaji, the translation, what the learner wrote) come
// off the card so the single-card breakdown gets the room. That trade
// is only honest while there is a breakdown to trade them FOR, and the
// analysis is fetched on a background request that can still be in
// flight when the button is reached — fetchAnalysis fires the instant
// the phrase is shown, so the whole display-and-writing window is
// prefetch, but a slow or retrying model call outlasts it.
//
// So the button's own state is the thing worth pinning: shut until the
// analysis is in hand, and saying which of the two reasons it is shut
// for. The run is mounted through the route that gives it its source,
// with the API mocked at its boundary and the analysis request held
// open by hand.

const apiFetch = vi.fn()

vi.mock('../lib/api', () => ({
  api: p => p,
  apiFetch: (...a) => apiFetch(...a),
  apiJson: vi.fn(),
  apiJsonWithTimeout: vi.fn(),
  apiUpload: vi.fn(),
  ApiError: class ApiError extends Error {},
}))
vi.mock('../lib/audio', async importOriginal => ({
  ...(await importOriginal()),
  playUi: () => {},
  playClick: () => {},
  playSfx: () => {},
  playCorrect: () => {},
  playWrong: () => {},
  startAmbiance: () => {},
  stopAmbiance: () => {},
}))
globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })

const { default: ReadingRun } = await import('./ReadingRun')

const ANSWER = 'gakkou wa kuji desu'

const PHRASE = {
  phrase: '学校は九時からです。',
  romaji: 'gakkou wa kuji kara desu',
  translation: 'School starts at nine.',
  translation_lang: 'en',
  display_seconds: 30, // long enough that the clock never covers the phrase mid-test
  source_word: { kanji: '学校', kana: 'がっこう', level: 'N5' },
}

// What POST /api/phrase/analyze returns, cut to the fields the stepper
// layout actually reads (SentenceBreakdown.jsx).
const ANALYSIS = {
  text: PHRASE.phrase,
  level: 'N5',
  unknown_count: 0,
  off_deck_count: 0,
  grammar: [],
  tokens: [
    { surface: '学校', reading: 'がっこう', pos: 'noun', furigana: [{ text: '学校', reading: 'がっこう' }] },
    { surface: 'は', reading: 'は', pos: 'particle', furigana: [{ text: 'は' }] },
  ],
}

const res = (body, ok = true) => ({ ok, status: ok ? 200 : 500, json: async () => body })

/** A promise this test holds the far end of. */
function deferred() {
  let settle
  return { promise: new Promise(r => { settle = r }), release: v => settle(v) }
}

// What POST /api/phrase/analyze answers with. A test that wants the
// request to stay in flight puts a deferred's promise here.
let analysisReply

const settle = (ms = 60) => new Promise(r => setTimeout(r, ms))

const setValue = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
function type(el, value) {
  setValue.call(el, value)
  el.dispatchEvent(new Event('input', { bubbles: true }))
}

async function run(level = 'N5') {
  const screen = await render(
    <LangProvider>
      <MemoryRouter initialEntries={[`/practice/reading/level/${level}`]}>
        <Routes>
          <Route path="/practice/reading/level/:level" element={<ReadingRun session={null} />} />
        </Routes>
      </MemoryRouter>
    </LangProvider>
  )
  await settle(120)
  return screen.container
}

/**
 * A run carried to where the toggle exists at all: one phrase read,
 * answered, and rated — the breakdown block is behind
 * `feedback.correct !== null`, so nothing less than a rating reveals
 * it. Rates the best seal; the bar draws worst-first, so that is the
 * last one on screen.
 */
async function graded() {
  const root = await run()
  type(root.querySelector('input'), ANSWER)
  await settle(20)
  root.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
  await settle(80)

  const seals = root.querySelectorAll('.rating-bar__btn')
  seals[seals.length - 1].click()
  await settle(80)
  return root
}

const toggle = root => root.querySelector('.prose__breakdown button')

/** The four things "show breakdown" takes off the card. */
function registersShowing(root) {
  return Boolean(root.querySelector('.prose__jp'))
    && root.textContent.includes(PHRASE.romaji)
    && root.textContent.includes(PHRASE.translation)
    && root.textContent.includes(ANSWER)
}

beforeEach(() => {
  apiFetch.mockReset()
  analysisReply = Promise.resolve(res(ANALYSIS))
  apiFetch.mockImplementation(path => {
    if (path.startsWith('/api/reading/batch')) return Promise.resolve(res({ phrases: [PHRASE, { ...PHRASE }] }))
    if (path === '/api/phrase/analyze') return analysisReply
    return Promise.resolve(res({}))
  })
})

describe('ReadingRun — the breakdown toggle', () => {
  it('keeps the registers on screen when pressed before the breakdown arrives', async () => {
    const inFlight = deferred()
    analysisReply = inFlight.promise

    const root = await graded()

    // Shut, and saying why: the request has not come back yet.
    expect(toggle(root).disabled).toBe(true)
    expect(toggle(root).textContent).toBe(translations.fr.preparingBreakdown)

    // The press the learner makes anyway. It must not take the card
    // apart: hiding the registers here would leave nothing in their
    // place, since the breakdown is gated on the analysis it is still
    // waiting for.
    toggle(root).click()
    await settle(60)

    expect(registersShowing(root)).toBe(true)
    expect(root.querySelector('.rdg-breakdown')).toBeFalsy()

    // And when it does land, the same button performs the trade.
    inFlight.release(res(ANALYSIS))
    await settle(120)

    expect(toggle(root).disabled).toBe(false)
    expect(toggle(root).textContent).toBe(translations.fr.showBreakdown)

    toggle(root).click()
    await settle(120)

    expect(root.querySelector('.rdg-breakdown')).toBeTruthy()
    expect(registersShowing(root)).toBe(false)
    expect(toggle(root).textContent).toBe(translations.fr.hideBreakdown)
  })

  it('says the breakdown is unavailable rather than forever coming', async () => {
    analysisReply = Promise.resolve(res(null, false))

    const root = await graded()

    // A settled fetch with nothing to show is not "preparing", and the
    // learner is owed the difference — the first state ends, the second
    // does not.
    expect(toggle(root).disabled).toBe(true)
    expect(toggle(root).textContent).toBe(translations.fr.breakdownUnavailable)

    toggle(root).click()
    await settle(60)

    expect(registersShowing(root)).toBe(true)
    expect(root.querySelector('.rdg-breakdown')).toBeFalsy()
  })
})
