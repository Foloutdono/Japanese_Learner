import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, cleanup } from 'vitest-browser-react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { LangProvider } from '../../LangContext'
import fr from '../../locales/fr/index.js'
import '../../index.css'

// ── 札の中身 / 札の帯 (plan 326) ──────────────────────────────────
// The owner's picks of the canvas "Tsuji — card templates": answer B
// (the card as it was, a strip under it), Réglages › Card contents as
// D1 (a switch a field, each field shown on 届ける), and a Personalize
// pill, the sliders alone, at the end of the run's one row of pills.

const CHOSEN = {
  vocab: ['sentence', 'example', 'kanji', 'pair', 'verb'],
  kanji: ['words', 'strokes'],
  choices: {
    vocab: { question: ['furigana', 'sentence'], answer: ['example', 'kanji', 'meanings', 'pair', 'verb'] },
    kanji: { question: [], answer: ['words', 'radical', 'strokes'] },
  },
}
const EXTRAS = {
  vocab_N4_届ける_とどける: {
    example: {
      jp: '家に届けていただけますか。',
      segments: [{ text: '家に' }, { text: '届け', highlight: true }, { text: 'ていただけますか。' }],
      tr: 'Pourriez-vous me le livrer à domicile ?',
    },
    kanji: [{ char: '届', reading: 'とど', meaning: 'livrer; parvenir' }],
    pair: [{ kanji: '届く', kana: 'とどく', kind: 'vi', level: 'N3', meaning: 'atteindre, arriver' }],
    verb: ['v. ichidan', 'transitif'],
  },
}

const apiJson = vi.hoisted(() => vi.fn())
const apiFetch = vi.hoisted(() => vi.fn())
vi.mock('../../lib/api', () => ({ apiFetch: (...a) => apiFetch(...a), apiJson: (...a) => apiJson(...a) }))
vi.mock('../../lib/supabase', () => ({ supabase: { auth: { getSession: async () => ({ data: { session: { access_token: 'tok' } } }) } } }))
const speak = vi.hoisted(() => vi.fn())
vi.mock('../dictionary/DictionaryDetail', () => ({
  SpeakIcon: () => <svg />,
  speakJapanese: (...a) => speak(...a),
  DictionaryLookupSheet: ({ term, category }) => <div className="test-sheet" data-term={term} data-category={category} />,
}))
vi.mock('./BreakdownSheet', () => ({
  BreakdownSheet: ({ sentence, translation }) => <div className="test-breakdown" data-sentence={sentence} data-tr={translation} />,
}))
globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })

const { CardStrip } = await import('./CardStrip')
const { default: HintBar } = await import('./HintBar')
const { CardContentsPage } = await import('../settings/CardContentsPage')
const { forgetCardContents } = await import('../../stores/cardContents')

const settle = (ms = 120) => new Promise(r => setTimeout(r, ms))
const $ = sel => document.querySelector(sel)
const $$ = sel => [...document.querySelectorAll(sel)]
const session = { access_token: 'tok' }
const word = mode => ({ card_id: 'vocab_N4_届ける_とどける', mode, kanji: '届ける', kana: 'とどける' })

async function strip(card, revealed) {
  await render(
    <LangProvider><MemoryRouter><CardStrip card={card} revealed={revealed} session={session} /></MemoryRouter></LangProvider>,
  )
  await settle()
}

beforeEach(() => {
  localStorage.setItem('lang', 'fr')
  forgetCardContents()
  apiFetch.mockReset()
  apiJson.mockReset()
  speak.mockReset()
  apiFetch.mockImplementation(async () => ({ ok: true, json: async () => CHOSEN }))
  apiJson.mockImplementation(async path => (path.startsWith('/api/card-extras') ? { extras: EXTRAS, chosen: CHOSEN } : {}))
})
afterEach(async () => {
  await cleanup()
  localStorage.removeItem('lang')
})

describe('the strip under the card', () => {
  it('asks the question\'s part alone before the card is turned: the sentence, never its translation', async () => {
    await strip(word('vocab.flashcard.f2b'), false)
    const asked = apiJson.mock.calls.map(([p]) => p).filter(p => p.startsWith('/api/card-extras'))
    expect(asked).toHaveLength(1)
    expect(asked[0]).toContain('lang=fr')
    expect($$('.cstrip__row')).toHaveLength(1)
    expect($('.cstrip__jp').textContent).toBe('家に届けていただけますか。')
    expect($('.cstrip__word').textContent).toBe('届け')
    expect($('.cstrip__tr')).toBeNull()
  })

  it('shows nothing over a meaning → word card\'s question', async () => {
    await strip(word('vocab.flashcard.b2f'), false)
    expect($('.cstrip')).toBeNull()
  })

  it('stands every chosen row once turned, a door for each other entry', async () => {
    await strip(word('vocab.flashcard.f2b'), true)
    expect($('.cstrip__tr').textContent).toBe('Pourriez-vous me le livrer à domicile ?')
    const doors = $$('.cstrip__row--door')
    expect(doors).toHaveLength(3)      // 届, 届く, the forms
    expect(doors[1].textContent).toContain(fr.ccField.pair)
    expect(doors[2].textContent).toContain(fr.ccForms)
    doors[0].click()
    await settle(40)
    expect($('.test-sheet').dataset.term).toBe('届')
    expect($('.test-sheet').dataset.category).toBe('kanji')
  })

  it('breaks the sentence down once turned, never over the question (plan 327)', async () => {
    await strip(word('vocab.flashcard.f2b'), false)
    expect($('[data-action="strip-breakdown"]')).toBeNull()
    await cleanup()
    await strip(word('vocab.flashcard.f2b'), true)
    $('[data-action="strip-breakdown"]').click()
    await settle(40)
    expect($('.test-breakdown').dataset.sentence).toBe('家に届けていただけますか。')
    expect($('.test-breakdown').dataset.tr).toBe('Pourriez-vous me le livrer à domicile ?')
  })

  it('asks again when the choice changes under the same card (plan 327)', async () => {
    await strip(word('vocab.flashcard.f2b'), true)
    const asked = () => apiJson.mock.calls.filter(([p]) => p.startsWith('/api/card-extras')).length
    expect(asked()).toBe(1)
    const { setCardContents } = await import('../../stores/cardContents')
    await setCardContents('vocab', ['example'], session)
    await settle()
    expect(asked()).toBe(2)
  })

  it('says the sentence', async () => {
    await strip(word('vocab.flashcard.f2b'), true)
    $(`button[aria-label="${fr.ccPlaySentence}"]`).click()
    expect(speak).toHaveBeenCalledWith('家に届けていただけますか。')
  })

  it('asks for nothing when nothing was chosen', async () => {
    apiFetch.mockImplementation(async () => ({ ok: true, json: async () => ({ ...CHOSEN, vocab: [], kanji: [] }) }))
    await strip(word('vocab.flashcard.f2b'), true)
    expect(apiJson.mock.calls.some(([p]) => p.startsWith('/api/card-extras'))).toBe(false)
    expect($('.cstrip')).toBeNull()
  })
})

describe('Personalize', () => {
  it('is the row\'s last pill, the sliders alone, and opens the panel over the run (plan 327)', async () => {
    await render(
      <LangProvider>
        <MemoryRouter initialEntries={['/learn/vocab/N4/vocab.flashcard.f2b']}>
          <Routes>
            <Route path="/learn/vocab/:level/:mode" element={
              <>
                <HintBar available={['indice_1', 'indice_3']} active={[]} onToggle={() => {}} speaks personalize="kanji" session={session} />
                <div className="test-card">card</div>
              </>
            } />
          </Routes>
        </MemoryRouter>
      </LangProvider>,
    )
    await settle()
    const row = $('.study-assist')
    const go = row.lastElementChild
    expect(go.dataset.action).toBe('personalize')
    expect(go.textContent).toBe('')
    expect(go.getAttribute('aria-label')).toBe(fr.ccPersonalize)
    // One row in French too: the hints say their register alone.
    const top = new Set([...row.children].map(c => Math.round(c.getBoundingClientRect().top)))
    expect(top.size).toBe(1)
    go.click()
    await settle()
    // A panel, the run left standing under it, opened on the card's line.
    expect($('[role="dialog"].cc-sheet')).not.toBeNull()
    expect($('.test-card')).not.toBeNull()
    expect($$('.cc-sheet .cc-row').map(r => r.dataset.field)).toEqual(['words', 'radical', 'strokes'])
  })
})

describe('Réglages › Card contents', () => {
  it('draws a switch a field, the chosen ones on, and writes a flip', async () => {
    await render(<LangProvider><MemoryRouter><CardContentsPage session={session} /></MemoryRouter></LangProvider>)
    await settle()
    const rows = $$('.cc-row')
    expect(rows.map(r => r.dataset.field)).toEqual(['furigana', 'sentence', 'example', 'kanji', 'meanings', 'pair', 'verb'])
    // The owner's pick C (plan 327): each side headed by its kanji in a
    // ring and its name, each row opening on its field's kanji.
    expect($$('.cc-group__head').map(h => h.textContent)).toEqual([`問${fr.ccQuestion}`, `答${fr.ccAnswer}`])
    expect($$('.cc-group')[0].getAttribute('aria-labelledby')).toBe($$('.cc-group__title')[0].id)
    expect(rows.map(r => r.querySelector('.cc-row__glyph').textContent).join('')).toBe('ふ文例漢意対動')
    const switches = $$('.cc-row [role="switch"]')
    expect(switches.map(s => s.getAttribute('aria-checked'))).toEqual(['false', 'true', 'true', 'true', 'false', 'true', 'true'])
    switches[4].click()
    await settle()
    const patch = apiJson.mock.calls.find(([p, , o]) => p === '/api/profile/learning' && o?.method === 'PATCH')
    expect(JSON.parse(patch[2].body)).toEqual({ cardContents: { vocab: ['sentence', 'example', 'kanji', 'pair', 'verb', 'meanings'] } })
    expect($$('.cc-row [role="switch"]')[4].getAttribute('aria-checked')).toBe('true')
  })
})
