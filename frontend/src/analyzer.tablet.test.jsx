import { describe, it, expect, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { userEvent } from 'vitest/browser'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { LangProvider } from './LangContext'
import './index.css'

// ── The analyser's result is ringless at every width (plan 123) ────
// The result region is a focus target, not a tab stop: the arrival
// effect focuses it so the arrival is announced, and ←/→ walk the
// tokens with that focus held. The rule that keeps it ringless had been
// lost and lived only in the desk's block, so on a tablet with a
// keyboard the first arrow drew the browser's ring round the whole
// rail and stage. The tablet lane is 768×1024, below the desk.

const tok = (surface, kanji, kana, meaning) => ({
  surface, pos: kanji ? 'noun' : 'particle', furigana: [{ text: surface }], kanji_matches: [],
  vocab_match: kanji ? { entry: { kanji, kana, meaning }, stats: { status: 'learning' }, level: 'N5', raw_id: `vocab_N5_${kanji}_${kana}` } : null,
})
const PASSAGE = [{
  text: '駅で待つ', grammar: [], unknown_count: 0, available: true, level: 'N5', off_deck_count: 0,
  tokens: [tok('駅', '駅', 'えき', 'station'), tok('で'), tok('待つ', '待つ', 'まつ', 'to wait')],
}]

vi.mock('./lib/api', () => ({
  api: p => p,
  apiJson: vi.fn(async () => ({ sentences: PASSAGE, truncated: 0 })),
  apiFetch: vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ results: [], total: 0, has_more: false }) })),
  apiUpload: vi.fn(), apiJsonWithTimeout: vi.fn(),
  ApiError: class ApiError extends Error {},
}))
vi.mock('./components/analysis/useMining', async o => ({
  ...(await o()),
  useMining: () => ({ decks: [], mineApp: vi.fn(), mineCloze: vi.fn() }),
}))
vi.mock('./components/video/VideoPlayer', () => ({ VideoPlayer: () => <div /> }))
vi.mock('./lib/audio', async o => ({ ...(await o()), playUi: vi.fn(), playClick: vi.fn(), speakJapanese: vi.fn() }))
globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })

const { default: AnalyzerScreen } = await import('./screens/AnalyzerScreen')

const settle = (ms = 150) => new Promise(r => setTimeout(r, ms))
function type(el, text) {
  Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), 'value').set.call(el, text)
  el.dispatchEvent(new Event('input', { bubbles: true }))
}

describe('the analyser on a tablet with a keyboard', () => {
  it('draws no ring round the result while the arrows walk it', async () => {
    await render(
      <LangProvider>
        <MemoryRouter initialEntries={['/dictionary/analyzer']}>
          <Routes>
            <Route path="/dictionary/analyzer" element={<AnalyzerScreen session={{}} />} />
          </Routes>
        </MemoryRouter>
      </LangProvider>
    )
    await settle(60)
    type(document.querySelector('textarea'), '駅で待つ')
    document.querySelector('.anl-action').click()
    await settle(300)
    const results = document.querySelector('.anl-results')
    expect(document.activeElement).toBe(results)
    // A real key press, so the browser takes the keyboard's modality.
    await userEvent.keyboard('{ArrowRight}')
    await settle()
    expect(results.matches(':focus-visible')).toBe(true)
    expect(getComputedStyle(results).outlineStyle).toBe('none')
  })
})
