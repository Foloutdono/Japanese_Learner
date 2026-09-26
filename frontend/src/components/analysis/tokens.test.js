import { describe, it, expect } from 'vitest'
import { tokState, isUnknownToken, isPoolWord } from './tokens'

// ── A word past the course (plan 147) ────────────────────────────
// The breakdown's words the JLPT deck does not teach now carry the
// JMdict pool's card (study/analysis.py's _pool_match): a meaning, an
// id, no level, and `pool`. On the line such a word keeps the off-deck
// rule until the learner takes it up, whatever the tokenizer called it
// -- a な-adjective's stem is "other" and an interjection is no content
// class, and both used to be drawn as scaffolding with no rule at all.
const pool = (pos, status = 'not_started') => ({
  surface: 'x', pos,
  vocab_match: { level: null, raw_id: 'vocab_jmdict_1', pool: true, entry: { kanji: '', kana: 'x', meaning: 'm' }, stats: { status } },
})
const deck = (pos, status) => ({
  surface: 'x', pos,
  vocab_match: { level: 'N5', raw_id: 'vocab_N5_x_x', entry: { kanji: 'x', kana: 'x', meaning: 'm' }, stats: { status } },
})

describe('a pool word on the line', () => {
  it('is off-deck until taken up, whatever its part of speech', () => {
    for (const pos of ['noun', 'other', 'interjection']) {
      expect(tokState(pool(pos))).toBe('offdeck')
    }
    // Before the learner's stats are attached (the pure local tier).
    expect(tokState({ ...pool('noun'), vocab_match: { ...pool('noun').vocab_match, stats: undefined } })).toBe('offdeck')
  })

  it('is the learner\'s word once taken up', () => {
    expect(tokState(pool('noun', 'new'))).toBe('unknown')
    expect(tokState(pool('other', 'learning'))).toBe('learning')
    expect(tokState(pool('interjection', 'mastered'))).toBe('mastered')
  })

  it('leaves the deck words and the scaffolding as they were', () => {
    expect(tokState(deck('noun', 'not_started'))).toBe('unknown')
    expect(tokState({ surface: 'は', pos: 'particle', vocab_match: null })).toBe('particle')
    expect(tokState({ surface: '真っさら', pos: 'other', vocab_match: null })).toBe('particle')
    expect(tokState({ surface: '桃源', pos: 'noun', vocab_match: null })).toBe('offdeck')
  })

  it('counts as unknown for i+1 exactly where the server counts it', () => {
    // Untaken, it is off-deck on the server (attach_user_state).
    expect(isUnknownToken(pool('noun'))).toBe(false)
    expect(isUnknownToken(pool('noun', 'new'))).toBe(true)
    expect(isUnknownToken(pool('noun', 'learning'))).toBe(false)
    expect(isUnknownToken(deck('noun', 'not_started'))).toBe(true)
  })

  it('is told by its `pool` flag alone', () => {
    expect(isPoolWord(pool('noun'))).toBe(true)
    expect(isPoolWord(deck('noun', 'new'))).toBe(false)
    expect(isPoolWord({ surface: 'は' })).toBe(false)
    expect(isPoolWord(null)).toBe(false)
  })
})
