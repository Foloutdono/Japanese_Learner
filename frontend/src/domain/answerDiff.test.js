import { describe, it, expect } from 'vitest'
import {
  diffWords, diffChars, correctionParts, markedCount, isRomajiAnswer,
  refSpans, missMarks, missedWords, markParts, markPieces, joinWords, phrases, quoted, fixMarks, correctionFixes,
} from './answerDiff'

describe('diffWords', () => {
  it('strikes the word in another word\'s place and gives the right one', () => {
    expect(diffWords('koko de tchisai yasumimashou', 'koko de sukoshi yasumimashou.')).toEqual([
      { kind: 'same', text: 'koko', ref: [0, 1] },
      { kind: 'same', text: 'de', ref: [1, 2] },
      { kind: 'miss', given: 'tchisai', right: 'sukoshi', ref: [2, 3] },
      { kind: 'same', text: 'yasumimashou', ref: [3, 4] },
    ])
  })

  it('reads a long vowel left short as a near miss, not a wrong word', () => {
    const segs = diffWords('kuji ni eki de aimasho', 'kuji ni eki de aimashou.')
    expect(segs.at(-1)).toEqual({ kind: 'near', given: 'aimasho', right: 'aimashou', ref: [4, 5] })
    expect(markedCount(segs)).toBe(1)
  })

  it('reads words run together or split apart as the same answer', () => {
    expect(diffWords('mainichi, namae o kakanakerebanarimasen', 'mainichi, namae o kakanakereba narimasen.'))
      .toEqual([
        { kind: 'same', text: 'mainichi', ref: [0, 1] },
        { kind: 'same', text: 'namae', ref: [1, 2] },
        { kind: 'same', text: 'o', ref: [2, 3] },
        { kind: 'same', text: 'kakanakerebanarimasen', ref: [3, 5] },
      ])
  })

  it('takes every spelling of one sound: particles, Kunrei, macrons, n before a labial', () => {
    const segs = diffWords('watashi ha sinbun wo yomimasu', 'watashi wa shimbun o yomimasu.')
    expect(markedCount(segs)).toBe(0)
    expect(markedCount(diffWords('Tōkyō e ikimasu', 'toukyou e ikimasu.'))).toBe(0)
  })

  it('names a word left out and a word added', () => {
    expect(diffWords('koko de yasumimashou', 'koko de sukoshi yasumimashou.'))
      .toContainEqual({ kind: 'missing', right: 'sukoshi', ref: [2, 3] })
    expect(diffWords('koko de totemo sukoshi yasumimashou', 'koko de sukoshi yasumimashou.'))
      .toContainEqual({ kind: 'extra', given: 'totemo', ref: [2, 2] })
  })

  it('keeps a doubled consonant: a dropped っ is a real miss', () => {
    expect(diffWords('kite kudasai', 'kitte kudasai.')[0]).toEqual({ kind: 'miss', given: 'kite', right: 'kitte', ref: [0, 1] })
  })

  it('marks nothing on an answer that is not in romaji', () => {
    expect(isRomajiAnswer('ここで少し')).toBe(false)
    expect(diffWords('ここで少し休みましょう', 'koko de sukoshi yasumimashou.')).toBeNull()
    expect(diffWords('', 'koko')).toBeNull()
  })
})

describe('diffChars and correctionParts', () => {
  it('strikes the learner\'s particle and inserts the tutor\'s', () => {
    expect(diffChars('音楽が聞きながら勉強します。', '音楽を聞きながら勉強します。')).toEqual([
      { kind: 'same', text: '音楽' },
      { kind: 'del', text: 'が' },
      { kind: 'ins', text: 'を' },
      { kind: 'same', text: '聞きながら勉強します。' },
    ])
  })

  it('lays the corrected sentence\'s readings over every part a run holds whole', () => {
    const parts = [
      { text: '音楽', reading: 'おんがく' }, { text: 'を' }, { text: '聞', reading: 'き' },
      { text: 'きながら' }, { text: '勉強', reading: 'べんきょう' }, { text: 'します。' },
    ]
    const out = correctionParts('音楽が聞きながら勉強します。', parts)
    expect(out.map(r => r.kind)).toEqual(['same', 'del', 'ins', 'same'])
    expect(out[0].parts).toEqual([{ text: '音楽', reading: 'おんがく' }])
    expect(out[1].parts).toEqual([{ text: 'が' }])
    expect(out[2].parts).toEqual([{ text: 'を' }])
    expect(out[3].parts).toEqual([
      { text: '聞', reading: 'き' }, { text: 'きながら' }, { text: '勉強', reading: 'べんきょう' }, { text: 'します。' },
    ])
  })

  it('prints a part a run cuts through bare rather than with half its reading', () => {
    const out = correctionParts('学校', [{ text: '学生', reading: 'がくせい' }])
    expect(out.flatMap(r => r.parts).every(p => !p.reading)).toBe(true)
    expect(out.filter(r => r.kind !== 'del').flatMap(r => r.parts).map(p => p.text).join('')).toBe('学生')
  })

  it('is the sentence whole when nothing was corrected', () => {
    expect(diffChars('山へ行きます。', '山へ行きます。')).toEqual([{ kind: 'same', text: '山へ行きます。' }])
  })
})

// The server's words for 「ここで少し休みましょう。」 (study/romaji.sentence_words).
const WORDS = [
  { text: 'ここ', kana: 'ここ', romaji: 'koko' },
  { text: 'で', kana: 'で', romaji: 'de' },
  { text: '少し', kana: 'すこし', romaji: 'sukoshi' },
  { text: '休みましょう。', kana: 'やすみましょう。', romaji: 'yasumimashou.' },
]
const SENTENCE = 'ここで少し休みましょう。'
const REFERENCE = 'koko de sukoshi yasumimashou.'

describe('refSpans, missMarks and missedWords', () => {
  it('places each reference word in the sentence', () => {
    expect(refSpans(REFERENCE, WORDS)).toEqual([
      { start: 0, end: 2, words: [0, 0] },
      { start: 2, end: 3, words: [1, 1] },
      { start: 3, end: 5, words: [2, 2] },
      { start: 5, end: 12, words: [3, 3] },
    ])
  })

  it('underlines a wrong word where it stands, the sentence\'s full stop left out', () => {
    const segs = diffWords('koko de tchisai yasumimasho', REFERENCE)
    const marks = missMarks(SENTENCE, segs, refSpans(REFERENCE, WORDS))
    expect(marks).toEqual([
      { start: 3, end: 5, kind: 'x' },
      { start: 5, end: 11, kind: 'near' },
    ])
  })

  it('names the words missed, not the one heard short, each once', () => {
    const segs = diffWords('koko tchisai yasumimasho', REFERENCE)
    const missed = missedWords(segs, refSpans(REFERENCE, WORDS), WORDS)
    expect(missed.map(w => [w.text, w.kana])).toEqual([['で', 'で'], ['少し', 'すこし']])
    expect(missedWords(diffWords('koko de sukoshi yasumimashou', REFERENCE), refSpans(REFERENCE, WORDS), WORDS)).toEqual([])
  })

  it('places a hand-spelled reference by its letters (書取\'s bank)', () => {
    // The bank spells 明日 ashita and the tokenizer asu: the letters
    // still fall on the word.
    const words = [
      { text: '明日', kana: 'あした', romaji: 'asu' },
      { text: 'の', kana: 'の', romaji: 'no' },
      { text: '朝、', kana: 'あさ、', romaji: 'asa,' },
      { text: '駅', kana: 'えき', romaji: 'eki' },
      { text: 'で', kana: 'で', romaji: 'de' },
      { text: '待って', kana: 'まって', romaji: 'matte' },
      { text: 'います。', kana: 'います。', romaji: 'imasu.' },
    ]
    const spans = refSpans('ashita no asa, eki de matte imasu', words)
    expect(spans[0]).toMatchObject({ start: 0, end: 2 })
    expect(spans[5]).toMatchObject({ start: 7, end: 10 })
    expect(refSpans('ashita', [])).toBeNull()
  })
})

describe('markParts', () => {
  it('cuts bare kana at a mark and keeps a reading whole', () => {
    const parts = [{ text: 'ここで' }, { text: '少', reading: 'すこ' }, { text: 'し' }, { text: '休', reading: 'やす' }, { text: 'みましょう。' }]
    const mark = { start: 3, end: 5, kind: 'x' }
    const runs = markParts(parts, [mark])
    expect(runs.map(r => [r.mark?.kind ?? null, r.parts.map(p => p.text).join('')])).toEqual([
      [null, 'ここで'], ['x', '少し'], [null, '休みましょう。'],
    ])
    // A mark that cuts a reading's kanji takes the kanji whole.
    expect(markParts([{ text: '九時', reading: 'くじ' }, { text: 'に' }], [{ start: 1, end: 3, kind: 'x' }])
      .map(r => r.parts.map(p => p.text).join(''))).toEqual(['九時に'])
  })
})

describe('the tutor\'s fixes, placed', () => {
  it('reads the Japanese a note quotes, its reading in brackets left off', () => {
    expect(quoted('「十本（じゅっぽん）」 is read じゅっぽん, and 「花」 is fine')).toEqual(['十本', '花'])
  })

  it('places each fix in the sentence by its quotes, numbered as it is listed', () => {
    const fixes = [
      { issue: 'The price comes first.', fix: '「百円の花を」' },
      { issue: '「十本」 is read じゅっぽん.', fix: '「じゅっぽん」' },
      { issue: 'Too formal.', fix: '' },
    ]
    expect(fixMarks('百円の花を十本買いました。', fixes)).toEqual([
      { start: 0, end: 5, n: 1, kind: 'x' },
      { start: 5, end: 7, n: 2, kind: 'x' },
    ])
  })

  it('numbers a correction by the fix that names it', () => {
    const parts = [{ text: '音楽', reading: 'おんがく' }, { text: 'を' }, { text: '聞', reading: 'き' }, { text: 'きながら' }]
    const runs = correctionFixes('音楽が聞きながら', parts, [{ issue: '「音楽が」 makes the music the subject.', fix: '「音楽を」' }])
    expect(runs.map(r => r.kind)).toEqual(['same', 'fix', 'same'])
    expect(runs[1]).toMatchObject({ del: 'が', n: 1 })
    expect(runs[1].ins.map(p => p.text).join('')).toBe('を')
  })
})

describe('the sentence as phrases', () => {
  it('joins one word\'s kanji under one reading, never two words\'', () => {
    const parts = [
      { text: '勉', reading: 'べん', word: 4 }, { text: '強', reading: 'きょう', word: 4 },
      { text: '百', reading: 'ひゃく', word: 0 }, { text: '円', reading: 'えん', word: 1 },
    ]
    expect(joinWords(markPieces(parts, [])).map(p => [p.part.text, p.part.reading]))
      .toEqual([['勉強', 'べんきょう'], ['百', 'ひゃく'], ['円', 'えん']])
  })

  it('opens a phrase at each kanji after kana, the kana riding with the kanji before it', () => {
    const parts = [
      { text: '九時', reading: 'くじ' }, { text: 'に' }, { text: '駅', reading: 'えき' }, { text: 'で' },
      { text: '会', reading: 'あ' }, { text: 'いましょう。' },
    ]
    const units = phrases(markPieces(parts, [])).map(u => u.map(p => p.part.text).join(''))
    expect(units).toEqual(['九時に', '駅で', '会いましょう。'])
    // A sentence opening on kana opens its first phrase with it.
    expect(phrases(markPieces([{ text: 'ここで' }, { text: '少', reading: 'すこ' }, { text: 'し' }], []))
      .map(u => u.map(p => p.part.text).join(''))).toEqual(['ここで', '少し'])
  })
})
