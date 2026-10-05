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
// The word a row opens, as the dictionary serves it (plan 096).
const VOCAB_ENTRY = {
  type: 'vocab', kanji: '学校', kana: 'がっこう', meaning: 'school', level: 'N5',
  furigana: [{ text: '学校', reading: 'がっこう' }], kanji_parts: [], examples: [],
  app_card: { source: 'vocab', level: 'N5', raw_id: 'vocab_N5_学校_がっこう' },
  senses: [{ number: 1, glossary: 'school', tags: [] }],
  status: { status: 'not_started', total_reviews: 0, correct_reviews: 0, accuracy: null, interval_days: null, next_review: null, due: false },
}
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
  apiFetch.mockImplementation(async (url, _session, init) => {
    const u = String(url)
    if (u.startsWith('/api/translation/batch')) return ok({ phrases: PHRASES })
    if (u === '/api/translation/analyze') return ok(TUTOR)
    // The local tier for the eager fetch; the explanation only once
    // bought (deep: true) -- plan 095, owner-directed.
    if (u === '/api/phrase/analyze') return ok(JSON.parse(init.body).deep ? ANALYSIS : { ...ANALYSIS, explanation: '' })
    if (u.startsWith('/api/dictionary?')) return ok({ results: [VOCAB_ENTRY], total: 1, has_more: false })
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
    // Out of the analyzer's own history, and the local tier only: the
    // explanation is bought on demand, exactly as reading practice.
    expect(body.save).toBe(false)
    expect(body.deep).toBe(false)
    // And nothing has been submitted yet: the tutor has not been asked.
    expect(calls('/api/translation/analyze')).toHaveLength(0)
  })

  it("draws the tutor's review at a glance: the verdict at the answer, the fix numbered and led by what to write, what worked", async () => {
    const root = await answered(await run())
    // The verdict stands at the end of the answer's well (plan 185).
    // This answer is not the tutor's line corrected (it kept none of
    // it), so the well holds it as typed: no corrected line under it.
    const well = root.querySelector('.pcard-well')
    expect(well.querySelector('.rvw__verdict').textContent).toBe('En partie')
    expect(well.querySelector('.rvw__verdict').classList.contains('rvw__verdict--partial')).toBe(true)
    expect(well.querySelector('.pcard-answer').textContent).toBe('学校は九時からです。')
    expect(well.querySelector('.pcard-over')).toBeNull()
    // The notes: the summary, the fix numbered, leading with what to
    // write and the reason under it (A1.4), what worked as one line.
    const review = root.querySelector('.rvw')
    expect(review.querySelector('.rvw__verdict')).toBeNull()
    expect(review.querySelector('.rvw__summary').textContent).toBe(REVIEW.summary)
    const fix = review.querySelector('.rvw__fixes > .rvw__row')
    expect(fix.querySelector('.rvw__to').textContent).toBe(REVIEW.fix[0].fix)
    expect(fix.querySelector('.rvw__why').textContent).toBe(REVIEW.fix[0].issue)
    expect([...review.querySelectorAll('.rvw__good')].map(g => g.textContent)).toEqual(REVIEW.good)
    // The paragraph is gone: the shape is the review.
    expect(root.querySelector('.prose__ai')).toBeNull()
    // No grammar point on this phrase, so no tag to say it was used.
    expect(root.querySelector('.pcard-tag')).toBeNull()
    // The fix quotes nothing the reference holds: no number on it.
    expect(root.querySelector('.pcard-lead .pcard-pin')).toBeNull()
  })

  it('corrects a Japanese answer in place and numbers the fix on the reference\'s words (A1.1, A1.3)', async () => {
    const review = {
      verdict: 'partial',
      summary: 'One particle.',
      good: [],
      fix: [{ issue: '「学校が」 makes the school the subject', fix: '「学校は」' }],
      grammar_used: null,
      better: '学校は九時からです。',
      better_parts: [
        { text: '学校', reading: 'がっこう' }, { text: 'は', highlight: true },
        { text: '九時', reading: 'くじ' }, { text: 'からです。' },
      ],
    }
    apiFetch.mockImplementation(async url => {
      const u = String(url)
      if (u.startsWith('/api/translation/batch')) return ok({ phrases: PHRASES })
      if (u === '/api/translation/analyze') return ok({ review, analysis: review.summary })
      if (u === '/api/phrase/analyze') return ok(ANALYSIS)
      return ok({})
    })
    const root = await answered(await run(), '学校が九時からです。')
    const over = root.querySelector('.pcard-well .pcard-over')
    expect(over.querySelector('s').textContent).toBe('が')
    expect(over.querySelector('rt').textContent).toBe('は')
    // On the reference: the words the fix is about underlined, its
    // number after them.
    const lead = root.querySelector('.pcard-lead__jp')
    expect(lead.querySelector('.pcard-hit').textContent).toBe('学校は')
    expect(lead.querySelector('.pcard-pin').textContent).toBe('1')
    expect(root.querySelector('.rvw__row .rvw__n').textContent).toBe('1')
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

  it('buys the explanation of the reference when asked, under the rows', async () => {
    const root = await graded(await answered(await run()))
    breakdownButton(root).click()
    await settle(80)
    expect(root.querySelector('.bkd .prose__ai')).toBeNull()
    root.querySelector('.bkd__explain button').click()
    await settle(120)
    expect(calls('/api/phrase/analyze').map(c => JSON.parse(c[2].body).deep)).toEqual([false, true])
    expect(root.querySelector('.bkd .prose__ai').textContent).toBe(ANALYSIS.explanation)
  })

  it("opens the rows, puts the prompt and the reference away, and keeps the tutor's reading", async () => {
    const root = await graded(await answered(await run()))
    breakdownButton(root).click()
    await settle(80)

    expect(root.querySelector('.bkd')).toBeTruthy()
    expect(root.querySelector('.bkd-line').textContent).toContain('学校')
    expect(root.querySelector('.bkd__en').textContent).toBe(PHRASES[0].translation)
    // A row per word; the particles are their cards' (plan 160).
    expect(root.querySelectorAll('.bkd-row')).toHaveLength(2)
    // The reference is put away; the sentence is the breakdown's own
    // line now.
    expect(root.querySelector('.pcard-lead')).toBeNull()
    // The tutor's review of the attempt stays: it is the mode's point.
    expect(root.querySelector('.rvw__summary').textContent).toBe(REVIEW.summary)
    // And so does the learner's own answer, in its well.
    expect(root.querySelector('.pcard-well').textContent).toContain('学校は九時からです。')

    breakdownButton(root).click()
    await settle(80)
    expect(root.querySelector('.bkd')).toBeNull()
    expect(root.querySelector('.pcard-lead')).toBeTruthy()
  })

  // Plan 096: the row -- not the word in it -- is the door, and what
  // it opens is the DICTIONARY plate, asked for the deck entry's own
  // kanji and kana.
  it('a word row opens its dictionary entry', async () => {
    const root = await graded(await answered(await run()))
    breakdownButton(root).click()
    await settle(80)
    const row = root.querySelector('.bkd-row')
    expect(row.tagName).toBe('BUTTON')
    // Pressed anywhere on it -- here on the gloss, which used to be
    // dead text beside the only live pixel on the row.
    row.querySelector('.bkd-row__meaning').click()
    await settle(150)
    const lookup = apiFetch.mock.calls.map(c => String(c[0])).find(u => u.startsWith('/api/dictionary?'))
    expect(lookup).toBeTruthy()
    const q = new URLSearchParams(lookup.split('?')[1])
    expect(q.get('category')).toBe('vocab')
    expect(q.get('q')).toBe('学校')
    expect(q.get('kana')).toBe('がっこう')
    expect(document.querySelector('.dict-sheet[role="dialog"]')).toBeTruthy()
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
