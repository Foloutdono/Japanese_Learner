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
// The learner's reading pace, set per test (stores/readingPace); a
// press of the clock's chip sets it and re-renders its readers.
const paced = vi.hoisted(() => {
  const listeners = new Set()
  return { pace: 'standard', listeners, set(p) { this.pace = p; listeners.forEach(l => l()) } }
})
vi.mock('../stores/readingPace', async () => {
  const { useSyncExternalStore } = await import('react')
  return {
    useReadingPace: () => useSyncExternalStore(l => { paced.listeners.add(l); return () => paced.listeners.delete(l) }, () => paced.pace),
    setReadingPace: vi.fn(async id => { paced.set(id) }),
  }
})
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

const EXPLANATION = 'から marks the starting point in time.'

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
  await play(root)
  type(root.querySelector('input'), ANSWER)
  await settle(20)
  root.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
  await settle(80)

  const seals = root.querySelectorAll('.rating-bar__btn')
  seals[seals.length - 1].click()
  await settle(80)
  return root
}

/** The play button a phrase arrives behind, pressed: the sentence on
 *  the card, the clock running, the field open. */
async function play(root) {
  root.querySelector('.clip-player__play').click()
  await settle(20)
}

const toggle = root => root.querySelector('.prose__breakdown button')

/** What "show breakdown" takes off the card: the sentence leading with
 *  its romaji and its translation, and the answer's well (plan 184). */
function registersShowing(root) {
  return Boolean(root.querySelector('.pcard-lead'))
    && root.textContent.includes(PHRASE.romaji)
    && root.textContent.includes(PHRASE.translation)
    && Boolean(root.querySelector('.pcard-well .pcard-answer'))
}

beforeEach(() => {
  paced.pace = 'standard'
  apiFetch.mockReset()
  analysisReply = Promise.resolve(res(ANALYSIS))
  apiFetch.mockImplementation((path, _session, init) => {
    if (path.startsWith('/api/reading/batch')) return Promise.resolve(res({ phrases: [PHRASE, { ...PHRASE }] }))
    if (path === '/api/phrase/analyze') {
      // The eager fetch is the local tier; Explain buys the deep tier
      // (plan 095, owner-directed).
      if (init?.body && JSON.parse(init.body).deep) return Promise.resolve(res({ ...ANALYSIS, explanation: EXPLANATION }))
      return analysisReply
    }
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
    expect(root.querySelector('.bkd')).toBeFalsy()

    // And when it does land, the same button performs the trade.
    inFlight.release(res(ANALYSIS))
    await settle(120)

    expect(toggle(root).disabled).toBe(false)
    expect(toggle(root).textContent).toBe(translations.fr.showBreakdown)

    toggle(root).click()
    await settle(120)

    expect(root.querySelector('.bkd')).toBeTruthy()
    expect(registersShowing(root)).toBe(false)
    expect(toggle(root).textContent).toBe(translations.fr.hideBreakdown)
  })

  it('fetches the local tier only, and buys the explanation when Explain is pressed', async () => {
    const root = await graded()
    const deep = () => apiFetch.mock.calls.filter(c => c[0] === '/api/phrase/analyze').map(c => JSON.parse(c[2].body).deep)
    expect(deep()).toEqual([false])
    toggle(root).click()
    await settle(120)
    expect(root.querySelector('.bkd .prose__ai')).toBeNull()
    root.querySelector('.bkd__explain button').click()
    await settle(120)
    expect(deep()).toEqual([false, true])
    expect(root.querySelector('.bkd .prose__ai').textContent).toBe(EXPLANATION)
    expect(root.querySelector('.bkd__explain')).toBeNull()
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
    expect(root.querySelector('.bkd')).toBeFalsy()
  })
})

// ── 読解 — the figure beside the answer ───────────────────────
// How much of the line the answer caught, measured by the server and
// printed on the answer's own label. It is a hint for the learner
// rating themselves below it and not the rating, so the rules it lives
// by are the rules of a hint: the reveal never waits for it, it is
// simply absent if it never lands, and it never shows a figure
// belonging to a sentence the reader has already left.
describe('ReadingRun — the measurement', () => {
  // The figure at the end of the answer's well (plan 184): the number
  // and its % in the bold, the caption under it.
  const measure = root => root.querySelector('.pcard-well__fig b')

  /** A phrase read, answered and revealed — no rating. */
  async function answered(root, given = ANSWER) {
    await play(root)
    type(root.querySelector('input'), given)
    await settle(20)
    root.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    await settle(80)
    return root
  }

  it('prints what the server matched, on the answer’s own label', async () => {
    const checks = []
    apiFetch.mockImplementation((path, _s, opts) => {
      if (path.startsWith('/api/reading/batch')) return Promise.resolve(res({ phrases: [PHRASE, { ...PHRASE }] }))
      if (path === '/api/phrase/analyze') return analysisReply
      if (path === '/api/reading/check') {
        checks.push(JSON.parse(opts.body))
        return Promise.resolve(res({ accuracy: 78, matched: 'romaji' }))
      }
      return Promise.resolve(res({}))
    })

    const root = await answered(await run())

    expect(measure(root).textContent).toBe('78%')
    expect(root.querySelector('.pcard-well__cap').textContent).toBe(translations.fr.pcardMatched)
    // Measured against the sentence the batch served and the romaji it
    // served with it — the run holds both, so the reveal itself never
    // waited on this request.
    expect(checks).toEqual([
      { phrase: PHRASE.phrase, romaji: PHRASE.romaji, answer: ANSWER },
    ])
    // The answer in its well, read against the sentence's romaji: the
    // word it left out given in its place.
    expect(root.querySelector('.pcard-well .pcard-answer').textContent).toBe('gakkou wa kuji kara desu')
    expect(root.querySelector('.pcard-well .pcard-add').textContent).toBe('kara')
  })

  it('shows the answer with no figure when the measurement fails', async () => {
    apiFetch.mockImplementation(path => {
      if (path.startsWith('/api/reading/batch')) return Promise.resolve(res({ phrases: [PHRASE, { ...PHRASE }] }))
      if (path === '/api/phrase/analyze') return analysisReply
      if (path === '/api/reading/check') return Promise.reject(new Error('offline'))
      return Promise.resolve(res({}))
    })

    const root = await answered(await run())

    // The reveal is the run; the figure is a hint on it. Losing the
    // hint costs the hint.
    expect(measure(root)).toBeFalsy()
    expect(root.querySelector('.pcard-well__fig')).toBeNull()
    expect(root.querySelector('.pcard-well .pcard-answer').textContent).toContain('gakkou wa kuji')
    expect(root.querySelector('.rating-bar__btn')).toBeTruthy()
  })

  it('never prints a figure belonging to the phrase before', async () => {
    const held = deferred()
    apiFetch.mockImplementation((path, _s, opts) => {
      if (path.startsWith('/api/reading/batch')) return Promise.resolve(res({ phrases: [PHRASE, { ...PHRASE }] }))
      if (path === '/api/phrase/analyze') return analysisReply
      if (path === '/api/reading/check') {
        // The first answer's measurement is the slow one.
        return JSON.parse(opts.body).answer === ANSWER
          ? held.promise
          : Promise.resolve(res({ accuracy: 42, matched: 'romaji' }))
      }
      return Promise.resolve(res({}))
    })

    const root = await answered(await run())
    expect(measure(root)).toBeFalsy()

    // Rate it, move on, and answer the next one.
    const seals = root.querySelectorAll('.rating-bar__btn')
    seals[seals.length - 1].click()
    await settle(80)
    root.querySelector('.stage__foot button').click()
    await settle(80)
    await answered(root, 'zenzen chigau')

    expect(measure(root).textContent).toBe('42%')

    // The first sentence's figure, landing late. It belongs to a card
    // that is no longer on screen and must not overwrite this one.
    held.release(res({ accuracy: 99, matched: 'romaji' }))
    await settle(120)

    expect(measure(root).textContent).toBe('42%')
  })

  it('sends the figure up with the rating, and null when it never landed', async () => {
    const posted = []
    // A function rather than a promise: a rejected promise made here and
    // only handed to the run several awaits later is unhandled in the
    // meantime, which vitest reports as an error and exits non-zero on
    // even though every test passed. Built when the run asks for it, the
    // rejection is handed straight to measure()'s own catch.
    let measurement = () => Promise.resolve(res({ accuracy: 78, matched: 'romaji' }))
    apiFetch.mockImplementation((path, _s, opts) => {
      if (path.startsWith('/api/reading/batch')) return Promise.resolve(res({ phrases: [PHRASE, { ...PHRASE }] }))
      if (path === '/api/phrase/analyze') return analysisReply
      if (path === '/api/reading/check') return measurement()
      if (path === '/api/reading/result') {
        posted.push(JSON.parse(opts.body))
        return Promise.resolve(res({}))
      }
      return Promise.resolve(res({}))
    })

    const root = await answered(await run())
    const rate = () => {
      const seals = root.querySelectorAll('.rating-bar__btn')
      seals[seals.length - 1].click()
      return settle(80)
    }
    await rate()

    // The figure the learner was looking at when they rated, kept
    // beside the rating rather than instead of it.
    expect(posted).toHaveLength(1)
    expect(posted[0].accuracy).toBe(78)
    expect(posted[0].correct).toBe(true)

    // The next sentence, with no measurement to be had. The rating is
    // a fact about what the learner did either way, so it still goes
    // up -- carrying null, which is "unmeasured" and not "caught none
    // of it".
    measurement = () => Promise.reject(new Error('offline'))
    root.querySelector('.stage__foot button').click()
    await settle(80)
    await answered(root, 'zenzen chigau')
    await rate()

    expect(posted).toHaveLength(2)
    expect(posted[1].accuracy).toBe(null)
    expect(posted[1].quality).toBe(posted[0].quality)
  })
})

// ── 読解 — the play button ───────────────────────────────────
// A phrase arrives with its sentence held back behind a play button,
// the clock still and the field shut, so the reading begins when the
// learner is ready rather than the instant the phrase loads. Pressing
// it shows the sentence and starts the clock.
describe('ReadingRun — the play button', () => {
  const button = root => root.querySelector('.clip-player__play')
  const clock = root => root.querySelector('.timer__label').textContent

  it('holds the sentence and the clock until it is pressed', async () => {
    const root = await run()

    expect(button(root).getAttribute('aria-label')).toBe(translations.fr.readingPlay)
    expect(root.textContent).not.toContain(PHRASE.phrase)
    expect(root.querySelector('input').disabled).toBe(true)
    expect(clock(root)).toBe('30.0s')
    await settle(300)
    expect(clock(root)).toBe('30.0s')

    // Nothing is taken before the press, not even a forced submit.
    root.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    await settle(60)
    expect(root.querySelector('.rating-bar__btn')).toBeNull()

    await play(root)

    expect(button(root)).toBeNull()
    expect(root.querySelector('.sentence').textContent).toBe(PHRASE.phrase)
    const field = root.querySelector('input')
    expect(field.disabled).toBe(false)
    expect(document.activeElement).toBe(field)
    await settle(300)
    expect(parseFloat(clock(root))).toBeLessThan(30)
  })

  it('holds the next phrase back too', async () => {
    const root = await graded()
    root.querySelector('.stage__foot button').click()
    await settle(80)

    expect(button(root)).toBeTruthy()
    expect(root.querySelector('.sentence')).toBeNull()
    expect(root.querySelector('input').disabled).toBe(true)
    expect(clock(root)).toBe('30.0s')
  })
})

// ── The reading pace (Settings › Reading pace) ─────────────────
// The clock runs in the browser: the server's display_seconds are the
// standard pace's, and a slower pace is the same clock run slower, so
// what it prints is still the seconds left.
describe('ReadingRun — the reading pace', () => {
  const clock = root => root.querySelector('.timer__label').textContent

  it('gives a slow reader twice the time, counted down in real seconds', async () => {
    paced.pace = 'slow'
    const root = await run()
    expect(clock(root)).toBe('60.0s')

    await play(root)
    await settle(500)
    const left = parseFloat(clock(root))
    expect(left).toBeLessThan(60)
    // Half a second gone, not a whole one: the clock is the reader's.
    expect(left).toBeGreaterThan(59)
  })

  it('never covers the sentence when nothing is timed', async () => {
    paced.pace = 'untimed'
    // A sentence the standard clock would cover in a fifth of a second.
    apiFetch.mockImplementation(path => {
      if (path.startsWith('/api/reading/batch')) return Promise.resolve(res({ phrases: [{ ...PHRASE, display_seconds: 0.2 }] }))
      return Promise.resolve(res(ANALYSIS))
    })
    const root = await run()
    expect(clock(root)).toBe(translations.fr.readingUntimed)
    // No countdown to announce.
    expect(root.querySelector('[role="timer"]')).toBeNull()

    await play(root)
    await settle(500)
    expect(root.querySelector('.sentence').textContent).toBe(PHRASE.phrase)
    expect(root.querySelector('.sentence--covered')).toBeNull()
    expect(clock(root)).toBe(translations.fr.readingUntimed)
  })

  // The chip at the clock's end (the owner's pick B): each press the
  // next pace, the clock answering at once, before play and during it.
  it('turns the pace from the chip on the clock, the time following', async () => {
    const root = await run()
    const chip = () => root.querySelector('.timer .pace-chip')
    expect(chip().textContent).toBe('×1')
    expect(chip().getAttribute('aria-label')).toBe(translations.fr.readingPaceChip(translations.fr.readingPaceOption.standard))
    expect(clock(root)).toBe('30.0s')

    const seen = []
    for (let i = 0; i < 4; i++) {
      chip().click()
      await settle(20)
      seen.push([chip().textContent, clock(root)])
    }
    expect(seen).toEqual([
      ['×1,5', '45.0s'],
      ['×2', '60.0s'],
      ['∞', translations.fr.readingUntimed],
      ['×1', '30.0s'],
    ])
  })

  it('keeps a covered sentence covered when the pace goes untimed', async () => {
    apiFetch.mockImplementation(path => {
      if (path.startsWith('/api/reading/batch')) return Promise.resolve(res({ phrases: [{ ...PHRASE, display_seconds: 0.2 }] }))
      return Promise.resolve(res(ANALYSIS))
    })
    const root = await run()
    await play(root)
    await settle(400)
    expect(root.querySelector('.sentence--covered')).not.toBeNull()

    // Standard to untimed is three presses; none of them uncovers it.
    for (let i = 0; i < 3; i++) {
      root.querySelector('.timer .pace-chip').click()
      await settle(20)
    }
    expect(root.querySelector('.pace-chip').textContent).toBe('∞')
    expect(root.querySelector('.sentence--covered')).not.toBeNull()
    expect(clock(root)).toBe(translations.fr.writeWhatYouSaw)
  })
})
