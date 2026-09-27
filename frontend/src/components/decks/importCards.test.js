import { describe, it, expect } from 'vitest'
import fr from '../../locales/fr/index.js'
import { columnsFor, exampleText, pairRows, readCards, readHeader, splitRows } from './importCards'

// The grammar structure as GET /api/decks/structures describes it.
const GRAMMAR = {
  key: 'grammar', source: 'grammar', front_key: 'rule', back_key: 'meaning',
  fields: [
    { key: 'rule', kind: 'text', required: true },
    { key: 'meaning', kind: 'text', required: true },
    { key: 'structure', kind: 'text', required: false },
    { key: 'register', kind: 'choice', required: false, options: ['neutral', 'polite', 'casual', 'formal', 'written'] },
    { key: 'explanation', kind: 'long', required: false },
    { key: 'usage', kind: 'long', required: false },
    { key: 'careful', kind: 'long', required: false },
    { key: 'sentences', kind: 'pairs', required: false, parts: ['jp', 'tr'] },
    { key: 'compare', kind: 'pairs', required: false, parts: ['pattern', 'text'] },
  ],
}
const STANDARD = {
  key: 'standard', front_key: 'front', back_key: 'back',
  fields: [{ key: 'front', kind: 'text', required: true }, { key: 'back', kind: 'text', required: true }],
}

describe('splitRows', () => {
  it('splits on the separators and drops empty rows', () => {
    expect(splitRows('a,b\n\n c , d \r\n', ',', '\n')).toEqual([['a', 'b'], ['c', 'd']])
  })

  it('holds a separator, a line break and a quote in a quoted cell', () => {
    expect(splitRows('"a, b","line\nbreak","say ""hi"""\nx,y', ',', '\n'))
      .toEqual([['a, b', 'line\nbreak', 'say "hi"'], ['x', 'y']])
  })

  it('reads an unclosed quote as text', () => {
    expect(splitRows('"a,b', ',', '\n')).toEqual([['"a', 'b']])
  })

  it('takes a separator of more than one character', () => {
    expect(splitRows('a::b||c::d', '::', '||')).toEqual([['a', 'b'], ['c', 'd']])
  })
})

describe('the columns without a header', () => {
  it('are the one-cell fields, the notes, then the first repeatable field', () => {
    const { once, repeat } = columnsFor(GRAMMAR)
    expect(once.map(c => c.key)).toEqual(['rule', 'meaning', 'structure', 'register', 'explanation', 'usage', 'careful', 'notes'])
    expect(repeat).toEqual([{ key: 'sentences', part: 'jp' }, { key: 'sentences', part: 'tr' }])
  })

  it('read a grammar row whole, its sentences in pairs', () => {
    const text = '〜てください\tplease do\tverb て + ください\tpoli\tAsks.\t- Requests\tAn order.\tmy note\t読んでください。\tPlease read.\t書いてください。'
    const { cards, header } = readCards(text, '\t', '\n', GRAMMAR, fr)
    expect(header).toBe(false)
    expect(cards).toEqual([{
      fields: {
        rule: '〜てください', meaning: 'please do', structure: 'verb て + ください', register: 'polite',
        explanation: 'Asks.', usage: '- Requests', careful: 'An order.',
        sentences: [{ jp: '読んでください。', tr: 'Please read.' }, { jp: '書いてください。', tr: '' }],
        compare: [],
      },
      notes: 'my note',
      missing: [],
    }])
  })

  it('reads a standard deck as front, back, notes', () => {
    const { cards } = readCards('水,water,n', ',', '\n', STANDARD, fr)
    expect(cards[0]).toEqual({ fields: { front: '水', back: 'water' }, notes: 'n', missing: [] })
  })

  it('names what a row is missing', () => {
    const { cards } = readCards('〜ために', ',', '\n', GRAMMAR, fr)
    expect(cards[0].missing).toEqual(['meaning'])
  })
})

describe('a header row', () => {
  it('is read in either language and in any order', () => {
    const text = [
      'Sens\tRègle\tExemple\tTraduction\tExemple 2\tTraduction 2\tComparer\tDifférence\tRegistre',
      'à cause de\t〜せいで\t雨のせいで中止。\tÀ cause de la pluie.\t彼のせいだ。\tC’est sa faute.\t〜おかげで\tcause heureuse\tneutre',
    ].join('\n')
    const { cards, header, ignored } = readCards(text, '\t', '\n', GRAMMAR, fr)
    expect(header).toBe(true)
    expect(ignored).toEqual([])
    expect(cards[0].fields).toMatchObject({
      rule: '〜せいで', meaning: 'à cause de', register: 'neutral',
      sentences: [{ jp: '雨のせいで中止。', tr: 'À cause de la pluie.' }, { jp: '彼のせいだ。', tr: 'C’est sa faute.' }],
      compare: [{ pattern: '〜おかげで', text: 'cause heureuse' }],
    })
  })

  it('reports the columns it does not know', () => {
    const { ignored, cards } = readCards('Rule,Meaning,Level\n〜ても,even if,N4', ',', '\n', GRAMMAR, fr)
    expect(ignored).toEqual(['Level'])
    expect(cards[0].fields.rule).toBe('〜ても')
  })

  it('is not a header without the card’s front among its names', () => {
    expect(readHeader(['Sens', 'Notes'], GRAMMAR, fr)).toBeNull()
    expect(readHeader(['〜ても', 'even if'], GRAMMAR, fr)).toBeNull()
  })

  it('takes the old placeholder’s header on a standard deck', () => {
    const { cards, ignored } = readCards('Front, Back, Hint, Notes\n水, water, みず, n', ',', '\n', STANDARD, fr)
    expect(ignored).toEqual(['Hint'])
    expect(cards[0]).toEqual({ fields: { front: '水', back: 'water' }, notes: 'n', missing: [] })
  })
})

describe('the example', () => {
  it('reads back as one whole card, with a separator inside a cell', () => {
    for (const sep of [',', '\t']) {
      const { cards, header } = readCards(exampleText(GRAMMAR, sep, fr, 'fr'), sep, '\n', GRAMMAR, fr)
      expect(header).toBe(true)
      expect(cards).toHaveLength(1)
      expect(cards[0].missing).toEqual([])
      expect(cards[0].fields.sentences).toHaveLength(2)
      expect(cards[0].fields.compare).toHaveLength(1)
      expect(cards[0].fields.usage.split('\n')).toHaveLength(2)
      expect(cards[0].fields.register).toBe('polite')
    }
  })
})

describe('pairRows', () => {
  it('opens an old card’s bare sentences as rows', () => {
    expect(pairRows(['a', { jp: 'b', tr: 'B' }], ['jp', 'tr'])).toEqual([{ jp: 'a', tr: '' }, { jp: 'b', tr: 'B' }])
    expect(pairRows(undefined, ['jp', 'tr'])).toEqual([])
  })
})
