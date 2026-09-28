import { useState } from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { SentenceBreakdown } from './SentenceBreakdown'
import { partsOf, rowsOf, wordRowsOf } from './rows'
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
  explainSentence: 'Explain',
  explaining: 'Explaining…',
}

// The chips' and the rows' glosses read the learner's language through
// useLang(), so the renders that check them need a real LangProvider
// ancestor. LangProvider itself fetches /api/translations/{kanji,vocab} on mount
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

  // ── The rows (plan 084; numbered since plan 160) ──────────────
  // The practice modes' breakdown: the ruby line, the translation,
  // one row per WORD, a numbered card per rule, the note last. Words,
  // not morphemes: a run the model glossed as one word is one row, and
  // so is a verb with its polite ending when nothing bound it. A
  // particle is no row: its marker is a card (plan 160).

  it('rows layout draws one row per word, and none for a particle or punctuation', async () => {
    const analysis = { available: true, tokens: [tokenFixture(), particleFixture(), ...runFixture(), symbolFixture()], grammar: [] }
    await render(withLang(
      <SentenceBreakdown analysis={analysis} t={T} layout="rows" onTokenClick={() => {}} />
    ))
    const rows = document.querySelectorAll('.bkd-row')
    expect(rows).toHaveLength(2)
    expect([...rows].map(r => r.querySelector('.bkd-row__word').textContent)).toEqual(['学生', '会いました'])
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

  it('a particle or a copula is a row of its own, whatever bound it; tense stays with its verb (plan 095)', () => {
    // 今日は as the model binds it: the particle still stands alone.
    const kyouwa = rowsOf([tokenFixture({ surface: '今日', span_end: 1 }), particleFixture()])
    expect(kyouwa.map(r => r.surface)).toEqual(['今日', 'は'])
    // いいです: the copula is its own row; 休んだ: the past tense is not.
    const ii = rowsOf([
      tokenFixture({ surface: 'いい', pos: 'adjective', start: 0, end: 2 }),
      particleFixture({ surface: 'です', pos: 'auxiliary', lemma: 'です', start: 2, end: 4 }),
    ])
    expect(ii.map(r => r.surface)).toEqual(['いい', 'です'])
    const yasunda = rowsOf([
      tokenFixture({ surface: '休ん', pos: 'verb', start: 0, end: 2 }),
      particleFixture({ surface: 'だ', pos: 'auxiliary', lemma: 'た', start: 2, end: 3 }),
    ])
    expect(yasunda.map(r => r.surface)).toEqual(['休んだ'])
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
    expect(readings).toEqual(['がくせい', 'あいました'])
  })

  // Plan 160: the dictionary's name for the word and the card's reading
  // -- 話す はなす where the sentence wrote 話し, which the row printed
  // beside はなす -- and its meaning in the learner's language (the
  // browser lane is a French device); a card with no French line keeps
  // its English.
  it('a word is named as the dictionary names it, and glossed in the learner\'s language', async () => {
    const hanashi = tokenFixture({
      surface: '話し', start: 0, end: 2, reading: 'はなし', pos: 'verb',
      furigana: [{ text: '話', reading: 'はな' }, { text: 'し' }],
      vocab_match: {
        level: 'N5', raw_id: 'vocab_N5_話す_はなす',
        entry: { kanji: '話す', kana: 'はなす', meaning: 'to speak', meaning_fr: 'parler' },
        stats: { status: 'not_started' },
      },
    })
    const analysis = { available: true, tokens: [hanashi, tokenFixture({ start: 2, end: 4 })], grammar: [] }
    await render(withLang(<SentenceBreakdown analysis={analysis} t={T} layout="rows" onTokenClick={() => {}} />))
    const [row, other] = document.querySelectorAll('.bkd-row')
    expect(row.querySelector('.bkd-row__word').textContent).toBe('話す')
    expect(row.querySelector('.bkd-row__reading').textContent).toBe('はなす')
    expect(row.querySelector('.bkd-row__meaning').textContent).toBe('parler')
    expect(other.querySelector('.bkd-row__meaning').textContent).toBe('student')
    // The line still reads as the sentence wrote it.
    const line = document.querySelector('.bkd-line').cloneNode(true)
    line.querySelectorAll('rt').forEach(rt => rt.remove())
    expect(line.textContent).toContain('話し')
  })

  // Plan 096: in the LINE the word itself is the control (there is no
  // row to press there); in the ROWS the whole row is, and the word
  // inside it is a span wearing the door's rule. A row with nothing to
  // open stays a <div>.
  it('a deck word is a focusable control in the line and its whole row in the rows; a particle is text; nothing nests', async () => {
    const onTokenClick = vi.fn()
    // An off-deck noun (a name) is a row that opens nothing.
    const offDeck = tokenFixture({ surface: 'ピカ', start: 3, end: 5, reading: 'ぴか', vocab_match: null, furigana: [{ text: 'ピカ' }] })
    const analysis = { available: true, tokens: [tokenFixture(), particleFixture(), offDeck], grammar: [] }
    const screen = await render(withLang(
      <SentenceBreakdown analysis={analysis} t={T} layout="rows" onTokenClick={onTokenClick} />
    ))
    const lineWord = document.querySelector('.bkd-line .bkd-tok--door')
    expect(lineWord.tagName).toBe('BUTTON')
    expect(lineWord.getAttribute('aria-label')).toBe('Details for 学生')
    expect(document.querySelectorAll('.bkd-line button')).toHaveLength(1)

    const rows = document.querySelectorAll('.bkd-row')
    expect(rows[0].tagName).toBe('BUTTON')
    expect(rows[1].tagName).toBe('DIV')
    expect(rows[0].querySelector('.bkd-row__word').tagName).toBe('SPAN')
    expect(screen.container.querySelectorAll('button button')).toHaveLength(0)
    // The row's name is everything printed on it, not the word alone:
    // an aria-label replaces the button's contents.
    expect(rows[0].getAttribute('aria-label')).toBe('Details for 学生 — がくせい — student — N5')

    // Pressed on the gloss, which is not the word: the row carries it.
    rows[0].querySelector('.bkd-row__meaning').click()
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
    expect(meanings).toEqual(['student', 'met'])
    expect(document.body.textContent).not.toContain('undefined')
    // The level is the deck's, as a badge.
    const levels = [...document.querySelectorAll('.bkd-row')].map(r => r.querySelector('.type-badge')?.textContent ?? null)
    expect(levels).toEqual(['N5', 'N5'])
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

  // ── The gloss on the chip (plan 095) ───────────────────────────
  // A chip says what its rule does. The local tier ships the gloss as
  // the catalogue's {en, fr} pair (the analysis is shared across
  // learners, so it cannot pick a language); the comprehension result
  // ships a string it localised itself. The chip reads both, in the
  // learner's language -- the browser lane is a French device.
  const NAGARA = { pattern: '〜ながら', level: 'N4', raw_id: 'grammar_N4_〜ながら', kind: 'pattern', start: 4,
    meaning: { en: 'while doing', fr: 'tout en faisant' }, structure: 'verb stem + ながら' }

  it("a chip carries its rule's gloss in the learner's language, between the pattern and the level", async () => {
    await render(withLang(<GrammarChips grammar={[NAGARA]} t={T} quiet label={null} />))
    const chip = document.querySelector('.analysis-grammar-chip')
    const gloss = chip.querySelector('.analysis-grammar-chip__gloss')
    expect(gloss.textContent).toBe('tout en faisant')
    expect(gloss.title).toBe('verb stem + ながら')
    expect(before(chip.querySelector('.analysis-grammar-chip__pattern'), gloss)).toBe(true)
    expect(before(gloss, chip.querySelector('.analysis-grammar-chip__level'))).toBe(true)
  })

  it('a gloss already localised by the server prints as it is, and a point without one prints none', async () => {
    const grammar = [
      { ...NAGARA, meaning: 'while doing' },
      { pattern: '〜てから', level: 'N5', raw_id: 'grammar_N5_〜てから', start: 0 },
    ]
    await render(withLang(<GrammarChips grammar={grammar} t={T} quiet label={null} />))
    const glosses = [...document.querySelectorAll('.analysis-grammar-chip')].map(c => c.querySelector('.analysis-grammar-chip__gloss')?.textContent ?? null)
    expect(glosses).toEqual(['while doing', null])
    expect(document.body.textContent).not.toContain('[object Object]')
  })

  it('without a language above it the gloss falls back to English rather than the chip falling over', async () => {
    await render(<GrammarChips grammar={[NAGARA]} t={T} quiet label={null} />)
    expect(document.querySelector('.analysis-grammar-chip__gloss').textContent).toBe('while doing')
  })

  // ── The rules, numbered (plans 095 and 160) ──────────────────
  // study/grammar_detect tells a MARKER (a point that is one
  // grammatical word: は, へ, です／だ) from a PATTERN built around one.
  // Both are numbered cards under the words, in the sentence's order,
  // and each is framed on the line under its number -- the analyser's
  // layout (plan 134). The verb's endings (〜ます, 〜た) are neither:
  // they ride their word as a tag.

  const WA = { pattern: 'は', level: 'N5', raw_id: 'grammar_N5_は', kind: 'marker',
    meaning: { en: 'marks the sentence topic', fr: 'marque le thème de la phrase' } }
  const MASU = { pattern: '〜ます／〜ません', level: 'N5', raw_id: 'grammar_N5_〜ます／〜ません', kind: 'pattern' }

  it('a particle is no row: its marker is a numbered card that opens its point', async () => {
    const onGrammarOpen = vi.fn()
    const onTokenClick = vi.fn()
    const analysis = {
      available: true,
      grammar: [{ ...WA, start: 2, end: 3, segments: [[2, 3]] }],
      tokens: [tokenFixture(), particleFixture({ grammar: [WA] })],
    }
    await render(withLang(
      <SentenceBreakdown analysis={analysis} t={T} layout="rows" onTokenClick={onTokenClick} onGrammarOpen={onGrammarOpen} />
    ))
    expect(document.querySelectorAll('.bkd-row')).toHaveLength(1)
    const card = document.querySelector('.bkd-point')
    expect(card.tagName).toBe('BUTTON')
    expect(card.querySelector('.anl-num').textContent).toBe('1')
    expect(card.querySelector('.bkd-point__pattern').textContent).toBe('は')
    // Its rule's gloss, in the learner's language.
    expect(card.querySelector('.bkd-point__gloss').textContent).toBe('marque le thème de la phrase')
    // The word it marks, unlit, then the particle.
    const parts = [...card.querySelectorAll('.anl-part')]
    expect(parts.map(p => p.textContent)).toEqual(['学生', 'は'])
    expect(parts.map(p => p.classList.contains('anl-part--in'))).toEqual([false, true])
    card.click()
    expect(onGrammarOpen).toHaveBeenCalledTimes(1)
    expect(onGrammarOpen.mock.calls[0][0].raw_id).toBe('grammar_N5_は')
    expect(onTokenClick).not.toHaveBeenCalled()
  })

  it('the line frames each point on its words, under the number its card carries', async () => {
    const analysis = {
      available: true,
      grammar: [{ ...WA, start: 2, end: 3, segments: [[2, 3]] }],
      tokens: [tokenFixture(), particleFixture({ grammar: [WA] })],
    }
    await render(withLang(<SentenceBreakdown analysis={analysis} t={T} layout="rows" onTokenClick={vi.fn()} onGrammarOpen={vi.fn()} />))
    const line = document.querySelector('.bkd-line')
    expect(line.classList.contains('bkd-line--numbered')).toBe(true)
    const frames = [...line.querySelectorAll('.bkd-frame')]
    expect(frames).toHaveLength(1)
    expect(frames[0].querySelector('.bkd-frame__n').textContent).toBe('1')
    expect(frames[0].textContent).toBe('1は')
    // The word the point is not written on stands outside the frame.
    expect(line.querySelector('.bkd-frame .bkd-tok--door')).toBeNull()
  })

  it('a mark never starts a line: it stands with the word before it', async () => {
    const analysis = { available: true, tokens: [tokenFixture(), particleFixture(), symbolFixture()], grammar: [] }
    await render(withLang(<SentenceBreakdown analysis={analysis} t={T} layout="rows" onTokenClick={vi.fn()} />))
    const keep = document.querySelector('.bkd-line .bkd-keep')
    expect(keep).not.toBeNull()
    expect(keep.textContent).toBe('は。')
    expect(keep.parentElement.classList.contains('bkd-line')).toBe(true)
  })

  it('an ending rides its word as a tag and takes no number (plan 160)', async () => {
    const MASHITA = { pattern: '〜ました／〜ませんでした', level: 'N5', raw_id: 'grammar_N5_〜ました', kind: 'pattern',
      start: 5, end: 8, segments: [[5, 8]], meaning: { en: 'polite past', fr: 'passé poli' } }
    const analysis = {
      available: true,
      grammar: [{ ...WA, start: 2, end: 3, segments: [[2, 3]] }, MASHITA],
      tokens: [tokenFixture(), particleFixture({ grammar: [WA] }), ...runFixture({ spanEnd: false, glossed: false })],
    }
    await render(withLang(<SentenceBreakdown analysis={analysis} t={T} layout="rows" onTokenClick={vi.fn()} onGrammarOpen={vi.fn()} />))
    const rows = document.querySelectorAll('.bkd-row')
    expect(rows[1].querySelector('.bkd-row__ending').textContent).toBe('＋ました')
    expect(rows[1].getAttribute('aria-label')).toContain('ました : passé poli')
    expect([...document.querySelectorAll('.bkd-point__pattern')].map(p => p.textContent)).toEqual(['は'])
    expect(document.querySelectorAll('.bkd-frame')).toHaveLength(1)
  })

  // Plan 160: 〜てはいけません's いけ has no card (it is no 行く "to go"),
  // and a word a construction is written on with no card of its own is
  // the construction's -- no row, no off-deck rule on the line.
  it("a construction's own words are its card's, never rows of their own", async () => {
    const TEWA = { pattern: '〜てはいけません', level: 'N5', raw_id: 'grammar_N5_〜てはいけません', kind: 'pattern',
      start: 2, end: 9, segments: [[2, 9]], meaning: { en: 'must not do', fr: 'il est interdit de' } }
    const hanashi = tokenFixture({ surface: '話し', start: 0, end: 2, pos: 'verb', reading: 'はなし', furigana: [{ text: '話', reading: 'はな' }, { text: 'し' }] })
    const analysis = {
      available: true, grammar: [TEWA],
      tokens: [
        hanashi,
        particleFixture({ surface: 'て', start: 2, end: 3, furigana: [{ text: 'て' }], reading: 'て', grammar: [TEWA] }),
        particleFixture({ surface: 'は', start: 3, end: 4, furigana: [{ text: 'は' }], reading: 'わ', grammar: [TEWA] }),
        particleFixture({ surface: 'いけ', start: 4, end: 6, furigana: [{ text: 'いけ' }], reading: 'いけ', pos: 'verb', grammar: [TEWA] }),
        particleFixture({ surface: 'ませ', start: 6, end: 8, furigana: [{ text: 'ませ' }], reading: 'ませ', pos: 'auxiliary', grammar: [TEWA] }),
        particleFixture({ surface: 'ん', start: 8, end: 9, furigana: [{ text: 'ん' }], reading: 'ん', pos: 'auxiliary', grammar: [TEWA] }),
      ],
    }
    await render(withLang(<SentenceBreakdown analysis={analysis} t={T} layout="rows" onTokenClick={vi.fn()} onGrammarOpen={vi.fn()} />))
    expect([...document.querySelectorAll('.bkd-row__word')].map(w => w.textContent)).toEqual(['話し'])
    expect(document.body.textContent).not.toContain('わ')
    const card = document.querySelector('.bkd-point')
    expect(card.querySelector('.bkd-point__gloss').textContent).toBe('il est interdit de')
    expect([...card.querySelectorAll('.anl-part')].map(p => p.textContent)).toEqual(['話し', 'て', 'は', 'いけません'])
    // いけ reads as the rule's, not as a word the course lacks.
    const ike = [...document.querySelectorAll('.bkd-line .bkd-tok')].find(el => el.textContent === 'いけ')
    expect(ike.classList.contains('bkd-tok--particle')).toBe(true)
  })

  // ── The light (plan 095) ───────────────────────────────────────
  // Where a point sits on the sentence: the words it is written on
  // light while its chip is hovered or focused, a two-part point
  // lights its two words and not the clause between, and the last
  // point pressed stays lit once the pointer has left.
  const settle = (ms = 30) => new Promise(r => setTimeout(r, ms))
  const hover = el => el.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }))
  const leave = el => el.dispatchEvent(new MouseEvent('mouseout', { bubbles: true }))
  const litSurfaces = () => [...document.querySelectorAll('.bkd-line .bkd-tok--lit')].map(el => el.textContent)

  // 駅から家まで歩きました。 as the local tier cuts it, から〜まで written
  // on から and まで, with the 家 between them in neither piece.
  function karaMade() {
    const KARA_MADE = { pattern: 'から〜まで', level: 'N5', raw_id: 'grammar_N5_から〜まで', kind: 'pattern', start: 1, end: 6, segments: [[1, 3], [4, 6]] }
    return {
      point: KARA_MADE,
      analysis: {
        available: true, text: '駅から家まで歩きました。', grammar: [KARA_MADE],
        tokens: [
          tokenFixture({ surface: '駅', start: 0, end: 1, reading: 'えき', furigana: [{ text: '駅', reading: 'えき' }] }),
          particleFixture({ surface: 'から', start: 1, end: 3, reading: 'から', furigana: [{ text: 'から' }], grammar: [KARA_MADE] }),
          tokenFixture({ surface: '家', start: 3, end: 4, reading: 'いえ', furigana: [{ text: '家', reading: 'いえ' }] }),
          particleFixture({ surface: 'まで', start: 4, end: 6, reading: 'まで', furigana: [{ text: 'まで' }], grammar: [KARA_MADE] }),
          tokenFixture({ surface: '歩き', start: 6, end: 8, reading: 'あるき', pos: 'verb', furigana: [{ text: '歩', reading: 'ある' }, { text: 'き' }] }),
        ],
      },
    }
  }

  it('hovering a card lights the words its point is written on, and only those', async () => {
    const { analysis } = karaMade()
    await render(withLang(<SentenceBreakdown analysis={analysis} layout="rows" t={T} onTokenClick={vi.fn()} onGrammarOpen={vi.fn()} />))
    expect(litSurfaces()).toEqual([])
    const chip = document.querySelector('.bkd-point')
    hover(chip)
    await settle()
    expect(litSurfaces()).toEqual(['から', 'まで'])
    expect(chip.classList.contains('bkd-point--lit')).toBe(true)
    leave(chip)
    await settle()
    expect(litSurfaces()).toEqual([])
    expect(chip.classList.contains('bkd-point--lit')).toBe(false)
  })

  it('focusing the card lights it for the keyboard, and pressing it keeps the light after the pointer leaves', async () => {
    const { analysis } = karaMade()
    const onGrammarOpen = vi.fn()
    await render(withLang(<SentenceBreakdown analysis={analysis} layout="rows" t={T} onTokenClick={vi.fn()} onGrammarOpen={onGrammarOpen} />))
    // Plan 096: the whole card takes the focus -- it is the button.
    const door = document.querySelector('.bkd-point')
    expect(door.tagName).toBe('BUTTON')
    door.focus()
    await settle()
    expect(litSurfaces()).toEqual(['から', 'まで'])
    door.click()
    door.blur()
    await settle()
    expect(onGrammarOpen).toHaveBeenCalledTimes(1)
    // Picked: lit with nothing hovered or focused.
    expect(litSurfaces()).toEqual(['から', 'まで'])
    expect(document.querySelector('.bkd-point').classList.contains('bkd-point--lit')).toBe(true)
  })

  it('a new sentence arrives with nothing lit', async () => {
    const { analysis } = karaMade()
    function Host() {
      const [a, setA] = useState(analysis)
      return (
        <>
          <button type="button" className="next" onClick={() => setA({ ...analysis, text: 'again' })}>next</button>
          <SentenceBreakdown analysis={a} layout="rows" t={T} onTokenClick={vi.fn()} onGrammarOpen={vi.fn()} />
        </>
      )
    }
    await render(withLang(<Host />))
    document.querySelector('.bkd-point').click()
    await settle()
    expect(litSurfaces()).toEqual(['から', 'まで'])
    document.querySelector('.next').click()
    await settle()
    expect(litSurfaces()).toEqual([])
  })

  it("the marker's card lights that particle in the line", async () => {
    const wa = { ...WA, start: 2, end: 3, segments: [[2, 3]] }
    const analysis = {
      available: true, grammar: [wa],
      tokens: [tokenFixture(), particleFixture({ grammar: [wa] })],
    }
    await render(withLang(<SentenceBreakdown analysis={analysis} layout="rows" t={T} onTokenClick={vi.fn()} onGrammarOpen={vi.fn()} />))
    const card = document.querySelector('.bkd-point')
    hover(card)
    await settle()
    expect(litSurfaces()).toEqual(['は'])
    leave(card)
    await settle()
    expect(litSurfaces()).toEqual([])
  })

  // ── The rules, carded (plans 095 and 160) ────────────────────
  // One card per rule under the word rows: its number, the pattern, its
  // gloss and level, the words it is made of, and -- once bought -- the
  // model's line on what it does here. A door and a light.
  it('lists each construction with its gloss, its level and the words it is made of', async () => {
    const { analysis, point } = karaMade()
    const glossed = { ...analysis, grammar: [{ ...point, meaning: { en: 'from … to …', fr: 'de … à …' } }] }
    await render(withLang(<SentenceBreakdown analysis={glossed} layout="rows" t={T} onTokenClick={vi.fn()} onGrammarOpen={vi.fn()} />))
    const points = document.querySelector('.bkd-points')
    expect(points).not.toBeNull()
    expect(before(document.querySelector('.bkd-rows'), points)).toBe(true)
    const row = points.querySelector('.bkd-point')
    expect(row.querySelector('.bkd-point__pattern').textContent).toBe('から〜まで')
    expect(row.querySelector('.bkd-point__gloss').textContent).toBe('de … à …')
    expect(row.querySelector('.bkd-point__lvl').textContent).toBe('N5')
    // Its words, after the word it attaches to: 駅 + から + まで.
    expect([...row.querySelectorAll('.anl-part')].map(p => p.textContent)).toEqual(['駅', 'から', 'まで'])
    expect(row.querySelector('.bkd-point__note')).toBeNull()
    expect(points.querySelectorAll('.bkd-point')).toHaveLength(1)
  })

  it('a rule of one word names no parts, unless a word stands before it to attach to', async () => {
    const SUGIRU = { pattern: '〜すぎる', level: 'N4', raw_id: 'grammar_N4_〜すぎる', kind: 'pattern', start: 2, end: 4, segments: [[2, 4]] }
    const analysis = {
      available: true, text: '食べすぎた。', grammar: [SUGIRU],
      tokens: [
        tokenFixture({ surface: '食べ', start: 0, end: 2, pos: 'verb', reading: 'たべ', furigana: [{ text: '食', reading: 'た' }, { text: 'べ' }] }),
        particleFixture({ surface: 'すぎ', start: 2, end: 4, pos: 'verb', reading: 'すぎ', furigana: [{ text: 'すぎ' }], grammar: [SUGIRU] }),
      ],
    }
    await render(withLang(<SentenceBreakdown analysis={analysis} layout="rows" t={T} onTokenClick={vi.fn()} onGrammarOpen={vi.fn()} />))
    expect(document.querySelector('.bkd-point__pattern').textContent).toBe('〜すぎる')
    expect([...document.querySelectorAll('.bkd-point .anl-part')].map(p => p.textContent)).toEqual(['食べ', 'すぎ'])
    // The same rule after a word with no card: its own name, no parts.
    expect(partsOf(SUGIRU, { tokens: [{ ...analysis.tokens[0], vocab_match: null }, analysis.tokens[1]] })).toHaveLength(1)
  })

  it('a noted point prints its line, opens its sheet, and lights its words; a blank note is no note', async () => {
    const { analysis, point } = karaMade()
    const noted = { ...analysis, grammar: [{ ...point, note: 'From the station to the house: the two ends of the walk.' }], explanation: 'A walk.' }
    const onGrammarOpen = vi.fn()
    await render(withLang(<SentenceBreakdown analysis={noted} layout="rows" t={T} onTokenClick={vi.fn()} onGrammarOpen={onGrammarOpen} />))
    const points = document.querySelector('.bkd-points')
    expect(before(points, document.querySelector('.prose__ai'))).toBe(true)
    const row = points.querySelector('.bkd-point')
    expect(row.querySelector('.bkd-point__note').textContent).toBe('From the station to the house: the two ends of the walk.')
    hover(row)
    await settle()
    expect(litSurfaces()).toEqual(['から', 'まで'])
    expect(row.classList.contains('bkd-point--lit')).toBe(true)
    row.click()
    expect(onGrammarOpen).toHaveBeenCalledTimes(1)
    expect(onGrammarOpen.mock.calls[0][0].raw_id).toBe('grammar_N5_から〜まで')
    document.body.innerHTML = ''
    await render(withLang(<SentenceBreakdown analysis={{ ...analysis, grammar: [{ ...point, note: '   ' }] }} layout="rows" t={T} onTokenClick={vi.fn()} onGrammarOpen={vi.fn()} />))
    expect(document.querySelector('.bkd-point__note')).toBeNull()
  })

  // ── The explanation as an option (plan 095) ───────────────────
  it('offers Explain under the rows until an explanation exists, and says when it is on its way or failed', async () => {
    const { analysis } = karaMade()
    const onExplain = vi.fn()
    await render(withLang(<SentenceBreakdown analysis={analysis} layout="rows" t={T} onTokenClick={vi.fn()} onGrammarOpen={vi.fn()} onExplain={onExplain} />))
    const button = document.querySelector('.bkd__explain button')
    expect(button.textContent).toBe('Explain')
    expect(document.querySelector('.prose__ai')).toBeNull()
    button.click()
    expect(onExplain).toHaveBeenCalledTimes(1)

    document.body.innerHTML = ''
    await render(withLang(<SentenceBreakdown analysis={analysis} layout="rows" t={T} onTokenClick={vi.fn()} onGrammarOpen={vi.fn()} onExplain={onExplain} explaining />))
    expect(document.querySelector('.bkd__explain button').disabled).toBe(true)
    expect(document.querySelector('.bkd__explain button').textContent).toBe('Explaining…')

    document.body.innerHTML = ''
    await render(withLang(<SentenceBreakdown analysis={analysis} layout="rows" t={T} onTokenClick={vi.fn()} onGrammarOpen={vi.fn()} onExplain={onExplain} explainError="It did not come through." />))
    expect(document.querySelector('.bkd__explain-hint').textContent).toBe('It did not come through.')

    document.body.innerHTML = ''
    await render(withLang(<SentenceBreakdown analysis={{ ...analysis, explanation: 'A walk.' }} layout="rows" t={T} onTokenClick={vi.fn()} onGrammarOpen={vi.fn()} onExplain={onExplain} />))
    expect(document.querySelector('.bkd__explain')).toBeNull()
    expect(document.querySelector('.prose__ai').textContent).toBe('A walk.')
  })

  it('without an explain action there is no button, as before', async () => {
    const { analysis } = karaMade()
    await render(withLang(<SentenceBreakdown analysis={analysis} layout="rows" t={T} onTokenClick={vi.fn()} onGrammarOpen={vi.fn()} />))
    expect(document.querySelector('.bkd__explain')).toBeNull()
  })

  it('a particle the model bound to its word is its card, not the tail of the word\'s row', async () => {
    const onGrammarOpen = vi.fn()
    const onTokenClick = vi.fn()
    const analysis = {
      available: true,
      grammar: [{ ...WA, start: 2, end: 3, segments: [[2, 3]] }],
      tokens: [
        tokenFixture({ surface: '今日', span_end: 1 }),
        particleFixture({ grammar: [WA] }),
      ],
    }
    await render(withLang(
      <SentenceBreakdown
        analysis={analysis} t={T} layout="rows"
        onTokenClick={onTokenClick} onGrammarOpen={onGrammarOpen}
      />
    ))
    const rows = document.querySelectorAll('.bkd-row')
    expect(rows).toHaveLength(1)
    expect(rows[0].querySelector('.bkd-row__word').textContent).toBe('今日')
    rows[0].click()
    expect(onTokenClick).toHaveBeenCalledTimes(1)
    document.querySelector('.bkd-point').click()
    expect(onGrammarOpen).toHaveBeenCalledTimes(1)
    expect(onGrammarOpen.mock.calls[0][0].raw_id).toBe('grammar_N5_は')
  })

  it('the cards are the markers and the constructions in the sentence\'s order; an ending is neither', async () => {
    const TEKARA = { pattern: '〜てから', level: 'N5', raw_id: 'grammar_N5_〜てから', kind: 'pattern', start: 0, end: 1, segments: [[0, 1]] }
    const analysis = {
      available: true,
      grammar: [{ ...WA, start: 2, end: 3, segments: [[2, 3]] }, { ...MASU, start: 8, end: 11 }, TEKARA],
      tokens: [tokenFixture(), particleFixture({ grammar: [WA] })],
    }
    await render(withLang(
      <SentenceBreakdown analysis={analysis} t={T} layout="rows" onTokenClick={() => {}} onGrammarOpen={() => {}} />
    ))
    const listed = [...document.querySelectorAll('.bkd-point__pattern')]
    expect(listed.map(c => c.textContent)).toEqual(['〜てから', 'は'])
    expect([...document.querySelectorAll('.bkd-point .anl-num')].map(n => n.textContent)).toEqual(['1', '2'])
  })

  it('leaves the cards as text when a screen has nowhere to open a point', async () => {
    const analysis = {
      available: true,
      grammar: [{ ...WA, start: 2, end: 3, segments: [[2, 3]] }],
      tokens: [tokenFixture(), particleFixture({ grammar: [WA] })],
    }
    await render(withLang(
      <SentenceBreakdown analysis={analysis} t={T} layout="rows" onTokenClick={() => {}} />
    ))
    expect(document.querySelector('.bkd-point').tagName).toBe('DIV')
  })

  it('a word row carries the endings written on it, once each', () => {
    const PAST = { pattern: 'た形 〜た', level: 'N5', raw_id: 'grammar_N5_た形 〜た', kind: 'pattern', start: 7, end: 8, segments: [[7, 8]] }
    const MASHITA = { pattern: '〜ました／〜ませんでした', level: 'N5', raw_id: 'grammar_N5_〜ました', kind: 'pattern', start: 5, end: 8, segments: [[5, 8]] }
    const rows = wordRowsOf({ tokens: runFixture({ spanEnd: false, glossed: false }), grammar: [PAST, MASHITA] })
    expect(rows).toHaveLength(1)
    expect(rows[0].endings.map(p => p.pattern)).toEqual(['た形 〜た', '〜ました／〜ませんでした'])
  })
})
