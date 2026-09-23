import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { LangProvider } from './LangContext'
import './index.css'

// ── 机 — a graded sentence's doors open beside it (plan 115) ──────
// On the desk a practice run stands its graded breakdown in the side
// column (plan 114). A word in it is a door to its dictionary entry,
// and that door used to open a dialog with a scrim over the sentence
// and the learner's answer. It opens IN the column now: the sentence's
// ruby line stays above the entry, another word is one click, and Esc
// brings the rows back. The column wears the run's own line colour.
// The phone keeps its sheet (breakdown.phone).

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

describe('a graded sentence on the desk', () => {
  it('wears the run\'s line in its column', async () => {
    await graded()
    const side = $('.desk-run__side')
    const want = getComputedStyle(document.documentElement).getPropertyValue('--line-reading').trim()
    expect(want).not.toBe('')
    expect(getComputedStyle(side).getPropertyValue('--line-color').trim()).toBe(want)
  })

  it('opens a word in the column, not a dialog, and Esc brings the rows back', async () => {
    await graded()
    const rows = $('.desk-run__side .bkd-rows')
    expect(rows).not.toBeNull()
    $('.desk-run__side button.bkd-row').click()
    await settle(150)
    expect($('[role="dialog"]')).toBeNull()
    expect($('.desk-run__side .desk-entry')).not.toBeNull()
    expect($('.desk-run__side .desk-entry').textContent).toContain('学校')
    // The sentence stays above the entry, every word still a door.
    expect($('.desk-run__side .bkd-line .bkd-tok--door')).not.toBeNull()

    // Another word: one click, the entry swaps.
    document.querySelectorAll('.desk-run__side .bkd-line .bkd-tok--door')[1].click()
    await settle(150)
    expect($('.desk-run__side .desk-entry').textContent).toContain('九時')
    expect($('[role="dialog"]')).toBeNull()

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))
    await settle(80)
    expect($('.desk-run__side .desk-entry')).toBeNull()
    expect(rows.isConnected).toBe(true)
    expect(rows.offsetParent).not.toBeNull()
  })
})
