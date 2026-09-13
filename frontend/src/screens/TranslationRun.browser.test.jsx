import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { LangProvider } from '../LangContext'

// ── 翻訳 — the reference, word by word (plan 084) ──────────────
// Translation practice grades the learner's OWN sentence, and the
// tutor's reading of that attempt is the mode's point. What plan 084
// added beside it is the breakdown of the REFERENCE: reading
// practice's rows, prefetched the moment the prompt goes up (the
// reference is on the client from the start), shown once the learner
// has graded themselves, and never in place of the tutor's reading.
// Those are the rules worth pinning.

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
  startAmbiance: () => {},
  stopAmbiance: () => {},
}))
vi.mock('../stores/stats', () => ({
  useStats: () => ({ data: null, failed: false }), refreshStats: vi.fn(), seedStats: vi.fn(),
}))
globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })

const { default: TranslationRun } = await import('./TranslationRun')

const PHRASES = [
  { phrase: '学校は九時からです。', romaji: 'gakkou wa kuji kara desu', translation: 'School starts at nine.', translation_lang: 'en' },
  { phrase: '駅で会いました。', romaji: 'eki de aimashita', translation: 'I met at the station.', translation_lang: 'en' },
]

// What POST /api/phrase/analyze answers with for the reference: the
// deep tier's shape as SentenceBreakdown reads it.
const ANALYSIS = {
  text: PHRASES[0].phrase,
  available: true,
  grammar: [],
  tokens: [
    { surface: '学校', reading: 'がっこう', meaning: 'school', pos: 'noun', furigana: [{ text: '学校', reading: 'がっこう' }],
      vocab_match: { level: 'N5', raw_id: 'vocab_N5_学校_がっこう', entry: { kanji: '学校', kana: 'がっこう', meaning: 'school' }, stats: { status: 'not_started' } }, kanji_matches: [] },
    { surface: 'は', reading: 'は', meaning: 'topic marker', pos: 'particle', furigana: [{ text: 'は' }], vocab_match: null, kanji_matches: [] },
    { surface: '九時', reading: 'くじ', meaning: 'nine oclock', pos: 'noun', furigana: [{ text: '九時', reading: 'くじ' }], vocab_match: null, kanji_matches: [] },
    { surface: 'からです', reading: 'からです', meaning: 'starts from', pos: 'expression', furigana: [{ text: 'からです' }], vocab_match: null, kanji_matches: [] },
  ],
  explanation: 'から marks the starting point in time.',
}
// The tutor's review as routes/translation.py shapes it: a verdict, a
// line, what worked, what to fix, the corrected sentence -- and the
// same read out as text for an older client.
const REVIEW = {
  verdict: 'partial',
  summary: 'The obligation is right; the object particle is wrong.',
  good: ['「書かなければなりません」 expresses the obligation'],
  fix: [{ issue: '「名前が」 marks the subject', fix: '「名前を」' }],
  grammar_used: true,
  better: '毎日名前を書かなければなりません。',
}
const TUTOR = { review: REVIEW, analysis: 'The obligation is right; the object particle is wrong.' }
const PROSE_TUTOR = { review: null, analysis: 'Your sentence is natural; から is the right particle here.' }

const ok = body => ({ ok: true, status: 200, json: async () => body })
const settle = (ms = 60) => new Promise(r => setTimeout(r, ms))

const setValue = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
function type(el, value) {
  setValue.call(el, value)
  el.dispatchEvent(new Event('input', { bubbles: true }))
}

const calls = url => apiFetch.mock.calls.filter(c => String(c[0]) === url)

async function run() {
  const screen = await render(
    <LangProvider>
      <MemoryRouter initialEntries={['/practice/translation/level/N5']}>
        <Routes>
          <Route path="/practice/translation/level/:level" element={<TranslationRun session={null} />} />
        </Routes>
      </MemoryRouter>
    </LangProvider>
  )
  await settle(120)
  return screen.container
}

/** The phrase answered, on the feedback with the tutor's reading in. */
async function answered(root, text = '学校は九時からです。') {
  type(root.querySelector('input'), text)
  await settle(20)
  root.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
  await settle(140)
  return root
}

async function graded(root) {
  ;[...root.querySelectorAll('.rating-bar button')].at(-1).click()
  await settle(140)
  return root
}

const breakdownButton = root => [...root.querySelectorAll('.prose__breakdown button')][0]

beforeEach(() => {
  apiFetch.mockReset()
  apiFetch.mockImplementation(async url => {
    const u = String(url)
    if (u.startsWith('/api/translation/batch')) return ok({ phrases: PHRASES })
    if (u === '/api/translation/analyze') return ok(TUTOR)
    if (u === '/api/phrase/analyze') return ok(ANALYSIS)
    return ok({})
  })
})

describe('TranslationRun', () => {
  it('asks for the breakdown of the reference the moment the prompt is up', async () => {
    await run()
    const analyze = calls('/api/phrase/analyze')
    expect(analyze).toHaveLength(1)
    const body = JSON.parse(analyze[0][2].body)
    expect(body.phrase).toBe(PHRASES[0].phrase)
    // Out of the analyzer's own history, and the deep tier, exactly as
    // reading practice asks for it.
    expect(body.save).toBe(false)
    expect(body.deep).toBe(true)
    // And nothing has been submitted yet: the tutor has not been asked.
    expect(calls('/api/translation/analyze')).toHaveLength(0)
  })

  it("draws the tutor's review at a glance: the verdict, what worked, what to fix, the corrected sentence", async () => {
    const root = await answered(await run())
    const review = root.querySelector('.rvw')
    expect(review).toBeTruthy()
    expect(review.querySelector('.rvw__verdict').textContent).toBe('En partie')
    expect(review.querySelector('.rvw__verdict').classList.contains('rvw__verdict--partial')).toBe(true)
    expect(review.querySelector('.rvw__summary').textContent).toBe(REVIEW.summary)
    expect(review.querySelectorAll('.rvw__mark--ok')).toHaveLength(1)
    expect(review.querySelectorAll('.rvw__mark--x')).toHaveLength(1)
    const rows = review.querySelectorAll('.rvw__row')
    expect(rows[0].querySelector('.rvw__item').textContent).toBe(REVIEW.good[0])
    expect(rows[1].querySelector('.rvw__item').textContent).toBe(REVIEW.fix[0].issue)
    expect(rows[1].querySelector('.rvw__fix').textContent).toBe(REVIEW.fix[0].fix)
    expect(review.querySelector('.rvw__better').textContent).toBe(REVIEW.better)
    // The paragraph is gone: the shape is the review.
    expect(root.querySelector('.prose__ai')).toBeNull()
    // No grammar point on this phrase, so no used/not-used badge.
    expect(review.querySelectorAll('.type-badge')).toHaveLength(1)
  })

  it('prints the prose when the model did not answer in the shape', async () => {
    apiFetch.mockImplementation(async url => {
      const u = String(url)
      if (u.startsWith('/api/translation/batch')) return ok({ phrases: PHRASES })
      if (u === '/api/translation/analyze') return ok(PROSE_TUTOR)
      if (u === '/api/phrase/analyze') return ok(ANALYSIS)
      return ok({})
    })
    const root = await answered(await run())
    expect(root.querySelector('.rvw')).toBeNull()
    expect(root.querySelector('.prose__ai').textContent).toBe(PROSE_TUTOR.analysis)
  })

  it('offers no breakdown until the learner has graded themselves', async () => {
    const root = await answered(await run())
    expect(root.querySelector('.rvw')).toBeTruthy()
    expect(root.querySelector('.prose__breakdown')).toBeNull()

    await graded(root)
    expect(root.querySelector('.prose__breakdown')).toBeTruthy()
    expect(breakdownButton(root).disabled).toBe(false)
    expect(breakdownButton(root).textContent).toContain('Voir la décomposition')
  })

  it("opens the rows, puts the prompt and the reference away, and keeps the tutor's reading", async () => {
    const root = await graded(await answered(await run()))
    breakdownButton(root).click()
    await settle(80)

    expect(root.querySelector('.bkd')).toBeTruthy()
    expect(root.querySelector('.bkd-line').textContent).toContain('学校')
    expect(root.querySelector('.bkd__en').textContent).toBe(PHRASES[0].translation)
    expect(root.querySelectorAll('.bkd-row')).toHaveLength(4)
    // The reference's romaji register is put away; the sentence is the
    // breakdown's own line now.
    expect(root.querySelector('.prose__romaji')).toBeNull()
    // The tutor's review of the attempt stays: it is the mode's point.
    expect(root.querySelector('.rvw__summary').textContent).toBe(REVIEW.summary)
    // And so does the learner's own answer.
    expect(root.textContent).toContain('学校は九時からです。')

    breakdownButton(root).click()
    await settle(80)
    expect(root.querySelector('.bkd')).toBeNull()
    expect(root.querySelector('.prose__romaji')).toBeTruthy()
  })

  it('a word in the rows opens its entry', async () => {
    const root = await graded(await answered(await run()))
    breakdownButton(root).click()
    await settle(80)
    root.querySelector('.bkd-row .bkd-tok--door').click()
    await settle(80)
    expect(document.querySelector('.word-detail')).toBeTruthy()
    expect(document.body.textContent).toContain('school')
  })

  it('starts the next phrase with its own breakdown on the way and none of the last', async () => {
    const root = await graded(await answered(await run()))
    breakdownButton(root).click()
    await settle(80)
    expect(root.querySelector('.bkd')).toBeTruthy()

    const nextBtn = [...root.querySelectorAll('button')].find(b => b.textContent.includes('Phrase suivante'))
    nextBtn.click()
    await settle(120)

    expect(root.querySelector('.bkd')).toBeNull()
    expect(root.querySelector('.prose__breakdown')).toBeNull()
    const analyze = calls('/api/phrase/analyze')
    expect(analyze).toHaveLength(2)
    expect(JSON.parse(analyze[1][2].body).phrase).toBe(PHRASES[1].phrase)
  })
})
