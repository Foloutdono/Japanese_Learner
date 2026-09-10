import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { LangProvider } from '../LangContext'

// ── 書取 — the run, and the two rules that ARE the mode ────────
// Everything else on the Practice tab shows the sentence and asks the
// learner to grade themselves against it. This one hides the sentence
// and limits the audio, so those two are the things worth pinning:
//
//   1. the batch carries no words. A learner who opens devtools must
//      find audio and an id, and no text — otherwise the mode is a
//      listening exercise only for people who chose not to look.
//   2. two listens, and the third is refused. Not "counted", refused:
//      the play button goes to the app's one disabled treatment and
//      stays there.
//
// The run is mounted through the router that gives it its grade, with
// the API mocked at its boundary.

const apiJson = vi.fn()

vi.mock('../lib/api', () => ({
  api: p => p,
  apiFetch: vi.fn(),
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
const GRADED = {
  id: 'clip-one',
  level: 'N5',
  jp: LINE.jp,
  kana: LINE.kana,
  translation: LINE.en,
  translation_lang: 'en',
  accuracy: 90,
  verdict: 'close',
  correct: true,
  matched: 'kana',
  target: 'がっこうはくじからです',
  diff: [
    { op: 'equal', text: 'がっこうはくじ' },
    { op: 'missing', text: 'から' },
    { op: 'equal', text: 'です' },
  ],
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

beforeEach(() => {
  apiJson.mockReset()
  apiJson.mockImplementation(path =>
    path.startsWith('/api/dictation/batch') ? Promise.resolve(BATCH) : Promise.resolve(GRADED))
})

describe('DictationRun', () => {
  it('asks for its own grade and shows the clip', async () => {
    const root = await run('N4')
    expect(apiJson.mock.calls[0][0]).toContain('level=N4')
    expect(root.querySelector('.clip-player')).toBeTruthy()
    expect(root.querySelector('audio').getAttribute('src')).toBe(SILENCE)
  })

  it('puts no part of the sentence on the page before it is answered', async () => {
    const root = await run()
    expect(root.textContent).not.toContain(LINE.jp)
    expect(root.textContent).not.toContain(LINE.kana)
    expect(root.textContent).not.toContain(LINE.en)
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

  it('sends the answer with the number of listens taken', async () => {
    const root = await run()
    root.querySelector('.clip-player__play').click()
    await settle(80)

    type(root.querySelector('input'), 'がっこうはくじです')
    await settle(20)
    root.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    await settle(120)

    const check = apiJson.mock.calls.find(c => c[0] === '/api/dictation/check')
    expect(check).toBeTruthy()
    expect(JSON.parse(check[2].body)).toEqual({
      clip_id: 'clip-one', answer: 'がっこうはくじです', plays: 1,
    })
  })

  it('reveals the line, its reading and the gloss once answered', async () => {
    const root = await run()
    type(root.querySelector('input'), 'がっこうはくじです')
    await settle(20)
    root.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    await settle(140)

    expect(root.querySelector('.prose__jp').textContent).toBe(LINE.jp)
    expect(root.querySelector('.prose__kana').textContent).toBe(LINE.kana)
    expect(root.textContent).toContain(LINE.en)
  })

  it('marks the attempt run by run, and the runs spell the line', async () => {
    const root = await run()
    type(root.querySelector('input'), 'がっこうはくじです')
    await settle(20)
    root.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    await settle(140)

    const runs = [...root.querySelectorAll('.kaki-diff__run')]
    expect(runs.map(r => r.className.split('--')[1])).toEqual(['equal', 'missing', 'equal'])
    const reference = runs
      .filter(r => !r.className.includes('extra'))
      .map(r => r.textContent).join('')
    expect(reference).toBe(GRADED.target)
  })

  it('reports the grade as a figure and a word in the state ink', async () => {
    const root = await run()
    type(root.querySelector('input'), 'がっこうはくじです')
    await settle(20)
    root.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    await settle(140)

    expect(root.querySelector('.kaki-score--close')).toBeTruthy()
    expect(root.querySelector('.record__value').textContent).toBe('90%')
    expect(root.querySelector('.kaki-score__verdict').textContent.trim()).toBe('Presque')
  })

  it('gives the next clip a fresh pair of listens', async () => {
    const root = await run()
    root.querySelector('.clip-player__play').click()
    await settle(80)
    type(root.querySelector('input'), 'あ')
    await settle(20)
    root.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    await settle(140)

    const nextBtn = [...root.querySelectorAll('button')].find(b => b.textContent.includes('Phrase suivante'))
    expect(nextBtn, root.textContent.slice(0, 200)).toBeTruthy()
    nextBtn.click()
    await settle(120)

    expect(root.querySelectorAll('.clip-player__mark--spent')).toHaveLength(0)
    expect(root.textContent).toContain('2 écoutes restantes')
  })

  it('says so when a clip could not be loaded', async () => {
    apiJson.mockImplementation(path =>
      path.startsWith('/api/dictation/batch')
        ? Promise.reject(new Error('boom'))
        : Promise.resolve(GRADED))
    const root = await run()
    expect(root.querySelector('.empty--error')).toBeTruthy()
  })
})
