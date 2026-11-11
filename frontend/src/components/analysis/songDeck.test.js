import { describe, it, expect } from 'vitest'
import { lineReading, songWords, songWordRows, songLines, songDeckName } from './songDeck'

// ── 歌 — what the song sheet reads off a Passage (plan 215) ──
const card = (raw_id, level = 'N5') => ({ raw_id, level, entry: {}, stats: { status: 'new' } })
const tok = (surface, start, reading, pos, vocab_match = null) => ({
  surface, start, end: start + surface.length, reading, pos, vocab_match, grammar: [],
})

// 君の名前を呼ぶよ — two words with a card, a particle between them.
const CALL = {
  text: '君の名前を呼ぶよ', available: true, grammar: [],
  tokens: [
    tok('君', 0, 'きみ', 'noun', card('vocab_N5_君_きみ')),
    tok('の', 1, 'の', 'particle'),
    tok('名前', 2, 'なまえ', 'noun', card('vocab_N5_名前_なまえ')),
    tok('を', 4, 'を', 'particle'),
    tok('呼ぶ', 5, 'よぶ', 'verb', card('vocab_N4_呼ぶ_よぶ', 'N4')),
    tok('よ', 7, 'よ', 'particle'),
  ],
}
// ギターを弾く、 夜 — katakana kept, the comma and the space the line's own,
// and a pool word (no level).
const GUITAR = {
  text: 'ギターを弾く、 夜', available: true, grammar: [],
  tokens: [
    tok('ギター', 0, 'ぎたー', 'noun', card('vocab_N4_ギター_ぎたー', 'N4')),
    tok('を', 3, 'を', 'particle'),
    tok('弾く', 4, 'ひく', 'verb', { ...card('vocab_jmdict_42'), level: null, pool: true }),
    tok('、', 6, '', 'punctuation'),
    tok('夜', 8, 'よる', 'noun', card('vocab_N5_夜_よる')),
  ],
}
const KANA = {
  text: 'らららら', available: true, grammar: [],
  tokens: [tok('らららら', 0, 'らららら', 'interjection')],
}
const ENGLISH = { text: 'Baby I love you', foreign: true, tokens: [], grammar: [] }

describe('a line as it is sung', () => {
  it('reads each word with a kanji by its reading, the rest as written', () => {
    expect(lineReading(CALL)).toBe('きみのなまえをよぶよ')
    expect(lineReading(GUITAR)).toBe('ギターをひく、 よる')
  })

  it('reads the tokens in order when they carry no offsets', () => {
    const bare = { text: '君の', tokens: [{ surface: '君', reading: 'きみ' }, { surface: 'の', reading: 'の' }] }
    expect(lineReading(bare)).toBe('きみの')
  })
})

describe('the song\'s words', () => {
  it('takes every word with a card once, in the order it is first sung', () => {
    expect(songWords([CALL, GUITAR, CALL]).map(w => w.raw_id)).toEqual([
      'vocab_N5_君_きみ', 'vocab_N5_名前_なまえ', 'vocab_N4_呼ぶ_よぶ',
      'vocab_N4_ギター_ぎたー', 'vocab_jmdict_42', 'vocab_N5_夜_よる',
    ])
  })

  it('posts the shape the deck takes, a pool word without a level', () => {
    const words = songWords([GUITAR])
    expect(words[0]).toEqual({ source: 'vocab', level: 'N4', raw_id: 'vocab_N4_ギター_ぎたー' })
    expect(words[1]).toEqual({ source: 'vocab', level: null, raw_id: 'vocab_jmdict_42' })
  })

  it('takes nothing from a line that is not Japanese or could not be read', () => {
    expect(songWords([ENGLISH, { ...CALL, available: false }])).toEqual([])
  })
})

describe('the song\'s lines', () => {
  it('turns each line with something to read over onto its reading, a chorus once', () => {
    expect(songLines([CALL, GUITAR, CALL])).toEqual([
      { front: '君の名前を呼ぶよ', back: 'きみのなまえをよぶよ', notes: '' },
      { front: 'ギターを弾く、 夜', back: 'ギターをひく、 よる', notes: '' },
    ])
  })

  it('leaves out a line in kana throughout, and one that is not Japanese', () => {
    expect(songLines([KANA, ENGLISH])).toEqual([])
  })

  it('keeps the translation Explain bought in the notes', () => {
    const explained = { ...CALL, translation: ' I call your name ' }
    expect(songLines([explained])[0].notes).toBe('I call your name')
  })
})

describe('the name the sheet proposes', () => {
  it('is the video\'s title, else the first line, cut to a name\'s length', () => {
    expect(songDeckName('  夜に駆ける  ', [CALL])).toBe('夜に駆ける')
    expect(songDeckName('', [ENGLISH, CALL])).toBe('君の名前を呼ぶよ')
    expect(songDeckName(null, [])).toBe('')
    const long = songDeckName('あ'.repeat(80), [])
    expect(long).toHaveLength(60)
    expect(long.endsWith('…')).toBe(true)
  })
})

// ── The keep sheet's chips (plan 263) ──
describe('the words the keep sheet offers', () => {
  it('names each word by its dictionary spelling and reading, once', () => {
    const mastered = { ...CALL, tokens: CALL.tokens.map(tk => (tk.surface === '名前'
      ? { ...tk, vocab_match: { ...card('vocab_N5_名前_なまえ'), entry: { kanji: '名前', kana: 'なまえ' }, stats: { status: 'mastered' } } }
      : tk)) }
    const rows = songWordRows([mastered, mastered])
    expect(rows.map(w => w.ref.raw_id)).toEqual(['vocab_N5_君_きみ', 'vocab_N5_名前_なまえ', 'vocab_N4_呼ぶ_よぶ'])
    expect(rows[1]).toMatchObject({ name: '名前', reading: 'なまえ', known: true })
    // A word the learner is still on is offered ticked.
    expect(rows[0].known).toBe(false)
  })

  it('posts the same refs songWords does', () => {
    expect(songWordRows([CALL, GUITAR]).map(w => w.ref)).toEqual(songWords([CALL, GUITAR]))
  })
})
