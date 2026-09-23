import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { LangProvider } from './LangContext'
import './index.css'

// ── Reading comprehension on the phone (plan 114's other side) ─────
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
})
