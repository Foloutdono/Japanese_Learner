import { describe, it, expect } from 'vitest'
import { askWords, askContext, askHistory, askResetsAt, askTarget, MAX_HISTORY } from './ask'

describe('what a question carries (plan 131)', () => {
  it('reads the breakdown as words with their readings and meanings', () => {
    const analysis = {
      tokens: [
        { surface: '電気', reading: 'でんき', meaning: 'electricity, light' },
        { surface: 'を', reading: 'を', meaning: 'object marker' },
        { surface: '。', reading: '。' },
        { surface: '行きます', reading: 'いきます', vocab_match: { entry: { meaning: 'to go' } } },
      ],
    }
    expect(askWords(analysis)).toEqual([
      '電気 (でんき): electricity, light',
      'を: object marker',
      '行きます (いきます): to go',
    ])
    expect(askWords(null)).toEqual([])
    expect(askWords({ tokens: Array.from({ length: 60 }, (_, i) => ({ surface: `語${i}`, meaning: 'w' })) })).toHaveLength(40)
  })

  it('bounds every field to the server\'s own limits', () => {
    const ctx = askContext({ sentence: 'あ'.repeat(2000), review: 'r'.repeat(3000), translation: '  Hi.  ', level: 'N5' })
    expect(ctx.sentence).toHaveLength(1200)
    expect(ctx.review).toHaveLength(1500)
    expect(ctx.translation).toBe('Hi.')
    expect(ctx.answer).toBe('')
    expect(ctx.words).toEqual([])
  })

  it('sends back only answered exchanges, the last few', () => {
    const thread = [
      ...Array.from({ length: 6 }, (_, i) => ({ question: `q${i}`, answer: `a${i}`, state: 'done' })),
      { question: 'off', answer: null, state: 'off' },
      { question: 'now', state: 'pending' },
    ]
    const history = askHistory(thread)
    expect(history).toHaveLength(MAX_HISTORY)
    expect(history.at(-1)).toEqual({ question: 'q5', answer: 'a5' })
  })

  it('reads when a spent day comes back', () => {
    expect(askResetsAt('Daily limit of 40 questions reached; resets 2026-09-26T22:00Z')).toBe('2026-09-26T22:00Z')
    expect(askResetsAt('nope')).toBeNull()
    expect(askResetsAt(undefined)).toBeNull()
  })
})

describe('which thread the panel shows (plan 131)', () => {
  it('is the reopened line when there is one, else the exercise on the stage', () => {
    const now = { key: 7, base: { sentence: '山へ行きます。', answer: 'yama' }, analysis: null, open: false }
    expect(askTarget(null, now)).toMatchObject({ key: 7, open: false, context: { sentence: '山へ行きます。', answer: 'yama' } })
    const opened = { key: 3, jp: '駅で会いました。', translation: 'We met.', analysis: { tokens: [{ surface: '駅', reading: 'えき', meaning: 'station' }] } }
    expect(askTarget(opened, now)).toMatchObject({ key: 3, open: true, context: { sentence: '駅で会いました。', words: ['駅 (えき): station'] } })
    const committed = { ...opened, ask: { sentence: '駅で会いました。', answer: 'eki de', level: 'N5' } }
    expect(askTarget(committed, now).context).toMatchObject({ answer: 'eki de', level: 'N5' })
  })
})
