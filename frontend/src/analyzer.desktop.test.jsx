import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom'
import { LangProvider } from './LangContext'
import './index.css'

// ── 机 — the analyser and the dictionary at a desk (plan 114) ──────
// On a phone a word pressed in a breakdown opens a sheet over the
// stage. On the desk the result's second column is the dictionary: a
// one-sentence Passage has it open from the start on the token the
// stage shows, ←/→ walk the sentence and the entry walks with it, and
// a door pressed on a longer Passage takes the route map's column until
// Esc gives it back. The way back to the intake is a crumb; the intake
// stands beside its history; Ctrl+Enter analyses. And the dictionary,
// finding no entry for a sentence typed into it, offers to take it to
// the analyser, which analyses it on arrival. The phone's side is
// deskfree.phone.

const tok = (surface, kanji, kana, meaning) => ({
  surface, pos: kanji ? 'noun' : 'particle', furigana: [{ text: surface }], kanji_matches: [],
  vocab_match: kanji ? { entry: { kanji, kana, meaning }, stats: { status: 'learning' }, level: 'N5', raw_id: `vocab_N5_${kanji}_${kana}` } : null,
})
const ONE = [{
  text: '駅で待つ', grammar: [], unknown_count: 0, available: true, level: 'N5', off_deck_count: 0,
  tokens: [tok('駅', '駅', 'えき', 'station'), tok('で'), tok('待つ', '待つ', 'まつ', 'to wait')],
}]
const TWO = [ONE[0], { ...ONE[0], text: '電車に乗る', tokens: [tok('電車', '電車', 'でんしゃ', 'train'), tok('に'), tok('乗る', '乗る', 'のる', 'to ride')] }]
let passage = ONE
const entry = (kanji, kana, meaning) => ({ type: 'vocab', kanji, kana, meaning, level: 'N5', senses: [], examples: [], status: { status: 'new' } })
const ENTRIES = { 駅: entry('駅', 'えき', 'station'), 待つ: entry('待つ', 'まつ', 'to wait'), 電車: entry('電車', 'でんしゃ', 'train') }

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
  useMining: () => ({ decks: [], mineApp: vi.fn(), mineCloze: vi.fn() }),
}))
vi.mock('./components/video/VideoPlayer', () => ({ VideoPlayer: () => <div /> }))
vi.mock('./lib/audio', async o => ({ ...(await o()), playUi: vi.fn(), playClick: vi.fn(), speakJapanese: vi.fn() }))
globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })

const ok = body => ({ ok: true, status: 200, json: async () => body })
beforeEach(() => {
  passage = ONE
  apiJson.mockReset()
  apiJson.mockImplementation(async () => ({ sentences: passage, truncated: 0 }))
  apiFetch.mockReset()
  apiFetch.mockImplementation(async url => {
    const u = String(url)
    if (u.startsWith('/api/dictionary?')) {
      const q = new URLSearchParams(u.split('?')[1]).get('q')
      return ok({ results: ENTRIES[q] ? [ENTRIES[q]] : [], total: ENTRIES[q] ? 1 : 0, has_more: false })
    }
    if (u.startsWith('/api/dictionary/radicals')) return ok({ groups: [] })
    return ok([])
  })
})

const { default: AnalyzerScreen } = await import('./screens/AnalyzerScreen')
const { default: DictionaryScreen } = await import('./screens/DictionaryScreen')

const settle = (ms = 150) => new Promise(r => setTimeout(r, ms))
const press = (key, init = {}) => window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init }))
const $ = s => document.querySelector(s)
const $$ = s => [...document.querySelectorAll(s)]
const seen = { path: null, state: null }
function Probe() {
  const loc = useLocation()
  seen.path = loc.pathname
  seen.state = loc.state
  return null
}

function type(el, text) {
  Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), 'value').set.call(el, text)
  el.dispatchEvent(new Event('input', { bubbles: true }))
}

async function mount(entryPoint = '/dictionary/analyzer') {
  await render(
    <LangProvider>
      <MemoryRouter initialEntries={[entryPoint]}>
        <div className="phone phone--desk">
          <div className="phone__content">
            <Routes>
              <Route path="/dictionary/analyzer" element={<AnalyzerScreen session={{}} />} />
              <Route path="/dictionary" element={<DictionaryScreen session={{}} />} />
            </Routes>
          </div>
        </div>
        <Probe />
      </MemoryRouter>
    </LangProvider>
  )
  await settle(60)
}
async function analyze(text = '駅で待つ') {
  type($('textarea'), text)
  $('.anl-action').click()
  await settle(300)
}
const docked = () => $('.desk-anl-dock .desk-entry .dict-plate__word')?.textContent

describe('the analyser on the desk', () => {
  it('stands the intake beside its history, and analyses on Ctrl+Enter', async () => {
    await mount()
    const main = $('.desk-intake__main').getBoundingClientRect()
    const side = $('.desk-intake > .desk-side').getBoundingClientRect()
    expect(side.left).toBeGreaterThan(main.right)
    expect($('.desk-intake > .desk-side .anl-history')).not.toBeNull()
    expect($('.anl-action .desk-kbd')).not.toBeNull()
    type($('textarea'), '駅で待つ')
    $('textarea').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true, bubbles: true, cancelable: true }))
    await settle(300)
    expect(apiJson).toHaveBeenCalled()
    expect($('.anl-results')).not.toBeNull()
  })

  it('opens a one-sentence Passage beside its dictionary, the entry following ←/→', async () => {
    await mount()
    await analyze()
    expect(docked()).toBe('駅')
    expect($('[role="dialog"]')).toBeNull()
    expect($('.anl-kbd')).toBeNull()
    expect($('.desk-anl-dock__keys .desk-kbd')).not.toBeNull()
    // The way back to the intake is a crumb over the head.
    expect($('.desk-crumb .stage__leave')).not.toBeNull()
    expect($('.anl-head .stage__leave')).toBeNull()
    const stage = $('.anl-stage').getBoundingClientRect()
    const dock = $('.desk-anl-dock').getBoundingClientRect()
    expect(dock.left).toBeGreaterThan(stage.right - 1)
    expect(Math.round(dock.width)).toBe(360)

    press('ArrowRight')
    await settle()
    // A particle has no entry, and the dock says so rather than holding 駅.
    expect(docked()).toBeUndefined()
    expect($('.desk-anl-dock .hint')).not.toBeNull()
    press('ArrowRight')
    await settle()
    expect(docked()).toBe('待つ')
  })

  it('opens a door on a longer Passage in the route map\'s column, and Esc gives it back', async () => {
    passage = TWO
    await mount()
    await analyze('駅で待つ。電車に乗る。')
    expect($('.desk-anl-dock')).toBeNull()
    expect($('.anl-railcol').hidden).toBe(false)

    $('.token-card__surface--door').click()
    await settle()
    expect($('[role="dialog"]')).toBeNull()
    expect(docked()).toBe('駅')
    expect($('.anl-railcol').hidden).toBe(true)
    expect(getComputedStyle($('.anl-railcol')).display).toBe('none')
    // The stepper prints the keys that walk the Passage.
    expect($$('.anl-stepper__btn .desk-kbd').map(k => k.textContent)).toEqual(['↑', '↓'])

    // ↓ walks to the next stop; the dock follows its first token.
    press('ArrowDown')
    await settle()
    expect(docked()).toBe('電車')

    press('Escape')
    await settle()
    expect($('.desk-anl-dock')).toBeNull()
    expect($('.anl-railcol').hidden).toBe(false)
  })

  it('clears a docked door when a new Passage arrives', async () => {
    passage = TWO
    await mount()
    await analyze('駅で待つ。電車に乗る。')
    $('.token-card__surface--door').click()
    await settle()
    expect($('.desk-anl-dock')).not.toBeNull()
    $('.desk-crumb .stage__leave').click()
    await settle(60)
    await analyze('駅で待つ。電車に乗る。')
    expect($('.desk-anl-dock')).toBeNull()
  })
})

describe('the dictionary, on a sentence it has no entry for', () => {
  it('offers the analyser, which analyses it on arrival', async () => {
    await mount('/dictionary')
    type($('.dictionary input:not([type]), .dictionary input[type="text"], .dictionary input[type="search"]'), '駅で待つ')
    await settle(700)
    const offer = $('.empty__action')
    expect(offer).not.toBeNull()
    apiJson.mockClear()
    offer.click()
    await settle(400)
    expect(seen.path).toBe('/dictionary/analyzer')
    const analyses = apiJson.mock.calls.filter(([u]) => String(u).startsWith('/api/phrase/analyze'))
    expect(analyses).toHaveLength(1)
    expect(JSON.stringify(analyses[0])).toContain('駅で待つ')
    expect($('.anl-results')).not.toBeNull()
    // Spent: a reload or a Back does not analyse it again.
    expect(seen.state).toBeNull()
  })

  it('offers nothing for a single character or a Latin word', async () => {
    await mount('/dictionary')
    const field = $('.dictionary input:not([type]), .dictionary input[type="text"], .dictionary input[type="search"]')
    type(field, '猫')
    await settle(700)
    expect($('.empty__action')).toBeNull()
    type(field, 'train station')
    await settle(700)
    expect($('.empty__action')).toBeNull()
  })
})
