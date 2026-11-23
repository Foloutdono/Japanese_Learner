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

  it('corrects a Japanese answer in place and numbers the fix on the learner\'s own words (A1.1, plan 330)', async () => {
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
    // The number stands on what the learner wrote, in the well, and the
    // reference is left clean (plan 330, pick C): a mistake is marked
    // where it was made.
    expect(root.querySelector('.pcard-well .pcard-pin').textContent).toBe('1')
    const lead = root.querySelector('.pcard-lead__jp')
    expect(lead.querySelector('.pcard-hit')).toBeNull()
    expect(lead.querySelector('.pcard-pin')).toBeNull()
    expect(root.querySelector('.rvw__row .rvw__n').textContent).toBe('1')
  })

  // ── The weighed review, on the learner's own line (plan 330, pick C) ──
  // The answer typed in romaji is read as the kana it spells (the server's
  // `answer_kana`), and that line is what the review marks: a wrong form
  // struck with the right one over it, a word that was right but less
  // natural in the near ink, a word left out at a caret. The letters are
  // never marked, nor remarked on; they stay under the line, quiet.
  const WEIGHED = {
    verdict: 'partial',
    summary: 'Compris, mais la forme du verbe est fausse.',
    good: [],
    fix: [
      { given: 'のんでした', fix: 'のみました', issue: '«でした» ne suit pas un verbe.', severity: 'error' },
      { given: 'だけを', fix: 'だけ', issue: '«を» est facultatif après 「だけ」.', severity: 'natural' },
      { given: '', fix: 'は', issue: '«は» pose «hier» en thème.', severity: 'natural' },
    ],
    grammar_used: true,
    better: 'きのうはみずだけのみました。',
    better_parts: [{ text: 'きのうはみずだけのみました' }],
  }
  const KANA = 'きのうみずだけをのんでした'
  const ROMAJI = 'kinou mizudakewonondeshita'
  const detail = {
    what: 'Tu as mis «でした» après 飲んで.',
    rule: [{ label: 'Verbe', text: '飲む → 飲みます → 飲みました' }],
    examples: [{ jp: 'コーヒーを飲みました。', tr: 'J’ai bu du café.' }],
    memo: 'Verbe → ます, ました.',
  }

  function weighedApi() {
    apiFetch.mockImplementation(async (url, _session, init) => {
      const u = String(url)
      if (u.startsWith('/api/translation/batch')) return ok({ phrases: PHRASES })
      if (u === '/api/translation/analyze') return ok({ review: WEIGHED, analysis: WEIGHED.summary, answer_kana: KANA })
      if (u === '/api/phrase/analyze') return ok(ANALYSIS)
      if (u === '/api/ask') return ok({ answer: detail.what, detail, off_topic: false, left: 39, _sent: JSON.parse(init.body) })
      return ok({})
    })
  }

  it('marks a romaji answer as the kana it spells, by weight, and leaves the letters and the reference alone', async () => {
    weighedApi()
    const root = await answered(await run(), ROMAJI)
    const well = root.querySelector('.pcard-well')
    // The marks stand on the kana line: left to right 3, 2, 1.
    const pins = [...well.querySelectorAll('.pcard-pin')]
    expect(pins.map(p => p.textContent)).toEqual(['3', '2', '1'])
    expect(pins.map(p => p.classList.contains('pcard-pin--near'))).toEqual([true, true, false])
    // The error: the wrong form struck, the right one small over it.
    const over = well.querySelector('.pcard-over:not(.pcard-miss--near)')
    expect(over.querySelector('s').textContent).toBe('んで')
    expect(over.querySelector('rt').textContent).toBe('みま')
    // A word that was right (を after だけ) is underlined, never struck;
    // a word left out is written over a caret.
    expect(well.querySelector('.pcard-del--near').textContent).toBe('を')
    expect(well.querySelector('.pcard-over--add rt').textContent).toBe('は')
    // What was typed stays under the line, quiet, and is never marked.
    expect(well.querySelector('.pcard-well__typed').textContent).toBe(ROMAJI)
    // The reference is clean, and romaji is not remarked on.
    expect(root.querySelector('.pcard-lead .pcard-pin')).toBeNull()
    expect(root.querySelector('.pcard-lead .pcard-hit')).toBeNull()
    expect(root.textContent.toLowerCase()).not.toContain('romaji')
  })

  it('leads with the error as a card of its own, the natural ones as a line each', async () => {
    weighedApi()
    const root = await answered(await run(), ROMAJI)
    const big = root.querySelectorAll('.rvw-big')
    expect(big).toHaveLength(1)
    expect(big[0].querySelector('.rvw__n').textContent).toBe('1')
    expect(big[0].querySelector('.rvw__tag').textContent).toBe('À corriger')
    expect(big[0].querySelector('.rvw-chg__was').textContent).toBe('のんでした')
    expect(big[0].querySelector('.rvw-chg__to').textContent).toBe('のみました')
    const soft = [...root.querySelectorAll('.rvw-soft')]
    expect(soft.map(r => r.querySelector('.rvw__n').textContent)).toEqual(['2', '3'])
    expect(soft[1].querySelector('.rvw-chg__to').textContent).toBe('+ は')
    // Each has its Détail.
    expect(root.querySelectorAll('.rvw-btn')).toHaveLength(3)
  })

  it('a Détail asks the asking about that mistake alone, and answers in parts in its page', async () => {
    weighedApi()
    const root = await answered(await run(), ROMAJI)
    root.querySelector('.rvw-big .rvw-btn').click()
    await settle(160)
    const [, , init] = calls('/api/ask')[0]
    const sent = JSON.parse(init.body)
    expect(sent.mode).toBe('translation')
    expect(sent.explain).toEqual({
      given: 'のんでした', fix: 'のみました', issue: '«でした» ne suit pas un verbe.', severity: 'error',
    })
    // (French sets a non-breaking space before the colon: frenchSpacing.)
    expect(sent.question.replace(/\s/g, ' ')).toBe('Explique-moi le point 1 : «のんでした» → «のみました»')
    // The question carries the Japanese the romaji spells, not the letters.
    expect(sent.answer).toBe(KANA)
    // The phone's asking page rises over the run with the detail, in parts.
    const page = document.querySelector('.ask-layer')
    expect(page.querySelector('.ask__a .ask-detail .ask-detail__what').textContent).toBe(detail.what)
    expect(page.querySelector('.ask-detail__rule dd').textContent).toBe('飲む → 飲みます → 飲みました')
    expect(page.querySelector('.ask-detail__memo').textContent).toBe(detail.memo)
    // The button says it was asked, and does not ask twice.
    const button = root.querySelector('.rvw-big .rvw-btn')
    expect(button.textContent).toContain('Dans le chat')
    expect(button.disabled).toBe(true)
  })

  it('a Détail that failed can be asked again', async () => {
    apiFetch.mockImplementation(async (url) => {
      const u = String(url)
      if (u.startsWith('/api/translation/batch')) return ok({ phrases: PHRASES })
      if (u === '/api/translation/analyze') return ok({ review: WEIGHED, analysis: WEIGHED.summary, answer_kana: KANA })
      if (u === '/api/phrase/analyze') return ok(ANALYSIS)
      if (u === '/api/ask') return { ok: false, status: 503, json: async () => ({}) }
      return ok({})
    })
    const root = await answered(await run(), ROMAJI)
    root.querySelector('.rvw-big .rvw-btn').click()
    await settle(160)
    expect(root.querySelector('.rvw-big .rvw-btn').disabled).toBe(false)
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
