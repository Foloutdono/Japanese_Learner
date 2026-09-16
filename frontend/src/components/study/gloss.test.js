import { describe, it, expect } from 'vitest'
import { mergeSenses } from './gloss'

// ── Senses that say the same thing (plan 089) ─────────────────
// JMdict files a word under several senses, and two of them can carry
// an identical gloss list and differ only by a tag. Printed as they
// come, the dictionary's definition block repeats itself word for word
// under two numerals — 毎月 arrived as "every month · each month ·
// monthly" twice over — which reads as two meanings and is one.

const sense = (number, glossary, ...codes) => ({
  number, glossary, tags: codes.map(code => ({ code, label: code })),
})

describe('mergeSenses', () => {
  it('folds two senses carrying the same glosses into one, tags unioned', () => {
    const [only, ...rest] = mergeSenses([
      sense(1, 'every month, each month, monthly', 'adv', 'common'),
      sense(2, 'every month, each month, monthly', 'adv', 'top3k'),
    ])
    expect(rest).toHaveLength(0)
    expect(only.glossary).toBe('every month, each month, monthly')
    expect(only.tags.map(t => t.code)).toEqual(['adv', 'common', 'top3k'])
    // Both numbers, because the example sentences are nested by sense
    // number: a merged sense has to show the sentences of every sense
    // it absorbed, or the fold hides them.
    expect(only.numbers).toEqual([1, 2])
  })

  it('compares the split list, not the string, so punctuation cannot split a meaning in two', () => {
    // The two decks disagree about the separator, and JMdict is not
    // consistent about the space after it.
    const merged = mergeSenses([
      sense(1, 'to appear, to leave'),
      sense(2, 'To Appear,to leave'),
    ])
    expect(merged).toHaveLength(1)
    expect(merged[0].numbers).toEqual([1, 2])
  })

  it('keeps senses that really differ, in the order they arrived', () => {
    const merged = mergeSenses([
      sense(1, 'to eat'),
      sense(2, 'to live on (e.g. a salary)'),
      sense(3, 'to eat'),
    ])
    expect(merged.map(s => s.glossary)).toEqual(['to eat', 'to live on (e.g. a salary)'])
    expect(merged.map(s => s.numbers)).toEqual([[1, 3], [2]])
  })

  it('never drops a sense whose glosses are its own, whatever its tags', () => {
    const merged = mergeSenses([sense(1, 'to eat', 'v1'), sense(2, 'to drink')])
    expect(merged).toHaveLength(2)
    expect(merged[1].tags).toEqual([])
  })

  it('leaves a sense with nothing to compare on alone', () => {
    // An empty glossary is not a match for another empty one: there is
    // nothing to say they mean the same thing.
    const merged = mergeSenses([sense(1, ''), sense(2, '')])
    expect(merged).toHaveLength(2)
  })

  it('answers an empty list, and a missing one, with an empty list', () => {
    expect(mergeSenses([])).toEqual([])
    expect(mergeSenses(undefined)).toEqual([])
  })

  it('does not touch the senses it was given', () => {
    const input = [sense(1, 'to eat', 'v1'), sense(2, 'to eat', 'vt')]
    mergeSenses(input)
    expect(input[0].tags.map(t => t.code)).toEqual(['v1'])
    expect(input[0].numbers).toBeUndefined()
  })
})
