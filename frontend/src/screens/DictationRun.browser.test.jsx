import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { LangProvider } from '../LangContext'

// ── 書取 — the run, and the rules that ARE the mode ────────────
// Everything else on the Practice tab shows the sentence and asks the
// learner to grade themselves against it. This one hides the sentence
// and limits the audio, so those are the things worth pinning:
//
//   1. the batch carries no words, in any of the three ways the line
//      can be written. A learner who opens devtools must find audio
//      and an id — otherwise the mode is a listening exercise only for
//      people who chose not to look.
//   2. two listens, and the third is refused. Not "counted", refused:
//      the play button goes to the app's one disabled treatment and
//      stays there.
//   3. the grade in the log is the LEARNER's. The reveal measures, the
//      rating bar grades, and nothing is written until they have rated
//      (docs/adr/0013).
//
// The run is mounted through the router that gives it its grade, with
// the API mocked at its boundary.

const apiJson = vi.fn()
// The word-by-word breakdown goes out over apiFetch (POST
// /api/phrase/analyze), so this one has to answer like the real thing
// -- a bare vi.fn() returns undefined, and the screen would be reading
// `.then` off it.
const apiFetch = vi.fn()

vi.mock('../lib/api', () => ({
  api: p => p,
  apiFetch: (...a) => apiFetch(...a),
  apiJson: (...a) => apiJson(...a),
  apiJsonWithTimeout: vi.fn(),
  apiUpload: vi.fn(),
  ApiError: class ApiError extends Error {},
}))
vi.mock('../lib/audio', async importOriginal => ({
  ...(await importOriginal()),
  playUi: () => {},
  playClick: () => {},
  playSfx: () => {},
  startAmbiance: () => {},
  stopAmbiance: () => {},
}))
vi.mock('../stores/stats', () => ({
  useStats: () => ({ data: null, failed: false }), refreshStats: vi.fn(), seedStats: vi.fn(),
}))
globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })

const { default: DictationRun } = await import('./DictationRun')

// A real, decodable clip rather than a path: the player flips to its
// "audio unavailable" bar the moment the element errors, and a 404 from
// the test server is an error. This is a 44-byte silent WAV — it loads,
// it plays, and it ends immediately, which is exactly the sequence the
// play limit counts.
const SILENCE = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAgD4AAAB9AAACABAAZGF0YQAAAAA='

const LINE = {
  jp: '学校は九時からです。',
  kana: 'がっこうはくじからです。',
  romaji: 'gakkou wa kuji kara desu',
  en: 'School starts at nine.',
}
const BATCH = {
  level: 'N5',
  max_plays: 2,
  clips: [
    { id: 'clip-one', level: 'N5', audioSrc: SILENCE },
    { id: 'clip-two', level: 'N5', audioSrc: SILENCE },
  ],
}
const REVEAL = {
  id: 'clip-one',
  level: 'N5',
  jp: LINE.jp,
  kana: LINE.kana,
  romaji: LINE.romaji,
  // What study/dictation.reveal builds from the bank's own kana: one
  // part per run, a reading only where furigana belongs.
  furigana: [
    { text: '学', reading: 'がっ' },
    { text: '校', reading: 'こう' },
    { text: 'は' },
    { text: '九', reading: 'く' },
    { text: '時', reading: 'じ' },
    { text: 'からです。' },
  ],
  translation: LINE.en,
  translation_lang: 'en',
  accuracy: 90,
  matched: 'romaji',
}

// What POST /api/phrase/analyze answers with: the deep tier's shape as
// SentenceBreakdown reads it (analysis.tokens ?? analysis.words).
const ANALYSIS = {
  text: LINE.jp,
  tokens: [
    { surface: '学校', reading: 'がっこう', meaning: 'school', pos: 'noun' },
    { surface: 'は', reading: 'は', meaning: 'topic marker', pos: 'particle' },
    { surface: '九時', reading: 'くじ', meaning: 'nine oclock', pos: 'noun' },
    { surface: 'からです', reading: 'からです', meaning: 'starts from', pos: 'expression' },
  ],
  explanation: 'から marks the starting point in time.',
}

const settle = (ms = 60) => new Promise(r => setTimeout(r, ms))

const setValue = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
function type(el, value) {
  setValue.call(el, value)
  el.dispatchEvent(new Event('input', { bubbles: true }))
}

async function run(level = 'N5') {
  const screen = await render(
    <LangProvider>
      <MemoryRouter initialEntries={[`/practice/dictation/${level}`]}>
        <Routes>
          <Route path="/practice/dictation/:level" element={<DictationRun session={null} />} />
        </Routes>
      </MemoryRouter>
    </LangProvider>
  )
  await settle(120)
  return screen.container
}

/** A run with one clip answered, sitting on the reveal. */
async function answered(text = 'gakkou wa kuji desu') {
  const root = await run()
  type(root.querySelector('input'), text)
  await settle(20)
  root.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
  await settle(140)
  return root
}

beforeEach(() => {
  apiJson.mockReset()
  apiJson.mockImplementation(path =>
    path.startsWith('/api/dictation/batch') ? Promise.resolve(BATCH)
      : path === '/api/dictation/check' ? Promise.resolve(REVEAL)
        : Promise.resolve({ correct: true }))
  apiFetch.mockReset()
  apiFetch.mockResolvedValue({ ok: true, status: 200, json: async () => ANALYSIS })
})

/** The reveal, rated — where the breakdown lives. */
async function graded(text = 'gakkou wa kuji desu') {
  const root = await answered(text)
  ;[...root.querySelectorAll('.rating-bar button')].at(-1).click()
  await settle(140)
  return root
}

const breakdownButton = root =>
  [...root.querySelectorAll('.prose__breakdown button')][0]

describe('DictationRun', () => {
  it('asks for its own grade and shows the clip', async () => {
    const root = await run('N4')
    expect(apiJson.mock.calls[0][0]).toContain('level=N4')
    expect(root.querySelector('.clip-player')).toBeTruthy()
    expect(root.querySelector('audio').getAttribute('src')).toBe(SILENCE)
  })

  it('puts no part of the sentence on the page before it is answered', async () => {
    const root = await run()
    for (const form of [LINE.jp, LINE.kana, LINE.romaji, LINE.en]) {
      expect(root.textContent).not.toContain(form)
    }
  })

  it('asks for the answer in romaji, on a field nothing may rewrite', async () => {
    const root = await run()
    const field = root.querySelector('input')
    // No lang="ja": the field holds Latin letters, and saying otherwise
    // invites an IME onto a keyboard the learner does not have.
    expect(field.getAttribute('lang')).toBeNull()
    expect(field.getAttribute('autocorrect')).toBe('off')
    expect(field.getAttribute('autocapitalize')).toBe('off')
    expect(field.spellcheck).toBe(false)
    expect(field.placeholder.toLowerCase()).toContain('romaji')
  })

  it('offers two listens and spends one per play', async () => {
    const root = await run()
    expect(root.querySelectorAll('.clip-player__mark')).toHaveLength(2)
    expect(root.querySelectorAll('.clip-player__mark--spent')).toHaveLength(0)
    expect(root.textContent).toContain('2 écoutes restantes')

    root.querySelector('.clip-player__play').click()
    await settle(80)
    expect(root.querySelectorAll('.clip-player__mark--spent')).toHaveLength(1)
    expect(root.textContent).toContain('1 écoute restante')
  })

  it('refuses the third listen rather than merely counting it', async () => {
    const root = await run()
    const play = root.querySelector('.clip-player__play')
    play.click()
    await settle(80)
    play.click()
    await settle(80)

    expect(root.querySelectorAll('.clip-player__mark--spent')).toHaveLength(2)
    expect(root.querySelector('.clip-player__play').disabled).toBe(true)

    // And pressing it again cannot get past the guard either.
    root.querySelector('.clip-player__play').click()
    await settle(60)
    expect(root.querySelectorAll('.clip-player__mark--spent')).toHaveLength(2)
  })

  it('sends the answer to be revealed against', async () => {
    const root = await run()
    root.querySelector('.clip-player__play').click()
    await settle(80)

    type(root.querySelector('input'), 'gakkou wa kuji desu')
    await settle(20)
    root.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    await settle(120)

    const check = apiJson.mock.calls.find(c => c[0] === '/api/dictation/check')
    expect(check).toBeTruthy()
    expect(JSON.parse(check[2].body)).toEqual({
      clip_id: 'clip-one', answer: 'gakkou wa kuji desu',
    })
  })

  it('reveals the line with its furigana, its romaji and the gloss', async () => {
    const root = await answered()

    // The bases reconstruct the sentence — a part dropped in rendering
    // would show a line that was never said. Read without the rt
    // nodes, which textContent would otherwise interleave into it.
    const line = root.querySelector('.kaki-line')
    const bases = [...line.childNodes].map(node =>
      node.tagName === 'RUBY'
        ? [...node.childNodes].filter(c => c.tagName !== 'RT').map(c => c.textContent).join('')
        : node.textContent)
    expect(bases.join('')).toBe(LINE.jp)
    expect([...line.querySelectorAll('rt')].map(rt => rt.textContent))
      .toEqual(['がっ', 'こう', 'く', 'じ'])

    // Romaji where the kana line used to be: the alphabet the learner
    // just answered in is the one they can check themselves against.
    expect(root.querySelector('.prose__romaji').textContent).toBe(LINE.romaji)
    expect(root.querySelector('.prose__kana')).toBeNull()
    expect(root.textContent).toContain(LINE.en)
  })

  it('prints what was typed back, beside how much of it matched', async () => {
    const root = await answered()
    expect(root.textContent).toContain('gakkou wa kuji desu')
    expect(root.querySelector('.kaki-accuracy').textContent).toContain('90')
  })

  it('hands the grade to the learner, not to the server', async () => {
    const root = await answered()
    // The rating bar, not a verdict: nothing on this screen tells the
    // learner whether they were right.
    expect(root.querySelector('.rating-bar')).toBeTruthy()
    expect(root.querySelector('.kaki-score')).toBeNull()
    // And nothing is logged until they have rated.
    expect(apiJson.mock.calls.some(c => c[0] === '/api/dictation/result')).toBe(false)
  })

  it('logs the rating the learner gave, with the figure they saw', async () => {
    const root = await answered()
    const good = [...root.querySelectorAll('.rating-bar button')].at(-1)
    good.click()
    await settle(120)

    const result = apiJson.mock.calls.find(c => c[0] === '/api/dictation/result')
    expect(result, root.textContent.slice(0, 200)).toBeTruthy()
    const body = JSON.parse(result[2].body)
    expect(body.clip_id).toBe('clip-one')
    expect(body.answer).toBe('gakkou wa kuji desu')
    expect(body.accuracy).toBe(90)
    expect(body.quality).toBeGreaterThan(2)
  })

  it('counts the run by the learner\'s own rating', async () => {
    const root = await answered()
    expect(root.textContent).toContain('0 / 0')
    ;[...root.querySelectorAll('.rating-bar button')].at(-1).click()
    await settle(120)
    expect(root.textContent).toContain('1 / 1')
  })

  it('gives the next clip a fresh pair of listens', async () => {
    const root = await run()
    root.querySelector('.clip-player__play').click()
    await settle(80)
    type(root.querySelector('input'), 'a')
    await settle(20)
    root.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    await settle(140)
    ;[...root.querySelectorAll('.rating-bar button')].at(-1).click()
    await settle(120)

    const nextBtn = [...root.querySelectorAll('button')].find(b => b.textContent.includes('Phrase suivante'))
    expect(nextBtn, root.textContent.slice(0, 200)).toBeTruthy()
    nextBtn.click()
    await settle(120)

    expect(root.querySelectorAll('.clip-player__mark--spent')).toHaveLength(0)
    expect(root.textContent).toContain('2 écoutes restantes')
  })

  // ── 解析 — the word-by-word breakdown on the reveal ──
  // Reading practice's carousel, on this stage, gated on the one moment
  // the mode allows it: after the learner has graded themselves. What
  // is worth pinning is the two rules it inherits from the mode -- the
  // line is not asked about before it has been answered, and the gloss
  // is not offered before the grade -- plus the failure, which this
  // screen can actually reach where reading practice's prefetch hides
  // it.
  it('asks nothing about the line until the line has been answered', async () => {
    const root = await run()
    root.querySelector('.clip-player__play').click()
    await settle(80)
    expect(apiFetch.mock.calls).toHaveLength(0)

    type(root.querySelector('input'), 'gakkou wa kuji desu')
    await settle(20)
    root.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    await settle(140)

    const analyze = apiFetch.mock.calls.find(c => c[0] === '/api/phrase/analyze')
    expect(analyze, 'the reveal starts the breakdown').toBeTruthy()
    const body = JSON.parse(analyze[2].body)
    expect(body.phrase).toBe(LINE.jp)
    // Out of the analyzer's own history, and the deep tier, exactly as
    // reading practice asks for it.
    expect(body.save).toBe(false)
    expect(body.deep).toBe(true)
  })

  it('offers no breakdown until the learner has graded themselves', async () => {
    const root = await answered()
    expect(root.querySelector('.prose__breakdown')).toBeNull()

    ;[...root.querySelectorAll('.rating-bar button')].at(-1).click()
    await settle(140)
    expect(root.querySelector('.prose__breakdown')).toBeTruthy()
  })

  it('opens the words, and puts the read registers away while it is open', async () => {
    const root = await graded()
    const button = breakdownButton(root)
    expect(button.disabled).toBe(false)
    expect(button.textContent).toContain('Voir la décomposition')

    button.click()
    await settle(80)

    // The carousel is drawn, and the sentence survives as its own word
    // index rather than as the register that was put away.
    expect(root.querySelector('.rdg-breakdown')).toBeTruthy()
    expect(root.querySelector('.kaki-line')).toBeNull()
    expect(root.textContent).not.toContain(LINE.romaji)
    expect(root.querySelector('.rdg-breakdown-line').textContent).toContain('学校')

    breakdownButton(root).click()
    await settle(80)
    expect(root.querySelector('.rdg-breakdown')).toBeNull()
    expect(root.querySelector('.kaki-line')).toBeTruthy()
  })

  it('refuses the toggle while the breakdown is still being fetched', async () => {
    // Reading practice leaves this button live during the fetch and
    // gets away with it -- its prefetch is long finished by the time
    // the button exists. Here the fetch starts AT the reveal, so a
    // press mid-flight is ordinary, and it would put the registers
    // away with nothing to draw in their place.
    let release
    apiFetch.mockReturnValue(new Promise(resolve => { release = resolve }))

    const root = await graded()
    const button = breakdownButton(root)
    expect(button.disabled).toBe(true)
    expect(button.textContent).toContain('Préparation')

    button.click()
    await settle(60)
    expect(root.querySelector('.kaki-line'), 'the registers stayed put').toBeTruthy()

    release({ ok: true, status: 200, json: async () => ANALYSIS })
    await settle(120)
    expect(breakdownButton(root).disabled).toBe(false)
  })

  it('costs the breakdown and nothing else when the analysis fails', async () => {
    apiFetch.mockRejectedValue(new Error('model down'))
    const root = await graded()

    // The run is still on its reveal, with the line and the learner's
    // own answer on it -- not on the error screen.
    expect(root.querySelector('.empty--error')).toBeNull()
    expect(root.querySelector('.kaki-line')).toBeTruthy()
    expect(root.textContent).toContain('gakkou wa kuji desu')

    const button = breakdownButton(root)
    expect(button.disabled).toBe(true)
    expect(button.textContent).toContain('indisponible')
  })

  it('starts the next clip with no breakdown of the last one', async () => {
    const root = await graded()
    breakdownButton(root).click()
    await settle(80)
    expect(root.querySelector('.rdg-breakdown')).toBeTruthy()

    const nextBtn = [...root.querySelectorAll('button')].find(b => b.textContent.includes('Phrase suivante'))
    nextBtn.click()
    await settle(120)

    expect(root.querySelector('.rdg-breakdown')).toBeNull()
    expect(root.querySelector('.prose__breakdown')).toBeNull()
    expect(root.querySelector('.clip-player')).toBeTruthy()
  })

  it('says so when a clip could not be loaded', async () => {
    apiJson.mockImplementation(path =>
      path.startsWith('/api/dictation/batch')
        ? Promise.reject(new Error('boom'))
        : Promise.resolve(REVEAL))
    const root = await run()
    expect(root.querySelector('.empty--error')).toBeTruthy()
  })
})
