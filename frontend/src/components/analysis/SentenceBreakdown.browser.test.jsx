import { describe, it, expect, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { SentenceBreakdown } from './SentenceBreakdown'
import { rowsOf } from './rows'
import { GrammarChips } from './GrammarChips'
import { StatusBadge } from './StatusBadge'
import { LangProvider } from '../../LangContext'

// Fixture shape matches study/analysis.py's Token dict: surface,
// reading, pos, vocab_match (with stats once attach_user_state has
// run) | null, kanji_matches, and an optional `meaning` -- present only
// once the deep tier has been bought (see docs/adr/0001), absent is the
// normal/default case now.
function tokenFixture(overrides = {}) {
  return {
    surface: '学生', start: 0, end: 2, reading: 'がくせい', pos: 'noun',
    furigana: [{ text: '学生', reading: 'がくせい' }],
    vocab_match: {
      level: 'N5', raw_id: 'vocab_N5_学生_がくせい',
      entry: { word: '学生', meaning: 'student' },
      stats: { status: 'not_started', due: false },
    },
    kanji_matches: [],
    ...overrides,
  }
}

function particleFixture(overrides = {}) {
  return {
    surface: 'は', start: 2, end: 3, reading: 'は', pos: 'particle',
    furigana: [{ text: 'は' }],
    vocab_match: null,
    kanji_matches: [],
    ...overrides,
  }
}

function symbolFixture() {
  return { surface: '。', start: 9, end: 10, reading: '。', pos: 'symbol', furigana: [{ text: '。' }], vocab_match: null, kanji_matches: [] }
}

// 会いました as the tokenizer cuts it: three morphemes, the model's
// gloss bound to the first with the run's extent (merge_deep's
// span_end) -- or not bound at all, when the deep tier was not bought.
function runFixture({ spanEnd = true, glossed = true } = {}) {
  return [
    tokenFixture({
      surface: '会い', start: 3, end: 5, reading: 'あい', pos: 'verb',
      furigana: [{ text: '会', reading: 'あ' }, { text: 'い' }],
      vocab_match: { level: 'N5', raw_id: 'vocab_N5_会う_あう', entry: { word: '会う', meaning: 'to meet' }, stats: { status: 'learning' } },
      ...(glossed ? { meaning: 'met' } : {}),
      ...(spanEnd ? { span_end: 2 } : {}),
    }),
    particleFixture({ surface: 'まし', start: 5, end: 7, reading: 'まし', pos: 'auxiliary', furigana: [{ text: 'まし' }] }),
    particleFixture({ surface: 'た', start: 7, end: 8, reading: 'た', pos: 'auxiliary', furigana: [{ text: 'た' }] }),
  ]
}

const T = {
  clickForDetails: 'Click for details',
  jumpToTokenNamed: s => `Go to ${s}`,
  detailsForToken: s => `Details for ${s}`,
  detailsForKanji: k => `Details for the kanji ${k}`,
  grammarSpotted: 'Grammar spotted',
}

// CardTransition (used by the stage layout) renders StageMark, which
// calls useLang() -- so every render needs a real LangProvider ancestor.
// LangProvider itself fetches /api/translations/{kanji,vocab} on mount
// (LangContext.jsx's getTranslations, for contentMaps -- unrelated to
// the `t`/`lang` this suite actually reads), so `fetch` is stubbed
// module-wide to keep these tests offline, same pattern as
// lib/api.test.js's mockFetchOnce.
globalThis.fetch = vi.fn().mockResolvedValue({
  ok: true,
  status: 200,
  json: async () => ({}),
})

function withLang(children) {
  return <LangProvider>{children}</LangProvider>
}

const before = (a, b) => !!(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING)

describe('SentenceBreakdown', () => {
  it('list layout renders one card per token', async () => {
    const analysis = { tokens: [tokenFixture(), particleFixture()], explanation: '' }
    const screen = await render(withLang(
      <SentenceBreakdown analysis={analysis} t={T} layout="list" onTokenClick={() => {}} onKanjiClick={() => {}} />
    ))
    // Both surfaces should appear somewhere in the rendered list of cards.
    expect(screen.getByText('学生').elements().length).toBeGreaterThan(0)
    expect(screen.getByText('は').elements().length).toBeGreaterThan(0)
  })

  it('a token with no meaning renders without the string "undefined"', async () => {
    const analysis = { tokens: [tokenFixture()], explanation: '' }
    await render(withLang(
      <SentenceBreakdown analysis={analysis} t={T} layout="list" onTokenClick={() => {}} onKanjiClick={() => {}} />
    ))
    expect(document.body.textContent).not.toContain('undefined')
  })

  it('StatusBadge renders the translated label, not hardcoded English', async () => {
    const t = { status_mastered: 'TRANSLATED_LABEL' }
    await render(<StatusBadge status="mastered" t={t} />)
    expect(document.body.textContent).toContain('TRANSLATED_LABEL')
    expect(document.body.textContent).not.toContain('Mastered')
  })

  it('clicking a token card with a vocab_match calls onTokenClick', async () => {
    const onTokenClick = vi.fn()
    const analysis = { tokens: [tokenFixture()], explanation: '' }
    await render(withLang(
      <SentenceBreakdown analysis={analysis} t={T} layout="list" onTokenClick={onTokenClick} onKanjiClick={() => {}} />
    ))
    document.querySelector('.phrase-word-card__surface-wrap').click()
    expect(onTokenClick).toHaveBeenCalledTimes(1)
  })

  it('clicking a token card with no vocab_match does not call onTokenClick', async () => {
    const onTokenClick = vi.fn()
    const analysis = { tokens: [particleFixture()], explanation: '' }
    await render(withLang(
      <SentenceBreakdown analysis={analysis} t={T} layout="list" onTokenClick={onTokenClick} onKanjiClick={() => {}} />
    ))
    document.querySelector('.phrase-word-card__surface-wrap').click()
    expect(onTokenClick).not.toHaveBeenCalled()
  })

  it('never nests a button inside a button', async () => {
    const token = tokenFixture({
      kanji_matches: [
        { raw_id: 'kanji_N5_大', kanji: '大', level: 'N5', stats: { status: 'not_started' } },
      ],
    })
    const analysis = { tokens: [token], explanation: '' }
    const screen = await render(withLang(
      <SentenceBreakdown analysis={analysis} t={T} layout="list" onTokenClick={() => {}} onKanjiClick={() => {}} />
    ))
    expect(screen.container.querySelectorAll('button button').length).toBe(0)
  })

  it('leaves a non-clickable Token as plain text', async () => {
    const analysis = { tokens: [particleFixture()], explanation: '' }
    await render(withLang(
      <SentenceBreakdown analysis={analysis} t={T} layout="list" onTokenClick={() => {}} onKanjiClick={() => {}} />
    ))
    const span = document.querySelector('.phrase-line .word-span')
    expect(span.tagName).toBe('SPAN')
    expect(document.querySelectorAll('.phrase-line button').length).toBe(0)
  })

  // ── The rows (plan 084) ───────────────────────────────────────
  // The practice modes' breakdown: the ruby line, the translation,
  // one row per WORD, the note last. Words, not morphemes: a run the
  // model glossed as one word is one row, and so is a verb with its
  // polite ending when nothing bound it.

  it('rows layout draws one row per word, and none for punctuation', async () => {
    const analysis = { available: true, tokens: [tokenFixture(), particleFixture(), ...runFixture(), symbolFixture()], grammar: [] }
    await render(withLang(
      <SentenceBreakdown analysis={analysis} t={T} layout="rows" onTokenClick={() => {}} />
    ))
    const rows = document.querySelectorAll('.bkd-row')
    expect(rows).toHaveLength(3)
    expect([...rows].map(r => r.querySelector('.bkd-row__word').textContent)).toEqual(['学生', 'は', '会いました'])
    // The line is the whole sentence, mark included; the rows are its words.
    expect(document.querySelector('.bkd-line').textContent).toContain('。')
    expect([...rows].some(r => r.textContent.includes('。'))).toBe(false)
  })

  it('a glossed run is one row, read as the word it is, with the gloss the model gave', () => {
    const rows = rowsOf(runFixture())
    expect(rows).toHaveLength(1)
    expect(rows[0].surface).toBe('会いました')
    expect(rows[0].reading).toBe('あいました')
    expect(rows[0].head.meaning).toBe('met')
  })

  it('a trailing auxiliary folds onto its verb when nothing bound it', () => {
    const rows = rowsOf(runFixture({ spanEnd: false, glossed: false }))
    expect(rows).toHaveLength(1)
    expect(rows[0].surface).toBe('会いました')
  })

  it('an auxiliary the model glossed on its own keeps its row', () => {
    const [verb, mashi, ta] = runFixture({ spanEnd: false, glossed: false })
    const rows = rowsOf([verb, { ...mashi, meaning: 'polite' }, ta])
    expect(rows.map(r => r.surface)).toEqual(['会い', 'ました'])
  })

  it('the line reads over kanji only, and the row leaves out a reading that only repeats the word', async () => {
    const analysis = { available: true, tokens: [tokenFixture(), particleFixture(), ...runFixture()], grammar: [] }
    await render(withLang(
      <SentenceBreakdown analysis={analysis} t={T} layout="rows" onTokenClick={() => {}} />
    ))
    const rts = [...document.querySelectorAll('.bkd-line rt')].map(rt => rt.textContent)
    expect(rts).toEqual(['がくせい', 'あ'])
    const readings = [...document.querySelectorAll('.bkd-row')].map(r => r.querySelector('.bkd-row__reading')?.textContent ?? null)
    expect(readings).toEqual(['がくせい', null, 'あいました'])
  })

  it('a deck word is a focusable control in the line and in its row; a particle is text; nothing nests', async () => {
    const onTokenClick = vi.fn()
    const analysis = { available: true, tokens: [tokenFixture(), particleFixture()], grammar: [] }
    const screen = await render(withLang(
      <SentenceBreakdown analysis={analysis} t={T} layout="rows" onTokenClick={onTokenClick} />
    ))
    const lineWord = document.querySelector('.bkd-line .bkd-tok--door')
    expect(lineWord.tagName).toBe('BUTTON')
    expect(lineWord.getAttribute('aria-label')).toBe('Details for 学生')
    expect(document.querySelectorAll('.bkd-line button')).toHaveLength(1)

    const rows = document.querySelectorAll('.bkd-row')
    expect(rows[0].querySelector('.bkd-row__word').tagName).toBe('BUTTON')
    expect(rows[1].querySelector('.bkd-row__word').tagName).toBe('SPAN')
    expect(screen.container.querySelectorAll('button button')).toHaveLength(0)

    rows[0].querySelector('.bkd-row__word').click()
    lineWord.click()
    expect(onTokenClick).toHaveBeenCalledTimes(2)
    expect(onTokenClick.mock.calls[0][0].surface).toBe('学生')
  })

  it("the gloss is the model's where it was bought, else the deck's own, and never undefined", async () => {
    const analysis = { available: true, tokens: [tokenFixture(), particleFixture(), ...runFixture()], grammar: [] }
    await render(withLang(
      <SentenceBreakdown analysis={analysis} t={T} layout="rows" onTokenClick={() => {}} />
    ))
    const meanings = [...document.querySelectorAll('.bkd-row__meaning')].map(el => el.textContent)
    expect(meanings).toEqual(['student', '', 'met'])
    expect(document.body.textContent).not.toContain('undefined')
    // The level is the deck's, as a badge, on the deck words only.
    const levels = [...document.querySelectorAll('.bkd-row')].map(r => r.querySelector('.type-badge')?.textContent ?? null)
    expect(levels).toEqual(['N5', null, 'N5'])
  })

  it('reads translation, rows, then the note, in that order, and the note falls back to the explanation', async () => {
    const analysis = { available: true, tokens: [tokenFixture()], grammar: [], explanation: 'A plain statement.' }
    await render(withLang(
      <SentenceBreakdown analysis={analysis} t={T} layout="rows" translation="A student." onTokenClick={() => {}} />
    ))
    const en = document.querySelector('.bkd__en')
    const rows = document.querySelector('.bkd-rows')
    const note = document.querySelector('.bkd .prose__ai')
    expect(en.textContent).toBe('A student.')
    expect(note.textContent).toBe('A plain statement.')
    expect(before(document.querySelector('.bkd-line'), en)).toBe(true)
    expect(before(en, rows)).toBe(true)
    expect(before(rows, note)).toBe(true)
    // No caption over the rows, no level badge, no counter: the rows
    // are the point (DESIGN.md, "say less").
    expect(document.querySelector('.bkd .cap')).toBeNull()
    expect(document.querySelector('.analysis-level-badge')).toBeNull()
  })

  it('a note given outright wins over the explanation', async () => {
    const analysis = { available: true, tokens: [tokenFixture()], grammar: [], explanation: 'long prose' }
    await render(withLang(
      <SentenceBreakdown analysis={analysis} t={T} layout="rows" note="「は」 marks the topic." onTokenClick={() => {}} />
    ))
    expect(document.querySelector('.bkd .prose__ai').textContent).toBe('「は」 marks the topic.')
    expect(document.body.textContent).not.toContain('long prose')
  })

  it('without an analysis the sentence prints plain, over its translation', async () => {
    await render(withLang(
      <SentenceBreakdown analysis={{ available: false, tokens: [] }} t={T} layout="rows" translation="Hello." sentenceText="こんにちは。" onTokenClick={() => {}} />
    ))
    expect(document.querySelector('.bkd .prose__jp').textContent).toBe('こんにちは。')
    expect(document.querySelector('.bkd__en').textContent).toBe('Hello.')
    expect(document.querySelector('.bkd-rows')).toBeNull()
    expect(document.querySelector('.bkd-line')).toBeNull()
  })

  it('quiet grammar chips carry the pattern and its level, and no caption, pill or deck action', async () => {
    const grammar = [{ pattern: '〜ました／〜ませんでした', level: 'N5', raw_id: 'grammar_N5_x', start: 3, stats: { status: 'not_started' } }]
    await render(<GrammarChips grammar={grammar} t={T} quiet label={null} />)
    expect(document.querySelector('.analysis-grammar-chip__pattern').textContent).toBe('〜ました／〜ませんでした')
    expect(document.querySelector('.analysis-grammar-chip__level').textContent).toBe('N5')
    expect(document.querySelector('.cap')).toBeNull()
    expect(document.querySelector('.analysis-grammar-chip button')).toBeNull()
    expect(document.querySelector('.status-badge, .analysis-status-badge')).toBeNull()
  })

  it('a grammar chip is a door to its entry when given somewhere to open, and stays a word otherwise', async () => {
    const grammar = [{ pattern: '〜てから', level: 'N5', raw_id: 'grammar_N5_〜てから', start: 2, stats: { status: 'not_started' } }]
    const onOpen = vi.fn()
    await render(<GrammarChips grammar={grammar} t={{ ...T, openDictionary: 'Open dictionary entry' }} quiet label={null} onOpen={onOpen} />)
    const door = document.querySelector('.analysis-grammar-chip__pattern')
    expect(door.tagName).toBe('BUTTON')
    expect(door.classList.contains('analysis-grammar-chip__door')).toBe(true)
    expect(door.getAttribute('aria-label')).toBe('Open dictionary entry: 〜てから')
    expect(door.textContent).toBe('〜てから')
    // Quiet still: no pill, no deck action — the door is the only button.
    expect(document.querySelectorAll('.analysis-grammar-chip button')).toHaveLength(1)
    door.click()
    expect(onOpen).toHaveBeenCalledTimes(1)
    expect(onOpen.mock.calls[0][0].raw_id).toBe('grammar_N5_〜てから')
  })

  it('grammar chips print the caption they are given', async () => {
    const grammar = [{ pattern: '〜てから', level: 'N5', raw_id: 'grammar_N5_y' }]
    await render(<GrammarChips grammar={grammar} t={T} quiet label="Grammar in this text" />)
    expect(document.querySelector('.analysis-grammar-chips .cap').textContent).toBe('Grammar in this text')
  })
})
