import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { LangProvider } from '../LangContext'
import { TrainDoor } from '../components/station/TrainDoor'

// ── Comprehension: the station, then the stage (plan 072) ───────
// The level list on the station page, then the whole exercise on the
// stage: the text under the timer, one question at a time with lettered
// rows and a Next that commits the pick, and the result as a lattice of
// records over a surface of rows that say what was picked and what was
// right. Two routes now, as the lines have had since plan 071 — the
// list is a station page under the chrome and the exercise is the run —
// so the flow is mounted through the router that joins them, with the
// API mocked at its boundary.

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
  startAmbiance: () => {},
  stopAmbiance: () => {},
}))
vi.mock('../stores/stats', () => ({ useStats: () => ({ data: null, failed: false }), refreshStats: vi.fn(), seedStats: vi.fn() }))
globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })

const { default: ComprehensionRun } = await import('./ComprehensionRun')
const { default: SentenceStation } = await import('./SentenceStation')

// The first sentence's analysis, as reading.py serves it (plan 084):
// the analyzer's local tier with the model's glosses folded on. 待ち /
// まし / た is one word to the model and three morphemes to the
// tokenizer -- the gloss sits on the first with the run's extent.
const deck = (kanji, kana, meaning, status = 'not_started') => ({
  level: 'N5', raw_id: `vocab_N5_${kanji}_${kana}`, entry: { kanji, kana, meaning }, stats: { status },
})
const ANALYSIS_1 = {
  text: '駅で友達を待ちました。', available: true, level: 'N5', unknown_count: 2, off_deck_count: 0,
  grammar: [{ pattern: '〜ました／〜ませんでした', level: 'N5', raw_id: 'grammar_N5_〜ました／〜ませんでした', start: 6, end: 9, stats: { status: 'not_started' } }],
  tokens: [
    { surface: '駅', reading: 'えき', pos: 'noun', furigana: [{ text: '駅', reading: 'えき' }], meaning: 'station', vocab_match: deck('駅', 'えき', 'station'), kanji_matches: [] },
    { surface: 'で', reading: 'で', pos: 'particle', furigana: [{ text: 'で' }], meaning: 'at (place of action)', vocab_match: null, kanji_matches: [] },
    { surface: '友達', reading: 'ともだち', pos: 'noun', furigana: [{ text: '友', reading: 'とも' }, { text: '達', reading: 'だち' }], vocab_match: deck('友達', 'ともだち', 'friend', 'learning'), kanji_matches: [] },
    { surface: 'を', reading: 'を', pos: 'particle', furigana: [{ text: 'を' }], vocab_match: null, kanji_matches: [] },
    { surface: '待ち', reading: 'まち', pos: 'verb', furigana: [{ text: '待', reading: 'ま' }, { text: 'ち' }], meaning: 'waited for', span_end: 6, vocab_match: deck('待つ', 'まつ', 'to wait'), kanji_matches: [] },
    { surface: 'まし', reading: 'まし', pos: 'auxiliary', furigana: [{ text: 'まし' }], vocab_match: null, kanji_matches: [] },
    { surface: 'た', reading: 'た', pos: 'auxiliary', furigana: [{ text: 'た' }], vocab_match: null, kanji_matches: [] },
    { surface: '。', reading: '。', pos: 'symbol', furigana: [{ text: '。' }], vocab_match: null, kanji_matches: [] },
  ],
}
const EXERCISE = {
  text: '駅で友達を待ちました。電車は遅れました。',
  translation: 'I waited for a friend at the station. The train was late.',
  breakdown: [
    { jp: '駅で友達を待ちました。', translation: 'I waited for a friend at the station.', note: 'で marks where an action happens.', analysis: ANALYSIS_1 },
    // The second, as an older backend serves it: no analysis at all.
    { jp: '電車は遅れました。', translation: 'The train was late.', note: '' },
  ],
  grammar_points: [
    { pattern: '〜ました／〜ませんでした', structure: 'verb stem + ました', meaning: 'polite past', level: 'N5', raw_id: 'grammar_N5_〜ました／〜ませんでした' },
  ],
  read_seconds: 60,
  questions: [
    { type: 'comprehension', question: 'Where did they wait?', options: ['At home', 'At the station'], correct: 1 },
    { type: 'vocabulary', question: 'What does 友達 mean?', options: ['train', 'friend'], correct: 1 },
  ],
}
const RESULT = {
  score: 1, total: 2,
  results: [
    { question: EXERCISE.questions[0].question, options: EXERCISE.questions[0].options, correct: 1, user_answer: 1, is_correct: true },
    { question: EXERCISE.questions[1].question, options: EXERCISE.questions[1].options, correct: 1, user_answer: 0, is_correct: false },
  ],
}

const ok = body => ({ ok: true, status: 200, json: async () => body })
const settle = (ms = 80) => new Promise(r => setTimeout(r, ms))

function clickText(root, text) {
  const btn = [...root.querySelectorAll('button')].find(b => b.textContent.includes(text))
  expect(btn, `${text} — page: ${root.textContent.slice(0, 300)}`).toBeTruthy()
  btn.click()
}

/** Past the TrainDoor, which any pointerdown skips. */
async function through() {
  await settle(700)
  window.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
  await settle(300)
}

beforeEach(() => {
  apiFetch.mockReset()
  apiFetch.mockImplementation(async url => {
    if (String(url).startsWith('/api/reading/comprehension/result')) return ok(RESULT)
    if (String(url).startsWith('/api/reading/comprehension')) return ok(EXERCISE)
    return ok({})
  })
})

describe('ComprehensionRun', () => {
  it('reads, answers with Next, and prints the result lattice and rows', async () => {
    const screen = await render(
      <LangProvider>
        <MemoryRouter initialEntries={['/practice/comprehension']}>
          <Routes>
            <Route
              path="/practice/comprehension"
              element={<SentenceStation session={{ access_token: 'tok' }} base="/practice/comprehension" levelsOnly />}
            />
            <Route path="/practice/comprehension/:level" element={<ComprehensionRun session={{ access_token: 'tok' }} />} />
          </Routes>
          <TrainDoor />
        </MemoryRouter>
      </LangProvider>
    )
    await settle()
    const root = screen.container

    // The station page: one bar, the route diagram.
    expect(root.querySelectorAll('.bar')).toHaveLength(1)
    expect(root.querySelectorAll('.route-stop')).toHaveLength(5)
    clickText(root, 'N4')
    await through()

    // The text on the stage, under the timer; both bars have left.
    expect(root.querySelector('.stage__head')).toBeTruthy()
    expect(root.querySelector('.bar')).toBeNull()
    expect(root.querySelector('.timer__label')).toBeTruthy()
    expect(root.querySelector('.prose__jp--passage').textContent).toBe(EXERCISE.text)
    // The passage is read in its own bounded card: nothing beside the
    // way on, and no translation to answer the paper from.
    expect(root.querySelector('.prompt-card--passage')).toBeTruthy()
    expect(root.querySelector('.stage__foot .btn-secondary')).toBeNull()
    expect(root.textContent).not.toContain(EXERCISE.breakdown[0].translation)
    root.querySelector('.stage__foot .btn-primary').click()   // done reading
    await settle()

    // Question 1: lettered rows, Next waits for a pick.
    expect(root.querySelector('.today-remaining').textContent).toBe('1 / 2')
    const rows = root.querySelectorAll('.mcq-row')
    expect(rows).toHaveLength(2)
    expect(rows[0].querySelector('.mcq-row__index').textContent).toBe('A')
    expect(rows[1].querySelector('.mcq-row__index').textContent).toBe('B')
    const next = root.querySelector('.stage__foot .btn-primary')
    expect(next.disabled).toBe(true)
    rows[1].click()
    await settle()
    expect(root.querySelectorAll('.mcq-row--selected')).toHaveLength(1)
    expect(next.disabled).toBe(false)
    next.click()
    await settle()

    // Question 2, then the submit.
    expect(root.querySelector('.today-remaining').textContent).toBe('2 / 2')
    root.querySelectorAll('.mcq-row')[0].click()
    await settle()
    root.querySelector('.stage__foot .btn-primary').click()
    await settle(150)

    const post = apiFetch.mock.calls.find(c => String(c[0]).startsWith('/api/reading/comprehension/result'))
    expect(post, 'the answers were posted').toBeTruthy()
    expect(JSON.parse(post[2].body).answers).toEqual([1, 0])
    expect(JSON.parse(post[2].body).breakdown).toHaveLength(2)

    // The result: the lattice, one row per question, the missed one noted.
    const values = root.querySelectorAll('.result-lattice .record__value')
    expect(values).toHaveLength(2)
    expect(values[0].textContent).toBe('1/ 2')
    expect(values[1].textContent).toBe('50%')
    expect(root.querySelectorAll('.qrow')).toHaveLength(2)
    expect(root.querySelectorAll('.qrow__note')).toHaveLength(1)
    expect(root.querySelector('.qrow__note').textContent).toContain('A')
    expect(root.querySelector('.qrow__note').textContent).toContain('B')
    // A row opens on its question with the options marked.
    root.querySelectorAll('.qrow')[1].click()
    await settle()
    expect(root.querySelector('.qrow__detail .mcq-row--wrong')).toBeTruthy()
    expect(root.querySelector('.qrow__detail .mcq-row--correct')).toBeTruthy()
    expect(root.querySelector('.stage__foot .btn-primary').textContent).toBeTruthy()

    // And the passage, sentence by sentence, is what the result opens
    // onto: every sentence in order over its translation, the first
    // open on its words and its note (plan 084). Bought here, not
    // during the reading.
    expect(root.querySelector('.bkd-passage')).toBeNull()
    // By role, not by label: the lane's language is the machine's.
    root.querySelector('.btn-secondary[aria-expanded]').click()
    await settle()

    // The grammar the text was written around, captioned, over the
    // passage. (The open sentence carries its own chips under its rows
    // -- the same point, where it occurs -- so the row is read on its
    // own, not the page.)
    const seeded = root.querySelector('.analysis-grammar-chips')
    expect(seeded.querySelector('.cap').textContent).toBeTruthy()
    expect([...seeded.querySelectorAll('.analysis-grammar-chip__pattern')].map(el => el.textContent))
      .toEqual(EXERCISE.grammar_points.map(g => g.pattern))

    const items = root.querySelectorAll('.bkd-passage__item')
    expect(items).toHaveLength(2)
    // The first is open: the ruby line, one row per WORD (待ちました is
    // one row), the translation and the note.
    expect(items[0].classList.contains('bkd-passage__item--open')).toBe(true)
    expect(items[0].querySelector('.bkd-line').textContent).toContain('駅')
    expect([...items[0].querySelectorAll('.bkd-row__word')].map(el => el.textContent))
      .toEqual(['駅', 'で', '友達', 'を', '待ちました'])
    expect(items[0].querySelector('.bkd__en').textContent).toBe(EXERCISE.breakdown[0].translation)
    expect(items[0].querySelector('.prose__ai').textContent).toBe(EXERCISE.breakdown[0].note)
    // The second is closed -- its sentence over its translation -- and
    // with no analysis and nothing worth noting it has nothing to open
    // and no note line.
    expect(items[1].querySelector('.prose__jp').textContent).toBe(EXERCISE.breakdown[1].jp)
    expect(items[1].querySelector('.bkd__en').textContent).toBe(EXERCISE.breakdown[1].translation)
    expect(items[1].querySelector('.prose__ai')).toBeNull()
    expect(items[1].querySelector('.bkd-passage__chev')).toBeNull()

    // A word opens its entry as a sheet.
    items[0].querySelector('.bkd-row .bkd-tok--door').click()
    await settle()
    expect(document.querySelector('.word-detail')).toBeTruthy()
    expect(document.body.textContent).toContain('station')

    // What was posted back: the breakdown without its analyses, and
    // the points the text was written around.
    const posted = apiFetch.mock.calls.find(c => String(c[0]).startsWith('/api/reading/comprehension/result'))
    const body = JSON.parse(posted[2].body)
    expect(body.breakdown).toHaveLength(2)
    expect(body.breakdown[0].analysis).toBeUndefined()
    expect(body.breakdown[0].jp).toBe(EXERCISE.breakdown[0].jp)
    expect(body.grammar_points).toEqual(EXERCISE.grammar_points.map(g => g.pattern))
  })

  // The two halves deploy separately (Vercel and Render), so the
  // screen has to survive a backend that has not shipped the
  // breakdown yet: the toggle opens what it always opened rather than
  // an empty card.
  it('falls back to the whole text when the exercise carries no breakdown', async () => {
    const flat = { ...EXERCISE, breakdown: undefined, grammar_points: undefined }
    apiFetch.mockImplementation(async url => {
      if (String(url).startsWith('/api/reading/comprehension/result')) return ok(RESULT)
      if (String(url).startsWith('/api/reading/comprehension')) return ok(flat)
      return ok({})
    })

    const screen = await render(
      <LangProvider>
        <MemoryRouter initialEntries={['/practice/comprehension/N5']}>
          <Routes>
            <Route path="/practice/comprehension/:level" element={<ComprehensionRun session={{ access_token: 'tok' }} />} />
          </Routes>
        </MemoryRouter>
      </LangProvider>
    )
    await settle()
    const root = screen.container

    root.querySelector('.stage__foot .btn-primary').click()   // done reading
    await settle()
    for (let i = 0; i < EXERCISE.questions.length; i++) {
      root.querySelectorAll('.mcq-row')[0].click()
      await settle()
      root.querySelector('.stage__foot .btn-primary').click()
      await settle()
    }
    await settle(150)

    // By role, not by label: the lane's language is the machine's.
    root.querySelector('.btn-secondary[aria-expanded]').click()
    await settle()
    const items = root.querySelectorAll('.bkd-passage__item')
    expect(items).toHaveLength(1)
    expect(items[0].querySelector('.prose__jp').textContent).toBe(EXERCISE.text)
    expect(items[0].querySelector('.bkd__en').textContent).toBe(EXERCISE.translation)
    // Nothing to open, so no control that would open nothing.
    expect(items[0].querySelector('.bkd-passage__chev')).toBeNull()
    expect(root.querySelector('.analysis-grammar-chips')).toBeNull()
  })
})
