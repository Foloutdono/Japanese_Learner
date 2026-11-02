import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { LangProvider } from './LangContext'
import './index.css'

// ── Reading comprehension on the phone (plan 115's other side) ─────
// The desk stands the text beside the questions and the breakdown
// beside the results (comprehension.desktop). At 390 the two still take
// turns on the card: Re-read is there, the breakdown is behind its
// toggle, and nothing of the desk is drawn. The keys answer at every
// width, as a run's keys do; the phone prints none.

const apiFetch = vi.fn()
vi.mock('./lib/api', () => ({
  api: p => p,
  apiFetch: (...a) => apiFetch(...a),
  apiJson: vi.fn(), apiJsonWithTimeout: vi.fn(), apiUpload: vi.fn(),
  ApiError: class extends Error {},
}))
vi.mock('./lib/audio', async o => ({ ...(await o()), playUi: () => {}, playClick: () => {}, startAmbiance: () => {}, stopAmbiance: () => {} }))
globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })

const { default: ComprehensionRun } = await import('./screens/ComprehensionRun')

const deck = (kanji, kana, meaning) => ({ level: 'N5', raw_id: `vocab_N5_${kanji}_${kana}`, entry: { kanji, kana, meaning }, stats: { status: 'learning' } })
const tok = (surface, reading, match) => ({ surface, reading, pos: match ? 'noun' : 'particle', furigana: [{ text: surface, reading }], vocab_match: match, kanji_matches: [] })
const EXERCISE = {
  text: '駅で友達を待ちました。電車は遅れました。',
  translation: 'I waited for a friend at the station. The train was late.',
  breakdown: [
    { jp: '駅で友達を待ちました。', translation: 'I waited for a friend at the station.', note: '', analysis: { text: '駅で友達を待ちました。', available: true, grammar: [], tokens: [tok('駅', 'えき', deck('駅', 'えき', 'station')), tok('で', 'で'), tok('友達', 'ともだち', deck('友達', 'ともだち', 'friend'))] } },
    { jp: '電車は遅れました。', translation: 'The train was late.', note: '', analysis: { text: '電車は遅れました。', available: true, grammar: [], tokens: [tok('電車', 'でんしゃ', deck('電車', 'でんしゃ', 'train')), tok('は', 'は')] } },
  ],
  grammar_points: [],
  read_seconds: 60,
  questions: [
    { type: 'comprehension', question: 'Where did they wait?', options: ['At home', 'At the station', 'At school', 'At work'], correct: 1 },
    { type: 'vocabulary', question: 'What does 「電車」 mean?', options: ['friend', 'car', 'train', 'bus'], correct: 2 },
  ],
}
const RESULT = {
  score: 1, total: 2,
  results: [
    { question: EXERCISE.questions[0].question, options: EXERCISE.questions[0].options, correct: 1, user_answer: 1, is_correct: true },
    { question: EXERCISE.questions[1].question, options: EXERCISE.questions[1].options, correct: 2, user_answer: 0, is_correct: false },
  ],
}
const ENTRY = { type: 'vocab', kanji: '駅', kana: 'えき', meaning: 'station', level: 'N5', senses: [], examples: [], status: { status: 'new' } }
const ok = body => ({ ok: true, status: 200, json: async () => body })

beforeEach(() => {
  apiFetch.mockReset()
  apiFetch.mockImplementation(async url => {
    const u = String(url)
    if (u.startsWith('/api/reading/comprehension/result')) return ok(RESULT)
    if (u.startsWith('/api/reading/comprehension')) return ok(EXERCISE)
    if (u.startsWith('/api/dictionary?')) return ok({ results: [ENTRY], total: 1 })
    return ok({})
  })
})

const settle = (ms = 80) => new Promise(r => setTimeout(r, ms))
const $ = s => document.querySelector(s)
const $$ = s => [...document.querySelectorAll(s)]
const press = (key, target = window) => target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }))

async function mount() {
  await render(
    <LangProvider>
      <MemoryRouter initialEntries={['/practice/comprehension/N5']}>
        <Routes><Route path="/practice/comprehension/:level" element={<ComprehensionRun session={{ access_token: 'tok' }} />} /></Routes>
      </MemoryRouter>
    </LangProvider>
  )
  await settle(150)
}

describe('comprehension on the phone', () => {
  it('keeps Re-read, the toggle, and prints no keys', async () => {
    await mount()
    $('.stage__foot .btn-primary').click()
    await settle()
    expect($('.desk-run__side')).toBeNull()
    expect($$('.stage__foot button')).toHaveLength(2)
    expect($('.stage [aria-keyshortcuts]')).toBeNull()
    expect($('.desk-kbd')).toBeNull()

    press('a'); await settle(40); press('Enter'); await settle(40)
    press('a'); await settle(40); press('Enter'); await settle(250)
    expect($('.btn-secondary[aria-expanded]')).not.toBeNull()
    expect($('.bkd-passage__item')).toBeNull()
    expect(document.querySelector('[class*="desk-"]')).toBeNull()
  })

  // Plan 298: what the desk's breakdown opens beside a question, the
  // phone opens under it -- the line of the text it quotes, over its
  // translation -- and Show breakdown lands on that sentence.
  it('opens a question on the line of the text it quotes', async () => {
    await mount()
    $('.stage__foot .btn-primary').click()
    await settle()
    press('a'); await settle(40); press('Enter'); await settle(40)
    press('a'); await settle(40); press('Enter'); await settle(250)

    const rows = $$('.qrow')
    // Q1 quotes nothing: its options, and no line.
    rows[0].click(); await settle()
    expect($('.qrow__detail')).not.toBeNull()
    expect($('.qrow__source')).toBeNull()
    // Q2 quotes 「電車」, which is in the second sentence alone.
    rows[1].click(); await settle()
    const source = $('.qrow__source')
    expect(source).not.toBeNull()
    expect(source.textContent).toContain('電車')
    expect(source.textContent).toContain('The train was late.')
    expect(source.textContent).not.toContain('駅')
    // Under the options, before the asking.
    const detail = $('.qrow__detail')
    expect(detail.querySelector('.mcq-list').compareDocumentPosition(source) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()

    // Its words open their entries, as the breakdown's do.
    source.querySelector('.bkd-tok--door').click(); await settle(150)
    expect(apiFetch.mock.calls.some(([u]) => String(u).startsWith('/api/dictionary?'))).toBe(true)
    document.querySelector('[role="dialog"] button[aria-label]')?.click()
    await settle()

    $('.btn-secondary[aria-expanded]').click(); await settle()
    const items = $$('.bkd-passage__item')
    expect(items).toHaveLength(2)
    expect(items[1].classList.contains('bkd-passage__item--open')).toBe(true)
    expect(items[0].classList.contains('bkd-passage__item--open')).toBe(false)
  })

  // Plan 298b: the review opens on the first miss, as the desk's does;
  // a question names the sentence its right option rests on (`at`), and
  // a miss says why in one line.
  const answerAll = async () => {
    $('.stage__foot .btn-primary').click()
    await settle()
    press('a'); await settle(40); press('Enter'); await settle(40)
    press('a'); await settle(40); press('Enter'); await settle(250)
  }
  const serve = (exercise, result) => apiFetch.mockImplementation(async url => {
    const u = String(url)
    if (u.startsWith('/api/reading/comprehension/result')) return ok(result)
    if (u.startsWith('/api/reading/comprehension')) return ok(exercise)
    return ok({})
  })

  it('opens the results on the first miss', async () => {
    await mount()
    await answerAll()
    const rows = $$('.qrow')
    expect(rows.map(r => r.getAttribute('aria-expanded'))).toEqual(['false', 'true'])
    expect($('.qrow__source').textContent).toContain('The train was late.')
  })

  it('opens nothing on a paper with no miss', async () => {
    serve(EXERCISE, { ...RESULT, score: 2, results: RESULT.results.map(r => ({ ...r, user_answer: r.correct, is_correct: true })) })
    await mount()
    await answerAll()
    expect($$('.qrow[aria-expanded="true"]')).toHaveLength(0)
    expect($('.qrow__detail')).toBeNull()
  })

  it('opens a miss on the sentence it names and the line on why', async () => {
    const WHY = 'They met 「駅で」: at the station, before the train.'
    const exercise = {
      ...EXERCISE,
      questions: [
        { ...EXERCISE.questions[0], at: [0], why: WHY },
        { ...EXERCISE.questions[1], at: [1], why: 'A right answer is not explained.' },
      ],
    }
    const result = {
      score: 1, total: 2,
      results: [
        { question: exercise.questions[0].question, options: exercise.questions[0].options, correct: 1, user_answer: 0, is_correct: false },
        { question: exercise.questions[1].question, options: exercise.questions[1].options, correct: 2, user_answer: 2, is_correct: true },
      ],
    }
    serve(exercise, result)
    await mount()
    await answerAll()
    // Q1 quotes nothing; its `at` names the first sentence.
    expect($$('.qrow')[0].getAttribute('aria-expanded')).toBe('true')
    const detail = $('.qrow__detail')
    expect(detail.querySelector('.comp-why').textContent).toBe(WHY)
    expect(detail.querySelector('.qrow__source').textContent).toContain('I waited for a friend at the station.')
    // The why under the options, the sentence under the why.
    const why = detail.querySelector('.comp-why')
    expect(detail.querySelector('.mcq-list').compareDocumentPosition(why) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(why.compareDocumentPosition(detail.querySelector('.qrow__source')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    // A right answer opens on its sentence, with no why.
    $$('.qrow')[1].click(); await settle()
    expect($('.qrow__detail .comp-why')).toBeNull()
    expect($('.qrow__source').textContent).toContain('The train was late.')
  })

  it('opens a question on every sentence it names', async () => {
    const exercise = { ...EXERCISE, questions: [{ ...EXERCISE.questions[0], at: [0, 1], why: 'Both lines together.' }, EXERCISE.questions[1]] }
    serve(exercise, { ...RESULT, results: [{ ...RESULT.results[0], user_answer: 0, is_correct: false }, RESULT.results[1]] })
    await mount()
    await answerAll()
    expect($$('.qrow__source')).toHaveLength(2)
  })

  it('says a text handed back past the day’s ceiling was read before', async () => {
    apiFetch.mockImplementation(async url => {
      const u = String(url)
      if (u.startsWith('/api/reading/comprehension/result')) return ok(RESULT)
      if (u.startsWith('/api/reading/comprehension')) return ok({ ...EXERCISE, repeat: true })
      return ok({})
    })
    await mount()
    // The lane's browser may be French: either table's words.
    expect($('.stage__where-latin').textContent).toMatch(/^N5 · (Read before|Déjà lu)$/)
    $('.stage__foot .btn-primary').click()
    await settle()
    expect($('.stage__where-latin').textContent).not.toMatch(/Read before|Déjà lu/)
  })

  it('says nothing of the kind over a new text', async () => {
    await mount()
    expect($('.stage__where-latin').textContent).toBe('N5')
  })
})
