import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { LangProvider } from './LangContext'
import './index.css'

// ── 机 — reading comprehension as a workspace (plan 114) ───────────
// On a phone the text and its questions take turns: checking a detail
// is Re-read, then Back to the questions. On the desk the text stands
// beside the questions, whole, the way a paper prints them on one page;
// A–D (or 1–4) pick and Enter commits, with no pointer at all; and the
// result's breakdown stands open beside the rows it explains, a missed
// question opening the sentence it quotes. The phone's side is
// comprehension.phone.

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

async function toQuestions() {
  await mount()
  // One tick of the clock first: Enter does not end the reading on the
  // frame the train door is skipped on.
  await settle(1100)
  press('Enter')
  await settle()
}

describe('comprehension on the desk', () => {
  it('stands the text whole beside the questions, with no Re-read', async () => {
    await toQuestions()
    const side = $('.desk-run__side')
    expect(side).not.toBeNull()
    expect(side.getBoundingClientRect().width).toBe(360)
    const passage = side.querySelector('.prose__jp--passage')
    expect(passage.textContent).toBe(EXERCISE.text)
    const card = side.querySelector('.prompt-card')
    expect(card.scrollHeight).toBeLessThanOrEqual(card.clientHeight + 1)
    expect($$('.stage__foot button').map(b => b.className)).toEqual(['btn-primary'])
    // The question and the text are both in view.
    const q = $('.prompt-card--ask').getBoundingClientRect()
    const p = passage.getBoundingClientRect()
    expect(q.top).toBeLessThan(window.innerHeight)
    expect(p.top).toBeLessThan(window.innerHeight)
  })

  it('answers a whole paper from the keyboard', async () => {
    await toQuestions()
    expect($('.mcq-row').getAttribute('aria-keyshortcuts')).toBe('A 1')
    expect($('.stage__foot .btn-primary .desk-kbd')).not.toBeNull()
    press('b')
    await settle(40)
    expect($$('.mcq-row')[1].getAttribute('aria-pressed')).toBe('true')
    press('Enter')
    await settle()
    press('1')
    await settle(40)
    press('Enter')
    await settle(200)
    const post = apiFetch.mock.calls.find(([u]) => String(u).startsWith('/api/reading/comprehension/result'))
    expect(JSON.parse(post[2].body).answers).toEqual([1, 0])
  })

  it('stands the breakdown beside the results, a miss opening its sentence, a word in the column', async () => {
    await toQuestions()
    press('a'); await settle(40); press('Enter'); await settle(40)
    press('a'); await settle(40); press('Enter'); await settle(250)
    expect($('.desk-run__side .bkd-passage__item')).not.toBeNull()
    expect($$('.desk-run__side .bkd-passage__item')).toHaveLength(2)
    expect($('.btn-secondary[aria-expanded]')).toBeNull()
    expect($('.stage > .qrows').getBoundingClientRect().width).toBe(640)

    // The missed question quotes 「電車」: its sentence opens.
    $$('.qrow')[1].click()
    await settle()
    const open = $('.desk-run__side .bkd-passage__item--open')
    expect(open.textContent).toContain('The train was late.')

    // A word in the breakdown opens in the column, not a dialog.
    $('.desk-run__side .bkd-passage__item--open .bkd-tok--door, .desk-run__side .bkd-passage__item--open button.bkd-row').click()
    await settle(150)
    expect($('[role="dialog"]')).toBeNull()
    expect($('.desk-run__side .desk-entry')).not.toBeNull()
  })
})
