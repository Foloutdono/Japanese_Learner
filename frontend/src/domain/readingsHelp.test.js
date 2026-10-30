import { describe, it, expect } from 'vitest'
import { hitPart, readingsHelp } from './readingsHelp'

// 日, as the deck packs it and study/kanji_words.py counts and groups
// it (the course: 79 words).
const HI_TOKENS = ['ニチ', 'ジツ', 'ひ', '~び', '~か']
const HI_SHARES = { total: 79, whole: 14, readings: { 'ニチ': 18, 'ジツ': 10, 'ひ': 17, '~び': 11, '~か': 9 } }
const furi = (...pairs) => pairs.map(([text, reading]) => (reading ? { text, reading } : { text }))
const HI_READINGS = [
  { reading: 'ニチ', words: [{ kanji: '日曜日', kana: 'にちようび', meaning: 'dimanche', furigana: furi(['日', 'にち'], ['曜', 'よう'], ['日', 'び']) }] },
  { reading: 'ジツ', words: [{ kanji: '先日', kana: 'せんじつ', meaning: "l'autre jour", furigana: furi(['先', 'せん'], ['日', 'じつ']) }] },
  { reading: 'ひ', words: [
    { kanji: '日付', kana: 'ひづけ', meaning: 'date', furigana: furi(['日', 'ひ'], ['付', 'づけ']) },
    { kanji: '日', kana: 'ひ', meaning: 'soleil; jour', furigana: furi(['日', 'ひ']) },
  ] },
  { reading: '~び', words: [{ kanji: '火曜日', kana: 'かようび', meaning: 'mardi', furigana: furi(['火', 'か'], ['曜', 'よう'], ['日', 'び']) }] },
  { reading: '~か', words: [] },
]

describe('readingsHelp', () => {
  it('stands each register on its most used reading, in a word of the kanji', () => {
    const help = readingsHelp({ kanji: '日', tokens: HI_TOKENS, shares: HI_SHARES, readings: HI_READINGS })
    expect(help.on.token).toBe('ニチ')
    expect(help.on.example.word.kanji).toBe('日曜日')
    expect(help.kun.token).toBe('ひ')
    // A Japanese reading is most often the kanji alone: 日 before 日付.
    expect(help.kun.example.word.kanji).toBe('日')
  })

  it('takes the first word when none has the kanji alone', () => {
    const readings = HI_READINGS.map(r => (r.reading === 'ひ' ? { ...r, words: r.words.slice(0, 1) } : r))
    expect(readingsHelp({ kanji: '日', tokens: HI_TOKENS, shares: HI_SHARES, readings }).kun.example.word.kanji).toBe('日付')
  })

  it('counts okurigana as the kanji alone (学ぶ)', () => {
    const readings = [{ reading: 'まな.ぶ', words: [
      { kanji: '学び舎', kana: 'まなびや', furigana: furi(['学', 'まな'], ['び'], ['舎', 'や']) },
      { kanji: '学ぶ', kana: 'まなぶ', furigana: furi(['学', 'まな'], ['ぶ']) },
    ] }]
    expect(readingsHelp({ kanji: '学', tokens: ['ガク', 'まな.ぶ'], shares: null, readings }).kun.example.word.kanji).toBe('学ぶ')
  })

  it('names the most used reading for the share, where the card prints shares', () => {
    const help = readingsHelp({ kanji: '日', tokens: HI_TOKENS, shares: HI_SHARES, readings: null })
    expect(help.share.token).toBe('ニチ')
    expect(help.share.pct).toBeCloseTo(22.78, 1)
    expect(readingsHelp({ kanji: '日', tokens: HI_TOKENS, shares: { total: 0, readings: {} }, readings: null }).share).toBeNull()
    expect(readingsHelp({ kanji: '日', tokens: HI_TOKENS, shares: null, readings: null }).share).toBeNull()
  })

  it('falls back to the deck order when nothing is counted', () => {
    const help = readingsHelp({ kanji: '日', tokens: HI_TOKENS, shares: null, readings: null })
    expect(help.on.token).toBe('ニチ')
    expect(help.kun.token).toBe('ひ')
    expect(help.on.example).toBeNull()
  })

  it('says which side a ~ reading is said on', () => {
    const after = readingsHelp({ kanji: '日', tokens: HI_TOKENS, shares: HI_SHARES, readings: HI_READINGS }).tilde
    expect(after).toMatchObject({ token: '~び', side: 'after' })
    expect(after.example.word.kanji).toBe('火曜日')
    const before = readingsHelp({ kanji: '生', tokens: ['セイ', 'なま~', 'い.きる'], shares: null, readings: null }).tilde
    expect(before).toMatchObject({ token: 'なま~', side: 'before', example: null })
  })

  it('writes a dotted reading out with its kana', () => {
    expect(readingsHelp({ kanji: '学', tokens: ['ガク', 'まな.ぶ'], shares: null, readings: null }).dot)
      .toEqual({ token: 'まな.ぶ', written: '学ぶ' })
  })

  it('leaves out the marks this kanji does not carry', () => {
    const help = readingsHelp({ kanji: '学', tokens: ['ガク', 'まな.ぶ'], shares: null, readings: null })
    expect(help.tilde).toBeNull()
    expect(readingsHelp({ kanji: '日', tokens: HI_TOKENS, shares: null, readings: null }).dot).toBeNull()
  })

  it('has no row for a register the kanji lacks', () => {
    const help = readingsHelp({ kanji: '万', tokens: ['マン', 'バン'], shares: null, readings: null })
    expect(help.on.token).toBe('マン')
    expect(help.kun).toBeNull()
  })
})

describe('hitPart', () => {
  it('picks the part read as the reading asked, not the first 日', () => {
    const word = HI_READINGS[3].words[0] // 火曜日, 日 read び
    expect(hitPart(word, '日', '~び')).toBe(2)
    expect(hitPart(HI_READINGS[0].words[0], '日', 'ニチ')).toBe(0)
  })

  it('falls back to the kanji part through a sound change (学校 がっ)', () => {
    const word = { kanji: '学校', kana: 'がっこう', furigana: furi(['学', 'がっ'], ['校', 'こう']) }
    expect(hitPart(word, '学', 'ガク')).toBe(0)
  })

  it('is -1 for a word with no parts', () => {
    expect(hitPart({ kanji: '日', kana: 'ひ' }, '日', 'ひ')).toBe(-1)
  })
})
