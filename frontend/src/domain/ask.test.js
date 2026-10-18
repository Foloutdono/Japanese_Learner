import { describe, it, expect } from 'vitest'
import { gapForm, holeText, askWords, askContext, askHistory, askResetsAt, askTarget, tourAsk, askSuggestions, MAX_HISTORY, SUGGESTIONS } from './ask'
import fr from '../locales/fr/index.js'
import en from '../locales/en/index.js'
import tours from '../testing/grammarTour.json'

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

describe('the tour’s asking (plan 204)', () => {
  const KA = tours.ka
  const POINT = { raw_id: 'grammar_N5_か', level: 'N5', pattern: 'か', meaning: 'question **marker**', tour: KA }

  it('is sealed on the look and the guess, whose answer it would give', () => {
    for (const stop of ['look', 'guess']) {
      const a = tourAsk(POINT, { stop })
      expect(a.open).toBe(false)
      expect(a.key).toBe(`tour:grammar_N5_か:${stop}`)
    }
  })

  it('opens on the rule found and the results, about the examples', () => {
    for (const stop of ['found', 'terminus']) {
      const a = tourAsk(POINT, { stop })
      expect(a.open).toBe(true)
      expect(a.context.sentence).toBe(KA.look.map(ex => ex.jp).join('\n'))
      expect(a.context.point).toBe('か — question marker')
      expect(a.context.level).toBe('N5')
      expect(a.context.review).not.toContain('**')
    }
  })

  it('opens on a twist once it is answered, with the pick and the why', () => {
    const twist = KA.twists[0]
    const wrong = twist.choices.findIndex(c => !c.correct)
    const at = { stop: 'twist-0', twist, twistPick: wrong, twistDone: false }
    expect(tourAsk(POINT, at).open).toBe(false)
    const a = tourAsk(POINT, { ...at, twistDone: true })
    expect(a.open).toBe(true)
    expect(a.key).toBe('tour:grammar_N5_か:twist-0')
    expect(a.context.sentence).toBe(twist.jp)
    expect(a.context.answer).toBe(twist.choices[wrong].text)
  })

  it('opens on the scene once its reply is said', () => {
    expect(tourAsk(POINT, { stop: 'scene', sceneDone: false }).open).toBe(false)
    const a = tourAsk(POINT, { stop: 'scene', sceneDone: true, scenePick: 0 })
    expect(a.open).toBe(true)
    expect(a.context.sentence).toContain(KA.scene.lines[0].jp)
    expect(a.context.sentence).toContain(KA.scene.ask.choices.find(c => c.correct).jp)
  })

  it('keeps a thread per quiz question, its sentence answered', () => {
    KA.quiz.forEach((q, qi) => {
      const a = tourAsk(POINT, { stop: 'quiz', qi, quizPick: 0, quizDone: true })
      expect(a.key).toBe(`tour:grammar_N5_か:quiz-${qi}`)
      expect(a.open).toBe(true)
      expect(a.context.sentence).toBeTruthy()
      expect(a.context.sentence).not.toContain('＿')
      expect(tourAsk(POINT, { stop: 'quiz', qi, quizDone: false }).open).toBe(false)
    })
  })

  it('keeps two points’ threads apart', () => {
    expect(tourAsk({ ...POINT, raw_id: 'grammar_N5_も' }, { stop: 'found' }).key).not.toBe(tourAsk(POINT, { stop: 'found' }).key)
  })
})

describe('the questions offered', () => {
  const words = ['父 (ちち): father', 'は: topic marker', '車 (くるま): car', 'で: by means of', '会社 (かいしゃ): company', 'へ: towards', '行きます (いきます): to go']
  const ctx = askContext({ sentence: '父は車で会社へ行きます。', translation: 'My father goes to the office by car.' })

  it('asks about the sentence\'s particle, its first kanji word and its register', () => {
    expect(askSuggestions({ ...ctx, words }, en)).toEqual([
      'Why は and not が?',
      'Another example with 父?',
      'How would I say it more politely?',
    ])
    // In the learner's language.
    expect(askSuggestions({ ...ctx, words }, fr)[0]).toBe('Pourquoi は et pas が ?')
  })

  it('puts the point before the words, and the contrast it has for へ', () => {
    const out = askSuggestions({ ...ctx, point: '〜へ行きます — going to', words: ['会社 (かいしゃ): company', 'へ: towards'] }, en)
    expect(out).toEqual(['Why へ and not に?', 'How is 〜へ行きます used?', 'Another example with 会社?'])
  })

  it('offers nothing already asked, and never more than SUGGESTIONS', () => {
    const out = askSuggestions({ ...ctx, words }, en, { asked: ['Why は and not が?', 'Another example with 父?'] })
    expect(out).toEqual(['How would I say it more politely?', 'And casually, between friends?'])
    expect(askSuggestions({ ...ctx, words, point: 'x' }, en).length).toBe(SUGGESTIONS)
    // A typed question is the offer it matches, whatever its spaces and case.
    expect(askSuggestions({ ...ctx, words }, fr, { asked: ['pourquoi は et pas が ?'] })[0]).toBe('Un autre exemple avec 父\u00A0?')
  })

  it('asks about the text\'s answer in comprehension, and not its register', () => {
    const out = askSuggestions(askContext({ sentence: '駅で待ちました。', review: 'Where?' }), en, { text: true })
    expect(out).toEqual(['Why is this the right answer?', 'Where does the text say it?'])
  })

  it('has its register questions to offer without a breakdown', () => {
    expect(askSuggestions(ctx, en)).toEqual(['How would I say it more politely?', 'And casually, between friends?'])
  })
})

describe('what stands in a gap once it is answered', () => {
  it('is the sentence\'s own text, not the pattern', () => {
    const right = { pattern: 'から〜まで', correct: true }
    expect(holeText({ fill: [{ text: 'から' }] }, right)).toBe('から')
    expect(holeText({ fill: [{ text: 'てしま' }] }, { pattern: '〜てしまう' })).toBe('てしま')
  })
  it('falls back to the bare pattern for a payload without one', () => {
    expect(holeText({}, { pattern: '〜ために' })).toBe('ために')
  })
  it('falls back to the option\'s form before the pattern (plan 254)', () => {
    expect(holeText({}, { pattern: 'この／その／あの／どの', form: 'あの' })).toBe('あの')
  })
})

describe('what a gap question\'s option prints (plan 254)', () => {
  it('is the form its rule takes in the hole, not the rule whole', () => {
    expect(gapForm({ pattern: 'これ／それ／あれ／どれ', form: 'あれ' })).toBe('あれ')
  })
  it('is the bare pattern for a payload without a form', () => {
    expect(gapForm({ pattern: '〜てください' })).toBe('てください')
  })
})
