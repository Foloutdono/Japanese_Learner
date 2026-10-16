import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { MemoryRouter } from 'react-router-dom'
import { LangProvider } from './LangContext'
import './index.css'

// ── 畳 on the short desk (plan 229, the owner's pick C) ─────────────
// A typed Passage's words folded to one line under the sumi give the
// stage the column, and at 1280×600 -- the board C-600 of the canvas
// "Tsuji analyser — text desk stage" -- a line as wide as one gets, its
// translation and Explain stand whole on it, at the short desk's sizes.
// Before the fold the stage held 178px of their 331.

const tok = (surface, kanji, kana, meaning) => ({
  surface, pos: kanji ? 'noun' : 'particle', furigana: [{ text: surface }], kanji_matches: [],
  vocab_match: kanji ? { entry: { kanji, kana, meaning }, stats: { status: 'new' }, level: 'N5', raw_id: `vocab_N5_${kanji}_${kana}` } : null,
})
const WIDE_LINE = {
  text: '昨日は雨が降っていたので、私は一日中家で', grammar: [], unknown_count: 5, available: true, level: 'N4', off_deck_count: 0,
  translation: 'Hier, comme il pleuvait, je suis resté toute la journée chez moi à',
  tokens: [
    tok('昨日', '昨日', 'きのう', 'yesterday'), tok('は'), tok('雨', '雨', 'あめ', 'rain'), tok('が'),
    tok('降っ', '降る', 'ふる', 'to fall'), tok('て'), tok('い'), tok('た'), tok('の'), tok('で'), tok('、'),
    tok('私', '私', 'わたし', 'I'), tok('は'), tok('一日中', '一日中', 'いちにちじゅう', 'all day'),
    tok('家', '家', 'いえ', 'home'), tok('で'),
  ],
}
const NEXT = { ...WIDE_LINE, text: '電車に乗る', translation: 'Je prends le train.', tokens: [tok('電車', '電車', 'でんしゃ', 'train'), tok('に'), tok('乗る', '乗る', 'のる', 'to ride')] }

const apiJson = vi.fn()
const apiFetch = vi.fn()
vi.mock('./lib/api', () => ({
  api: p => p,
  apiJson: (...a) => apiJson(...a),
  apiFetch: (...a) => apiFetch(...a),
  apiUpload: vi.fn(), apiJsonWithTimeout: vi.fn(),
  ApiError: class ApiError extends Error {},
}))
vi.mock('./components/analysis/useMining', async o => ({
  ...(await o()),
  useMining: () => ({ decks: [], mineApp: vi.fn(), mineCloze: vi.fn(), targetFor: () => null, decksFor: () => [], ensureDeck: vi.fn() }),
}))
vi.mock('./components/video/VideoPlayer', () => ({ VideoPlayer: () => <div /> }))
vi.mock('./lib/audio', async o => ({ ...(await o()), playUi: vi.fn(), playClick: vi.fn(), speakJapanese: vi.fn() }))
globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })

const ok = body => ({ ok: true, status: 200, json: async () => body })
beforeEach(() => {
  apiJson.mockReset()
  apiJson.mockImplementation(async () => ({ sentences: [WIDE_LINE, NEXT], truncated: 0 }))
  apiFetch.mockReset()
  apiFetch.mockImplementation(async url => (String(url).startsWith('/api/dictionary?')
    ? ok({ results: [], total: 0, has_more: false })
    : ok([])))
})

const { default: AnalyzerScreen } = await import('./screens/AnalyzerScreen')

const settle = (ms = 150) => new Promise(r => setTimeout(r, ms))
const $ = s => document.querySelector(s)
const box = s => $(s).getBoundingClientRect()

async function analyzeTyped() {
  await render(
    <LangProvider>
      <MemoryRouter initialEntries={['/dictionary/analyzer']}>
        <div className="phone phone--desk">
          <div className="phone__content">
            <AnalyzerScreen session={{}} />
          </div>
        </div>
      </MemoryRouter>
    </LangProvider>
  )
  await settle(60)
  const field = $('textarea')
  Object.getOwnPropertyDescriptor(Object.getPrototypeOf(field), 'value').set.call(field, '昨日は雨が降っていたので、私は一日中家で。電車に乗る。')
  field.dispatchEvent(new Event('input', { bubbles: true }))
  $('.anl-action').click()
  await expect.poll(() => $('.anl-subs__tr')?.textContent).toBe(WIDE_LINE.translation)
  await settle(300)
}

describe('a typed Passage on the short desk', () => {
  it('folds its words to one line, and the stage holds the line, its translation and Explain whole', async () => {
    await analyzeTyped()
    expect(window.innerHeight).toBe(600)
    const fold = box('.anl-fold')
    expect(fold.top).toBeGreaterThan(box('.anl-slab').bottom - 1)
    expect(fold.height).toBeLessThan(64)
    const stage = $('.anl-subs__stage')
    const bottom = stage.getBoundingClientRect().bottom
    expect(stage.scrollHeight).toBeLessThanOrEqual(stage.clientHeight + 1)
    expect(box('.anl-subs__tr').bottom).toBeLessThanOrEqual(bottom + 1)
    expect(box('.anl-subs__stage .anl-desk__explain').bottom).toBeLessThanOrEqual(bottom + 1)
    // The short desk's sizes, as before the fold.
    expect(parseFloat(getComputedStyle($('.anl-subs__line .tok')).fontSize)).toBeLessThanOrEqual(32)
    expect(document.scrollingElement.scrollHeight).toBeLessThanOrEqual(window.innerHeight + 1)
  })
})
