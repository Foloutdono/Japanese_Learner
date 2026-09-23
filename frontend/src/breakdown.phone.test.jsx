import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { LangProvider } from './LangContext'
import './index.css'

// ── A graded sentence's doors, on the phone (plan 114's other side) ──
// The desk opens a breakdown's word inside its side column
// (breakdown.desktop). At 390 there is no column: the breakdown is
// behind its toggle on the card, and a word opens the dictionary in a
// sheet, exactly as before.

const apiFetch = vi.fn()
vi.mock('./lib/api', () => ({
  api: p => p,
  apiFetch: (...a) => apiFetch(...a),
  apiJson: vi.fn(), apiJsonWithTimeout: vi.fn(), apiUpload: vi.fn(),
  ApiError: class extends Error {},
}))
vi.mock('./lib/audio', async o => ({
  ...(await o()),
  playUi: () => {}, playClick: () => {}, playSfx: () => {}, playCorrect: () => {}, playWrong: () => {},
  startAmbiance: () => {}, stopAmbiance: () => {},
}))
globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })

const { default: ReadingRun } = await import('./screens/ReadingRun')

const PHRASE = {
  phrase: '学校は九時からです。', romaji: 'gakkou wa kuji kara desu',
  translation: 'School starts at nine.', translation_lang: 'en', display_seconds: 30,
}
const word = (surface, reading, kanji, kana, meaning) => ({
  surface, reading, pos: 'noun', furigana: [{ text: surface, reading }], kanji_matches: [],
  vocab_match: { level: 'N5', raw_id: `vocab_N5_${kanji}_${kana}`, entry: { word: kanji, kanji, kana, meaning }, stats: { status: 'learning' } },
})
const ANALYSIS = {
  text: PHRASE.phrase, level: 'N5', unknown_count: 0, off_deck_count: 0, grammar: [],
  tokens: [
    word('学校', 'がっこう', '学校', 'がっこう', 'school'),
    { surface: 'は', reading: 'は', pos: 'particle', furigana: [{ text: 'は' }], vocab_match: null, kanji_matches: [] },
    word('九時', 'くじ', '九時', 'くじ', 'nine o\'clock'),
  ],
}
const ENTRY = term => ({ type: 'vocab', kanji: term, kana: term === '学校' ? 'がっこう' : 'くじ', meaning: term, level: 'N5', status: { status: 'new' }, senses: [], examples: [] })
const res = body => ({ ok: true, status: 200, json: async () => body })

beforeEach(() => {
  apiFetch.mockReset()
  apiFetch.mockImplementation(path => {
    if (path.startsWith('/api/reading/batch')) return Promise.resolve(res({ phrases: [PHRASE, { ...PHRASE }] }))
    if (path === '/api/phrase/analyze') return Promise.resolve(res(ANALYSIS))
    if (path.startsWith('/api/dictionary?')) {
      const q = new URLSearchParams(path.split('?')[1]).get('q')
      return Promise.resolve(res({ results: [ENTRY(q)] }))
    }
    return Promise.resolve(res({}))
  })
})

const settle = (ms = 80) => new Promise(r => setTimeout(r, ms))
const $ = s => document.querySelector(s)
const setValue = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set

async function graded() {
  await render(
    <LangProvider>
      <MemoryRouter initialEntries={['/practice/reading/level/N5']}>
        <Routes><Route path="/practice/reading/level/:level" element={<ReadingRun session={null} />} /></Routes>
      </MemoryRouter>
    </LangProvider>
  )
  await settle(150)
  setValue.call($('form input'), 'gakkou wa kuji desu')
  $('form input').dispatchEvent(new Event('input', { bubbles: true }))
  await settle(20)
  $('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
  await settle(80)
  const seals = document.querySelectorAll('.rating-bar__btn')
  seals[seals.length - 1].click()
  await settle(150)
}

describe('a graded sentence on the phone', () => {
  it('keeps the toggle, and a word opens the sheet', async () => {
    await graded()
    expect($('.desk-run__side')).toBeNull()
    const toggle = $('.prose__breakdown button')
    expect(toggle).not.toBeNull()
    toggle.click()
    await settle(80)
    $('.stage button.bkd-row').click()
    await settle(150)
    expect($('.dict-sheet[role="dialog"]')).not.toBeNull()
    expect(document.querySelector('[class*="desk-"]')).toBeNull()
  })
})
