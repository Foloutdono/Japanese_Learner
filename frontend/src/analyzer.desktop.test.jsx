import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { userEvent } from 'vitest/browser'
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom'
import { LangProvider } from './LangContext'
import './index.css'

// ── 机 — the analyser and the dictionary at a desk (plans 115, 134) ──
// On a phone a word pressed in a breakdown opens a sheet over the
// stage. On the desk the result takes the window, the rail stepping
// aside, as three columns (plan 134): the sentences over the numbered
// grammar, the video with the sentence as its subtitle and the words
// beside the card in focus, and the card in focus in the runs' band --
// ←/→ walk the sentence and the entry walks with it, a grammar card
// puts its point in focus, and Explain stands the explanation in the
// description's place. A typed Passage has no video, and its sentence
// takes the video's place (plan 161): one sentence's words over its
// grammar on the left, several's under the sentence, the translation
// under the sentence once Explain has bought it. The intake stands beside its history;
// Ctrl+Enter analyses. And the dictionary,
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
// A sentence built with a particle's marker (を) and a construction:
// 〜ている written on て and いる -- listed after を, in the sentence's order.
const GRAMMAR = [{
  text: '雨を見ている', unknown_count: 0, available: true, level: 'N5', off_deck_count: 0,
  grammar: [{ kind: 'marker', raw_id: 'grammar_N5_wo', pattern: 'を', level: 'N5', meaning: 'object', start: 1, end: 2, segments: [[1, 2]] }, { kind: 'pattern', raw_id: 'grammar_N5_teiru', pattern: '〜ている', level: 'N5', meaning: 'ongoing', start: 3, end: 6, segments: [[3, 6]] }],
  tokens: [
    { ...tok('雨', '雨', 'あめ', 'rain'), start: 0, end: 1 },
    { ...tok('を'), start: 1, end: 2 },
    { ...tok('見', '見る', 'みる', 'to see'), start: 2, end: 3 },
    { ...tok('て'), start: 3, end: 4 },
    { ...tok('いる'), start: 4, end: 6 },
  ],
}]
const EXPLANATION = 'Devant la gare, j’attends.'
const TRANSLATION = 'J’attends à la gare.'
const TEIRU_ENTRY = { type: 'grammar', raw_id: 'grammar_N5_teiru', pattern: '〜ている', level: 'N5', meaning: 'ongoing', status: { status: 'new' } }
let passage = ONE
const entry = (kanji, kana, meaning) => ({ type: 'vocab', kanji, kana, meaning, level: 'N5', senses: [], examples: [], status: { status: 'new' } })
const ENTRIES = { 駅: entry('駅', 'えき', 'station'), 待つ: entry('待つ', 'まつ', 'to wait'), 電車: entry('電車', 'でんしゃ', 'train'), 雨: entry('雨', 'あめ', 'rain') }

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
  passage = ONE
  clearLookupCache()
  apiJson.mockReset()
  apiJson.mockImplementation(async (url, session, init) => (String(init?.body).includes('"deep":true')
    ? { sentences: [{ ...passage[0], explanation: EXPLANATION, translation: TRANSLATION }] }
    : { sentences: passage, truncated: 0 }))
  apiFetch.mockReset()
  apiFetch.mockImplementation(async url => {
    const u = String(url)
    if (u.startsWith('/api/dictionary?')) {
      const params = new URLSearchParams(u.split('?')[1])
      if (params.get('id') === 'grammar_N5_teiru') return ok({ results: [TEIRU_ENTRY], total: 1, has_more: false })
      const q = params.get('q')
      return ok({ results: ENTRIES[q] ? [ENTRIES[q]] : [], total: ENTRIES[q] ? 1 : 0, has_more: false })
    }
    if (u.startsWith('/api/dictionary/radicals')) return ok({ groups: [] })
    return ok([])
  })
})

const { default: AnalyzerScreen } = await import('./screens/AnalyzerScreen')
const { clearLookupCache } = await import('./lib/dictionaryLookup')
const { default: DictionaryScreen } = await import('./screens/DictionaryScreen')

const settle = (ms = 150) => new Promise(r => setTimeout(r, ms))
const press = (key, init = {}) => window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init }))
const $ = s => document.querySelector(s)
const $$ = s => [...document.querySelectorAll(s)]
const box = s => $(s).getBoundingClientRect()
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
const shown = () => $('.anl-desk__entry .dict-plate__word')?.textContent

describe('the analyser on the desk (plan 134)', () => {
  it('stands the intake beside the passages, and analyses on Ctrl+Enter', async () => {
    await mount()
    const main = $('.desk-intake__main').getBoundingClientRect()
    const side = $('.desk-intake > .desk-side').getBoundingClientRect()
    expect(side.left).toBeGreaterThan(main.right)
    // Plan 136 turned the page round: the passages are the page, the
    // intake the column beside them.
    expect($('.desk-intake__main .anl-shelf')).not.toBeNull()
    expect($('.desk-intake > .desk-side #anl-panel-text')).not.toBeNull()
    expect($('.anl-action .desk-kbd')).not.toBeNull()
    type($('textarea'), '駅で待つ')
    $('textarea').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true, bubbles: true, cancelable: true }))
    await settle(300)
    expect(apiJson).toHaveBeenCalled()
    expect($('.anl-desk')).not.toBeNull()
  })

  it('takes the window: the rail steps aside, the three columns side by side', async () => {
    passage = [GRAMMAR[0], ONE[0]]
    await mount()
    await analyze('雨を見ている。駅で待つ。')
    expect($('.anl-desk__rail')).not.toBeNull()
    expect(getComputedStyle($('.phone--desk')).paddingInlineStart).toBe('0px')
    const head = box('.anl-desk__head')
    const rail = box('.anl-desk__rail')
    const points = box('.anl-desk__points')
    const slab = box('.anl-slab')
    const words = box('.anl-desk__words')
    const right = box('.anl-desk__entry')
    expect(rail.right).toBeLessThanOrEqual(head.left)
    expect(head.right).toBeLessThanOrEqual(right.left)
    // Plan 161, several typed sentences (B): the Passage's line over the
    // grammar on the left, the words under the sentence in the middle,
    // and no card in focus beside them -- the entry is that card.
    expect(points.top).toBeGreaterThan(rail.bottom - 1)
    expect(words.top).toBeGreaterThan(slab.bottom - 1)
    expect(Math.abs(words.left - slab.left)).toBeLessThan(2)
    expect($('.anl-focus')).toBeNull()
    expect(document.scrollingElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth)
    expect(document.scrollingElement.scrollHeight).toBeLessThanOrEqual(window.innerHeight + 1)
  })

  it('opens on the card in focus in the runs\' band, the entry following ←/→', async () => {
    await mount()
    await analyze()
    expect(shown()).toBe('駅')
    expect($('.anl-desk__entry .dict-entry--band')).not.toBeNull()
    expect($('[role="dialog"]')).toBeNull()
    // No legend, no printed keys (owner-directed).
    expect($('.anl-legend, .anl-kbd, .anl-desk .desk-kbd')).toBeNull()
    // The way back is in the centre column's head, not a crumb over it.
    expect($('.anl-desk__head .stage__leave')).not.toBeNull()
    expect($('.desk-crumb')).toBeNull()
    // The word in focus is lit in the subtitle and in the words list.
    expect($('.anl-subs .tok--on').textContent).toContain('駅')
    expect($('.anl-words__row--on').textContent).toContain('駅')

    press('ArrowRight')
    await settle()
    // A particle has no entry, and the column says so rather than holding 駅.
    expect(shown()).toBeUndefined()
    expect($('.anl-desk__none')).not.toBeNull()
    press('ArrowRight')
    await settle()
    expect(shown()).toBe('待つ')
  })

  // The entry's ＋ opened its menu inside the band's top panel, whose
  // overflow rounds the stripe into its corners: the menu was cut to
  // its top edge, a sliver under the plate with no row to press. And
  // the analyser held no shelf, so the menu offered the deck alone.
  it('hangs the entry\'s ＋ menu whole under the band, the favourites beside the deck', async () => {
    ENTRIES.駅 = { ...entry('駅', 'えき', 'station'), app_card: { source: 'vocab', level: 'N5', raw_id: 'vocab_N5_駅_えき' } }
    try {
      await mount()
      await analyze()
      await expect.poll(shown).toBe('駅')
      const plus = $('.anl-desk__entry .dict-plate__add-btn')
      plus.click()
      await settle(30)
      const rows = $$('.dict-add-menu__row')
      expect(rows.map(r => r.getAttribute('role'))).toEqual(['menuitemcheckbox', 'menuitem'])
      // Every row stands where it is drawn and takes the press, past the
      // top panel's foot.
      for (const row of rows) {
        const r = row.getBoundingClientRect()
        expect(document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)?.closest('.dict-add-menu__row')).toBe(row)
      }
      const top = $('.anl-desk__entry .dict-entry__top').getBoundingClientRect()
      expect(rows.at(-1).getBoundingClientRect().bottom).toBeGreaterThan(top.bottom)
      // Hung from the ＋, flush with its trailing edge.
      const p = plus.getBoundingClientRect()
      const menu = $('.dict-add-menu').getBoundingClientRect()
      expect(Math.abs(menu.right - p.right)).toBeLessThan(1)
      expect(menu.top).toBeGreaterThanOrEqual(p.bottom)

      // Kept: the shelf's one write, and the ＋ wears the ring.
      rows[0].click()
      await expect.poll(() => apiJson.mock.calls.some(([u, , init]) => u === '/api/dictionary/favorites' && init?.method === 'PUT')).toBe(true)
      await expect.poll(() => plus.classList.contains('dict-plate__add-btn--kept')).toBe(true)

      // The deck's row: no deck is remembered, so the picker.
      await expect.poll(() => plus.disabled).toBe(false)
      plus.click()
      await settle(30)
      $$('.dict-add-menu__row')[1].click()
      await settle(60)
      expect($('.dict-add-menu')).toBeNull()
      expect($('[role="dialog"] .picker')).not.toBeNull()
    } finally {
      ENTRIES.駅 = entry('駅', 'えき', 'station')
    }
  })

  // Plan 161, one typed sentence (the owner's pick B′): the sentence in
  // the video's place, to the column's foot and at display size; its
  // words over its grammar on the left; every panel as tall as it holds.
  it('stands one typed sentence in the video\'s place, its words over its grammar on the left', async () => {
    passage = GRAMMAR
    await mount()
    await analyze('雨を見ている')
    await expect.poll(shown).toBe('雨')
    const desk = box('.anl-desk')
    const words = box('.anl-desk__words')
    const points = box('.anl-desk__points')
    const head = box('.anl-desk__head')
    const slab = box('.anl-slab')
    expect(Math.abs(words.top - head.top)).toBeLessThan(2)
    expect(words.right).toBeLessThanOrEqual(head.left)
    expect(points.top).toBeGreaterThan(words.bottom - 1)
    expect(slab.top).toBeGreaterThan(head.bottom - 1)
    expect(Math.abs(slab.bottom - desk.bottom)).toBeLessThan(2)
    // Larger than the video's subtitle (--fs-heading, 1.7rem).
    expect(parseFloat(getComputedStyle($('.anl-subs__line .tok')).fontSize)).toBeGreaterThan(28)
    // The sentence is printed below its title, which a screen reader keeps.
    expect($('.anl-desk__title').classList.contains('sr-only')).toBe(true)
    expect(box('.anl-head__keep').right).toBeGreaterThan(head.right - 2)
    // No panel drawn empty: the words, the grammar and the entry stop
    // where what they hold does.
    expect(words.height).toBeLessThan(200)
    expect(points.bottom).toBeLessThan(desk.bottom - 100)
    expect(box('.anl-desk__entry .dict-entry__body').bottom).toBeLessThan(desk.bottom - 100)
    expect($('.anl-focus')).toBeNull()
    expect(document.scrollingElement.scrollHeight).toBeLessThanOrEqual(window.innerHeight + 1)
  })

  it('lists the sentence\'s words, and puts one in focus from the list', async () => {
    await mount()
    await analyze()
    // The words, not the particles: those stay on the subtitle.
    expect($$('.anl-words__row .anl-words__word').map(w => w.textContent)).toEqual(['駅', '待つ'])
    // One sentence (plan 161, B′): its words over its grammar on the left.
    expect($('.anl-desk__side .anl-desk__words')).not.toBeNull()
    $$('.anl-words__row').at(-1).click()
    await settle()
    expect(shown()).toBe('待つ')
    expect($('.anl-words__row--on').textContent).toContain('待つ')
    // No card beside the list: the deck's action rides the word's row.
    expect($('.anl-focus')).toBeNull()
    expect($('.anl-words__item .anl-words__row--on').textContent).toContain('待つ')
    expect($('.anl-words__item .anl-words__add').textContent).toBe('Ajouter au deck')
  })

  it('draws no ring round the result while the arrows walk it', async () => {
    await mount()
    await analyze()
    const results = $('.anl-results')
    expect(document.activeElement).toBe(results)
    // A real key press, so the browser takes the keyboard's modality.
    await userEvent.keyboard('{ArrowRight}')
    await settle()
    expect(document.activeElement).toBe(results)
    expect(getComputedStyle(results).outlineStyle).toBe('none')
  })

  it('walks the sentences with ↓ and the arrows, the entry following', async () => {
    passage = TWO
    await mount()
    await analyze('駅で待つ。電車に乗る。')
    $$('.anl-words__row').at(-1).click()
    // The entry is fetched: waited for rather than read after a fixed
    // pause, which a slow CI runner outlasted (the plate still empty).
    await expect.poll(shown).toBe('待つ')

    // ↓ walks to the next sentence; the entry follows its first token.
    press('ArrowDown')
    await expect.poll(shown).toBe('電車')
    expect($('.anl-subs__count').textContent).toContain('2 / 2')

    // The subtitle's arrows walk back.
    $$('.anl-slab__arrow')[0].click()
    await expect.poll(() => $('.anl-subs__count').textContent).toContain('1 / 2')
  })

  it('stands the explanation in the description\'s place, and swaps back', async () => {
    await mount()
    await analyze()
    expect($('.anl-swap')).toBeNull()
    // On a typed sentence, Explain stands under it on the sumi (plan 161).
    expect($('.anl-slab .anl-desk__explain').textContent).toContain('Expliquer la phrase')
    expect($('.anl-subs__tr')).toBeNull()
    $('.anl-desk__explain').click()
    await settle(300)
    expect(apiJson.mock.calls.some(([, , init]) => String(init?.body).includes('"deep":true'))).toBe(true)
    expect($('.anl-explainpanel__body').textContent).toBe(EXPLANATION)
    // The translation under the sentence, as its subtitle.
    expect($('.anl-slab .anl-subs__tr').textContent).toBe(TRANSLATION)
    expect(box('.anl-subs__tr').top).toBeGreaterThan(box('.anl-subs__line').bottom - 1)
    expect(box('.anl-desk__explain').top).toBeGreaterThan(box('.anl-subs__tr').bottom - 1)
    expect($('.anl-desk__explain').getAttribute('aria-pressed')).toBe('true')
    // The card's head stays over it; its description gives way.
    expect(shown()).toBe('駅')
    expect(getComputedStyle($('.anl-desk__entry .dict-entry__body')).display).toBe('none')

    $('.anl-swap').click()
    await settle()
    expect($('.anl-explainpanel')).toBeNull()
    expect(getComputedStyle($('.anl-desk__entry .dict-entry__body')).display).not.toBe('none')
    // Bought, the translation stays with the sentence.
    expect($('.anl-subs__tr').textContent).toBe(TRANSLATION)
    // Bought once: the button goes back to it without a second call.
    const calls = apiJson.mock.calls.length
    $('.anl-desk__explain').click()
    await settle()
    expect($('.anl-explainpanel')).not.toBeNull()
    expect(apiJson.mock.calls.length).toBe(calls)
    press('Escape')
    await settle()
    expect($('.anl-explainpanel')).toBeNull()
  })

  it('numbers every point, the particles too, on its card and on the words it sits on, and puts it in focus', async () => {
    passage = GRAMMAR
    await mount()
    await analyze('雨を見ている')
    // The particle's marker and the construction, in the sentence's order.
    expect($$('.anl-desk__points .anl-num').map(n => n.textContent)).toEqual(['1', '2'])
    expect($$('.anl-desk__points .bkd-point__pattern').map(n => n.textContent)).toEqual(['を', '〜ている'])
    const frames = $$('.anl-subs__pt')
    expect(frames.map(f => f.querySelector('.anl-subs__n').textContent)).toEqual(['1', '2'])
    expect([...frames[0].querySelectorAll('.tok__word')].map(w => w.textContent)).toEqual(['を'])
    expect([...frames[1].querySelectorAll('.tok__word')].map(w => w.textContent)).toEqual(['て', 'いる'])

    $$('.anl-desk__points .bkd-point')[1].click()
    await settle()
    // The point is the card in focus: its words lit on the subtitle, its
    // card beside the list, its entry on the right.
    expect($$('.anl-subs .tok--lit').map(tk => tk.querySelector('.tok__word').textContent)).toEqual(['て', 'いる'])
    expect($('.anl-words__row--on')).toBeNull()
    expect($('.anl-words__item')).toBeNull()
    expect(shown()).toBe('〜ている')
  })

  it('keeps a long sentence\'s grammar inside the window, scrolling in its box', async () => {
    const [wo, teiru] = GRAMMAR[0].grammar
    const more = Array.from({ length: 12 }, (_, i) => ({ ...teiru, raw_id: `grammar_N5_x${i}`, pattern: `〜ている${i}`, meaning: 'an action going on, and a gloss long enough to take two lines' }))
    passage = [{ ...GRAMMAR[0], grammar: [wo, teiru, ...more] }]
    await mount()
    await analyze('雨を見ている')
    // One sentence: no list, the grammar under the sentence's words.
    expect($('.anl-desk__rail')).toBeNull()
    const points = $('.anl-desk__points')
    expect(points.getBoundingClientRect().top).toBeGreaterThan(box('.anl-desk__words').bottom - 1)
    expect(points.getBoundingClientRect().bottom).toBeLessThanOrEqual($('.anl-desk').getBoundingClientRect().bottom + 1)
    expect(points.scrollHeight).toBeGreaterThan(points.clientHeight)
  })

  it('gives the walked word back when a new Passage arrives', async () => {
    passage = GRAMMAR
    await mount()
    await analyze('雨を見ている')
    $$('.anl-desk__points .bkd-point')[1].click()
    await settle()
    expect(shown()).toBe('〜ている')
    $('.anl-desk__head .stage__leave').click()
    await settle(60)
    await analyze('雨を見ている')
    expect(shown()).toBe('雨')
  })
})

describe('the analyser\'s notices beside a long shelf (plans 123, 136)', () => {
  it('stand under the intake, in view, with the one live region after the grid', async () => {
    const rows = Array.from({ length: 20 }, (_, i) => ({ id: i + 1, phrase: `文${i + 1}`, source: 'text', created_at: '2026-09-20T10:00:00Z', kept: false }))
    apiFetch.mockImplementation(async url => {
      const u = String(url)
      if (u.startsWith('/api/phrase/history')) return ok(rows)
      return ok([])
    })
    apiJson.mockImplementation(async () => { throw new Error('boom') })
    await mount()
    await settle(200)
    expect($$('.desk-intake__main .anl-card').length).toBe(20)
    await analyze()
    await settle(200)
    const line = $('.desk-intake__side .anl-notice-line--bad')
    expect(line).not.toBeNull()
    expect(line.getBoundingClientRect().bottom).toBeLessThanOrEqual(window.innerHeight)
    // One live region, after the grid, where it stands in every state.
    expect($$('[role="status"]')).toHaveLength(1)
    expect($('.desk-intake [role="status"]')).toBeNull()
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

// ── plan 120 — the grab's walkthrough beside the intake ──
// The walkthrough is read while it is followed (copy, make the
// bookmark, come back), so on the desk it opens in the intake's column
// rather than over it: since plan 136 it takes the intake's place, the
// intake -- its link kept -- coming back on ✕ or Esc. The copy lives in
// the walkthrough alone. A phone keeps it a dialog, from the video
// sheet (AnalyzerScreen.responsive.browser, and deskfree.phone).
describe('the grab\'s walkthrough on the desk', () => {
  async function video() {
    await mount()
    $$('.anl-sources .seg__opt')[2].click()
    await settle()
  }

  it('opens in the intake\'s column in place of the intake, and Esc gives it back', async () => {
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: vi.fn(async () => {}) }, configurable: true })
    await video()
    type($('.anl-field'), 'https://youtu.be/dQw4w9WgXcQ')
    await settle(60)
    // Never used: setting the bookmark up is the filled action.
    const door = $('.anl-link .anl-grab__tutorial')
    expect(door.classList.contains('btn-primary')).toBe(true)
    expect(door.hasAttribute('aria-haspopup')).toBe(false)
    door.click()
    await settle()
    expect($('[role="dialog"]')).toBeNull()
    const dock = $('.desk-intake > .desk-side .desk-tut')
    expect(dock).not.toBeNull()
    expect($('.desk-intake > .desk-side').getAttribute('aria-label')).toBe(dock.querySelector('h2').textContent)
    // The intake waits under it, hidden, its link kept.
    expect($('#anl-panel-video').closest('[hidden]')).not.toBeNull()
    // The passages stay beside it.
    expect($('.desk-intake__main .anl-shelf')).not.toBeNull()
    expect(dock.querySelectorAll('.anl-tut__step').length).toBeGreaterThanOrEqual(3)

    // The device switch still switches.
    const devices = dock.querySelectorAll('.anl-tut__devices .anl-seg__opt')
    const before = dock.querySelector('.anl-tut__devicesteps').textContent
    devices[2].click()
    await settle(60)
    expect(dock.querySelector('.anl-tut__devicesteps').textContent).not.toBe(before)

    // The copy is the walkthrough's, and says so.
    const copy = dock.querySelector('.anl-tut__copy')
    const idle = copy.textContent
    copy.click()
    await settle(60)
    expect(navigator.clipboard.writeText).toHaveBeenCalledTimes(1)
    expect(copy.textContent).not.toBe(idle)

    press('Escape')
    await settle()
    expect($('.desk-tut')).toBeNull()
    expect($('.desk-intake > .desk-side #anl-panel-video .anl-field').value).toBe('https://youtu.be/dQw4w9WgXcQ')
    expect($('#anl-panel-video').closest('[hidden]')).toBeNull()
  })

  // Plan 123, P18: in on the dock's caption, out to the opener, closed by
  // the column's own roundel.
  it('takes the focus to its caption and gives it back to its door', async () => {
    await video()
    const door = $('.anl-grab__tutorial')
    door.focus()
    door.click()
    await settle()
    expect(document.activeElement).toBe($('.desk-tut h2'))
    expect($('.desk-tut .desk-dock__head .dict-plate__btn')).not.toBeNull()
    press('Escape')
    await settle()
    expect(document.activeElement).toBe($('.anl-grab__tutorial'))
  })

  it('gives the video intake back on its ✕', async () => {
    await video()
    $('.anl-grab__tutorial').click()
    await settle()
    expect($('.desk-tut')).not.toBeNull()
    $('.desk-tut .desk-dock__head .dict-plate__btn').click()
    await settle()
    expect($('.desk-tut')).toBeNull()
    expect($('.desk-intake > .desk-side #anl-panel-video')).not.toBeNull()
    expect($('.anl-sources .seg__opt--on').textContent).toBe('Vidéo')
  })
})

// ── plan 136 — the passages first ──
// The owner's pick C: the passages are the page -- the one console over
// them, a card each -- and the intake the column beside them. A link
// pasted where Japanese goes is taken by the video intake, a file
// dropped anywhere on the page by the intake that reads it, and the
// dictionary's door stands the platform it names in the column.
describe('the passages first on the desk (plan 136)', () => {
  const day = n => new Date(Date.now() - n * 86400000).toISOString()
  const PASSAGES = [
    { id: 1, phrase: '大手町ビル', source: 'image', created_at: day(2), kept: false },
    { id: 2, phrase: '本日は臨時休業です。', source: 'image', created_at: day(3), kept: true },
    { id: 3, phrase: '猫が窓の外を見ている。', source: 'text', created_at: day(5), kept: false },
  ]
  const SESSIONS = [
    { id: 7, source: 'upload', sourceRef: 'dQw4w9WgXcQ.ja.vtt', videoId: 'dQw4w9WgXcQ', sentenceCount: 36, firstLine: '駅の前で雨を眺めていた', createdAt: day(1) },
  ]
  function withHistory(passages = PASSAGES, sessions = SESSIONS) {
    apiFetch.mockImplementation(async url => {
      const u = String(url)
      if (u.startsWith('/api/phrase/history')) return ok(passages)
      if (u.startsWith('/api/video/sessions')) return ok(sessions)
      return ok([])
    })
  }
  const chips = () => $$('.anl-shelf .console__chips .chip').map(c => c.firstChild.textContent)
  const cards = () => $$('.anl-shelf__grid .anl-card')

  it('lays the passages out as cards under the one console', async () => {
    withHistory()
    await mount()
    await settle(150)
    expect(chips()).toEqual(['Tous', 'Vidéo', 'Texte', 'Photo', 'Gardés'])
    expect($('.anl-shelf .console__count').textContent).toBe('4 passages')
    expect(cards()).toHaveLength(4)
    // Newest first; a session prints its first sentence, its still and
    // its count, never the file the grab named after its id.
    const video = cards()[0]
    expect(video.classList.contains('anl-card--video')).toBe(true)
    expect(video.querySelector('.anl-card__jp').textContent).toBe('駅の前で雨を眺めていた')
    expect(video.querySelector('.anl-card__img').getAttribute('src')).toBe('https://i.ytimg.com/vi/dQw4w9WgXcQ/mqdefault.jpg')
    expect(video.querySelector('.anl-card__count').textContent).toBe('36 phrases')
    // Every card can be deleted, a video as a passage.
    expect(video.querySelector('.anl-card__delete')).not.toBeNull()
    expect(cards()[1].querySelector('.anl-card__src').textContent).toBe('Photo')
    expect(cards()[1].querySelector('.anl-card__delete')).not.toBeNull()
    // The cards stand side by side, a row sharing its height.
    const [a, b] = cards().map(c => c.getBoundingClientRect())
    expect(b.left).toBeGreaterThan(a.right)
    expect(Math.round(b.height)).toBe(Math.round(a.height))
  })

  // A video's ✕ marks the session removed on the server, and Undo takes
  // the mark off: its track is not kept, so it cannot be analysed again
  // the way a passage's text is.
  it('removes a video from the shelf and brings it back on Undo', async () => {
    // The server, as far as the shelf can see it: a removed session is
    // not listed until it is restored.
    let removed = false
    apiFetch.mockImplementation(async (url, _session, opts) => {
      const u = String(url)
      if (u === '/api/video/session/7' && opts?.method === 'DELETE') removed = true
      if (u === '/api/video/session/7/restore') removed = false
      if (u.startsWith('/api/phrase/history')) return ok(PASSAGES)
      if (u.startsWith('/api/video/sessions')) return ok(removed ? [] : SESSIONS)
      return ok([])
    })
    await mount()
    await settle(150)
    cards()[0].querySelector('.anl-card__delete').click()
    await settle(60)
    expect(apiFetch).toHaveBeenCalledWith('/api/video/session/7', expect.anything(), { method: 'DELETE' })
    expect(cards()).toHaveLength(3)
    expect(cards().some(c => c.classList.contains('anl-card--video'))).toBe(false)
    $('.anl-shelf .anl-undo__btn').click()
    await settle(60)
    expect(apiFetch).toHaveBeenCalledWith('/api/video/session/7/restore', expect.anything(), { method: 'POST' })
    expect(cards()).toHaveLength(4)
  })

  it('narrows the shelf by its chips and its search', async () => {
    withHistory()
    await mount()
    await settle(150)
    $$('.anl-shelf .console__chips .chip')[3].click()
    await settle(60)
    expect(cards()).toHaveLength(2)
    expect($('.anl-shelf .console__count').textContent).toBe('2 passages')
    $$('.anl-shelf .console__chips .chip')[4].click()
    await settle(60)
    expect(cards().map(c => c.querySelector('.anl-card__jp').textContent)).toEqual(['本日は臨時休業です。'])
    $$('.anl-shelf .console__chips .chip')[0].click()
    await settle(60)
    type($('.anl-shelf .console__field'), '猫')
    await settle(60)
    expect(cards().map(c => c.querySelector('.anl-card__jp').textContent)).toEqual(['猫が窓の外を見ている。'])
  })

  it('draws no chips for a shelf of one kind, and says what it waits for when empty', async () => {
    withHistory([PASSAGES[2]], [])
    await mount()
    await settle(150)
    expect($('.anl-shelf .console__chips')).toBeNull()
    expect(cards()).toHaveLength(1)
    document.body.innerHTML = ''
    withHistory([], [])
    await mount()
    await settle(150)
    expect($('.anl-shelf .console')).toBeNull()
    expect($('.anl-shelf__empty')).not.toBeNull()
  })

  it('walks the cards with the arrows, one tab stop, and opens one', async () => {
    withHistory()
    await mount()
    await settle(150)
    const doors = () => $$('.anl-card__open')
    expect(doors().filter(d => d.tabIndex === 0)).toHaveLength(1)
    doors()[0].focus()
    doors()[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }))
    await settle(30)
    expect(document.activeElement).toBe(doors()[1])
    expect(doors().filter(d => d.tabIndex === 0)).toEqual([doors()[1]])
    apiJson.mockClear()
    doors()[1].click()
    await settle(300)
    // A photo passage reopens where it came from.
    expect(apiJson.mock.calls.some(([u]) => String(u).startsWith('/api/phrase/history/1'))).toBe(true)
  })

  it('takes a YouTube link typed where Japanese goes to the video intake', async () => {
    await mount()
    type($('#anl-panel-text textarea'), 'https://www.youtube.com/watch?v=dQw4w9WgXcQ')
    await settle(60)
    expect($('#anl-panel-text')).toBeNull()
    expect($('#anl-panel-video .anl-field').value).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ')
    expect($('.anl-sources .seg__opt--on').textContent).toBe('Vidéo')
  })

  it('stands the platform the dictionary\'s door names in the column', async () => {
    await mount('/dictionary/analyzer?intake=photo')
    expect($('.desk-intake__side #anl-panel-photo')).not.toBeNull()
    expect($('[role="dialog"]')).toBeNull()
  })

  it('takes a subtitle file dropped anywhere on the page', async () => {
    const { apiUpload } = await import('./lib/api')
    apiUpload.mockClear()
    await mount()
    const data = new DataTransfer()
    data.items.add(new File(['1\n00:00:01,000 --> 00:00:02,000\n駅\n'], 'x.srt', { type: 'text/plain' }))
    const shelf = $('.desk-intake__main')
    const over = new DragEvent('dragover', { dataTransfer: data, bubbles: true, cancelable: true })
    shelf.dispatchEvent(over)
    expect(over.defaultPrevented).toBe(true)
    await settle(30)
    // The column it will land in says so.
    expect($('.desk-intake--drop .desk-intake__drop')).not.toBeNull()
    shelf.dispatchEvent(new DragEvent('drop', { dataTransfer: data, bubbles: true, cancelable: true }))
    await settle(60)
    expect($('.desk-intake__drop')).toBeNull()
    expect(apiUpload).toHaveBeenCalledTimes(1)
  })

  it('takes a picture dropped on the shelf to the photo intake\'s cropper', async () => {
    await mount()
    const data = new DataTransfer()
    data.items.add(new File([new Uint8Array([137, 80, 78, 71])], 'shot.png', { type: 'image/png' }))
    $('.desk-intake__main').dispatchEvent(new DragEvent('drop', { dataTransfer: data, bubbles: true, cancelable: true }))
    await settle()
    expect($('#anl-panel-photo')).not.toBeNull()
    expect($('.analysis-cropper')).not.toBeNull()
  })
})

// ── plan 123, P19 — a screenshot goes in without a file ──
// The photo platform's lead names a screenshot, and the only way in was
// to save one and find it in a file dialog. On the desk a picture pasted
// (anywhere but a field) or dropped on the two tiles goes straight to
// the cropper; both tiles stay, Choose printing the paste's key.
describe('the photo intake on the desk', () => {
  const png = () => new File([new Uint8Array([137, 80, 78, 71])], 'shot.png', { type: 'image/png' })
  const carrying = file => { const d = new DataTransfer(); d.items.add(file); return d }
  async function photo() {
    await mount()
    $$('.anl-sources .seg__opt')[1].click()
    await settle()
    expect($('.analysis-image-input .intake-pair')).not.toBeNull()
  }

  it('takes a pasted picture into the cropper, and prints the key on Choose', async () => {
    await photo()
    expect($$('.intake-btn')).toHaveLength(2)
    const choose = $$('.intake-btn')[1]
    expect(choose.querySelector('.desk-kbd').textContent).toMatch(/^(Ctrl|⌘) V$/)
    expect(choose.getAttribute('aria-keyshortcuts')).toMatch(/^(Control|Meta)\+V$/)
    document.body.dispatchEvent(new ClipboardEvent('paste', { clipboardData: carrying(png()), bubbles: true, cancelable: true }))
    await settle()
    expect($('.analysis-cropper')).not.toBeNull()
  })

  it('leaves a paste into a field to the field', async () => {
    await photo()
    const field = document.createElement('input')
    document.body.appendChild(field)
    try {
      field.dispatchEvent(new ClipboardEvent('paste', { clipboardData: carrying(png()), bubbles: true, cancelable: true }))
      await settle()
      expect($('.analysis-cropper')).toBeNull()
    } finally {
      field.remove()
    }
  })

  it('takes a dropped picture into the cropper', async () => {
    await photo()
    const target = $('.desk-photo')
    const data = carrying(png())
    const over = new DragEvent('dragover', { dataTransfer: data, bubbles: true, cancelable: true })
    target.dispatchEvent(over)
    expect(over.defaultPrevented).toBe(true)
    await settle(30)
    expect(target.classList.contains('desk-photo--over')).toBe(true)
    const drop = new DragEvent('drop', { dataTransfer: data, bubbles: true, cancelable: true })
    target.dispatchEvent(drop)
    expect(drop.defaultPrevented).toBe(true)
    await settle()
    expect($('.analysis-cropper')).not.toBeNull()
  })
})
