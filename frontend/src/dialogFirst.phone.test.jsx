import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { LangProvider } from './LangContext'
import './index.css'

// ── A key pressed in a dialog belongs to the dialog (plan 123) ─────
// The dictionary's page keys (/, Esc) and the analyser's walk (←/→,
// ↑/↓) asked no dialog. With the deck picker open over an entry, one
// Esc closed the picker AND the entry under it (Android's Back is the
// same Esc); "/" pulled the focus out of an open dialog into the search
// field behind it; and the picker's own ↑/↓ walked the Passage behind
// it. Nor did either ask for a chord, so Alt+← -- the browser's Back --
// moved a token instead. Plan 115 gave the run keys this guard.

const tok = (surface, kanji, kana, meaning) => ({
  surface, pos: kanji ? 'noun' : 'particle', furigana: [{ text: surface }], kanji_matches: [],
  vocab_match: kanji ? { entry: { kanji, kana, meaning }, stats: { status: 'learning' }, level: 'N5', raw_id: `vocab_N5_${kanji}_${kana}` } : null,
})
const PASSAGE = [{
  text: '駅で待つ', grammar: [], unknown_count: 0, available: true, level: 'N5', off_deck_count: 0,
  tokens: [tok('駅', '駅', 'えき', 'station'), tok('で'), tok('待つ', '待つ', 'まつ', 'to wait')],
}]
const entry = (kanji, kana, meaning) => ({ type: 'vocab', kanji, kana, meaning, level: 'N5', senses: [], examples: [], status: { status: 'new' } })
const ROWS = [entry('駅', 'えき', 'station'), entry('電車', 'でんしゃ', 'train'), entry('切符', 'きっぷ', 'ticket')]

const ok = body => ({ ok: true, status: 200, json: async () => body })
vi.mock('./lib/api', () => ({
  api: p => p,
  apiJson: vi.fn(async () => ({ sentences: PASSAGE, truncated: 0 })),
  apiFetch: vi.fn(async url => {
    const u = String(url)
    if (u.startsWith('/api/dictionary/radicals')) return ok({ groups: [] })
    if (u.startsWith('/api/dictionary?')) return ok({ results: ROWS, total: ROWS.length, has_more: false })
    return ok([])
  }),
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

const { default: DictionaryScreen } = await import('./screens/DictionaryScreen')
const { default: AnalyzerScreen } = await import('./screens/AnalyzerScreen')

const settle = (ms = 150) => new Promise(r => setTimeout(r, ms))
const $ = s => document.querySelector(s)
const press = (key, init = {}) => {
  const e = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init })
  window.dispatchEvent(e)
  return e
}
let dialog = null
function openDialog() {
  dialog = document.createElement('div')
  dialog.setAttribute('role', 'dialog')
  dialog.setAttribute('aria-modal', 'true')
  document.body.appendChild(dialog)
}
function closeDialog() { dialog?.remove(); dialog = null }
afterEach(closeDialog)

async function mount(path) {
  await render(
    <LangProvider>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/dictionary" element={<DictionaryScreen session={{}} />} />
          <Route path="/dictionary/analyzer" element={<AnalyzerScreen session={{}} />} />
        </Routes>
      </MemoryRouter>
    </LangProvider>
  )
  await settle(300)
}

describe('the dictionary under a dialog', () => {
  beforeEach(() => closeDialog())

  it('leaves Esc and "/" to the dialog, and closes the entry only once it has gone', async () => {
    await mount('/dictionary')
    document.querySelector('.dict-entry-card').click()
    await settle()
    expect($('.dict-dock')).not.toBeNull()

    openDialog()
    press('Escape')
    press('/')
    await settle()
    // The picker (here, any modal) took the key; the entry stays open,
    // and the focus did not leave the dialog for the search field.
    expect($('.dict-dock')).not.toBeNull()
    expect(document.activeElement?.matches('input')).toBe(false)

    closeDialog()
    press('Escape')
    await settle()
    expect($('.dict-dock')).toBeNull()
  })
})

describe('the analyser under a dialog', () => {
  function type(el, text) {
    Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), 'value').set.call(el, text)
    el.dispatchEvent(new Event('input', { bubbles: true }))
  }
  const surface = () => $('.token-card__surface')?.textContent

  it('walks no token behind a dialog, nor on a browser chord', async () => {
    await mount('/dictionary/analyzer')
    type($('textarea'), '駅で待つ')
    $('.anl-action').click()
    await settle(300)
    expect(surface()).toBe('駅')

    openDialog()
    press('ArrowRight')
    press('ArrowDown')
    await settle()
    expect(surface()).toBe('駅')
    closeDialog()

    const back = press('ArrowRight', { altKey: true })
    await settle()
    expect(back.defaultPrevented).toBe(false)
    expect(surface()).toBe('駅')

    press('ArrowRight')
    await settle()
    expect(surface()).toBe('で')
  })
})
