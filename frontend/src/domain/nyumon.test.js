import { describe, it, expect } from 'vitest'
import {
  INTRO_SENTENCE, INTRO_CELLS, INTRO_STEPS, INTRO_PHRASE, GOJUON, GOJUON_SIGNS, TABLE_TARGET,
  scriptOf, phraseOrder,
} from './nyumon'

// 入門 (plan 170): the one sentence the six screens hang on, and the
// table screen 3 asks the learner to read.

describe('入門 content', () => {
  it('reads the sentence as the three scripts it mixes', () => {
    const by = s => INTRO_CELLS.filter(c => c.script === s).map(c => c.ch).join('')
    expect(by('hira')).toBe('でをみます')
    expect(by('kata')).toBe('コーヒー')
    expect(by('kanji')).toBe('駅飲')
    expect(scriptOf('。')).toBeNull()
    expect(INTRO_CELLS.map(c => c.ch).join('')).toBe(INTRO_SENTENCE)
  })

  it('holds the 46 signs of the basic table, the asked one where row k meets column e', () => {
    expect(GOJUON_SIGNS).toHaveLength(46)
    expect(new Set(GOJUON_SIGNS.map(([kana]) => kana)).size).toBe(46)
    const row = GOJUON.find(r => r.c === TABLE_TARGET.row)
    expect(row.cells[TABLE_TARGET.col]).toEqual([TABLE_TARGET.kana, TABLE_TARGET.romaji])
  })

  it('writes the sentence out of its words, and a swap keeps the verb last', () => {
    expect(INTRO_PHRASE.map(p => p.jp + (p.tag ?? '')).join('') + '。').toBe(INTRO_SENTENCE)
    expect(phraseOrder(true).map(p => p.jp)).toEqual(['コーヒー', '駅', '飲みます'])
    expect(phraseOrder(false).at(-1).verb).toBe(true)
  })

  it('has six screens', () => {
    expect(INTRO_STEPS).toHaveLength(6)
  })
})
