import { describe, it, expect } from 'vitest'
import { readRule } from './ruleReading'

// The form's preview of a written grammar card's reading -- the same
// rule the server applies (study/grammar_examples.py's _learners_reading,
// held by tests/test_grammar_check.py's WrittenFuriganaTests).

describe('readRule', () => {
  it('reads each kanji run by the reading, the rest as the learner wrote it', () => {
    expect(readRule('〜の中で', '〜のなかで')).toEqual([{ text: '〜の' }, { text: '中', reading: 'なか' }, { text: 'で' }])
    expect(readRule('〜に行く前に', 'にいくまえに')).toEqual([
      { text: '〜に' }, { text: '行', reading: 'い' }, { text: 'く' }, { text: '前', reading: 'まえ' }, { text: 'に' },
    ])
  })

  it('is lenient where a learner is: a typed tilde, the 〜 left out, katakana', () => {
    expect(readRule('~の中で', 'のなかで')).toEqual([{ text: '~の' }, { text: '中', reading: 'なか' }, { text: 'で' }])
    expect(readRule('〜の中で', '～のなかで')[1]).toEqual({ text: '中', reading: 'なか' })
    expect(readRule('〜の中で', 'ノナカデ')[1]).toEqual({ text: '中', reading: 'なか' })
    expect(readRule('〜方', 'カタ')[1]).toEqual({ text: '方', reading: 'カタ' })
  })

  it('is null where the reading does not spell the rule', () => {
    expect(readRule('〜の中で', 'なか')).toBeNull()
    expect(readRule('〜の中で', '〜のnakaで')).toBeNull()
    expect(readRule('〜の中で', '〜の中で')).toBeNull()
    // a kana per kanji at least, as the server's aligner asks
    expect(readRule('〜中心に', '〜ちに')).toBeNull()
    expect(readRule('〜中心に', '〜ちゅうしんに')[1]).toEqual({ text: '中心', reading: 'ちゅうしん' })
  })

  it('is null with nothing to read', () => {
    expect(readRule('〜てから', 'てから')).toBeNull()
    expect(readRule('〜の中で', '  ')).toBeNull()
    expect(readRule('', 'なか')).toBeNull()
  })
})
