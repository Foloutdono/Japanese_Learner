import { describe, it, expect } from 'vitest'
import { readingStem, pickVariedReadings, isOnyomiToken, pickPlateReadings } from './readingPick'

// 下's real reading field, from content/kanji_data.py — the card that
// prompted this: two on'yomi and twelve kun, of which five are okurigana
// forms of くだ and two of さ.
const SHITA_KUN = [
  'した', 'しも', 'もと', 'さ.げる', 'さ.がる', 'くだ.る', 'くだ.り',
  'くだ.す', '~くだ.す', 'くだ.さる', 'お.ろす', 'お.りる',
]

describe('readingStem', () => {
  it('strips okurigana and the variant marker', () => {
    expect(readingStem('さ.げる')).toBe('さ')
    expect(readingStem('くだ.さる')).toBe('くだ')
    expect(readingStem('~くだ.す')).toBe('くだ')   // a variant is not a stem of its own
    expect(readingStem('～くだ.す')).toBe('くだ')   // fullwidth twin
    expect(readingStem('した')).toBe('した')       // no okurigana: the whole reading
    expect(readingStem('カ')).toBe('カ')
  })

  it('survives junk', () => {
    expect(readingStem(undefined)).toBe('')
    expect(readingStem('')).toBe('')
  })
})

describe('pickVariedReadings', () => {
  it('leaves a list that already fits completely alone', () => {
    expect(pickVariedReadings(['カ', 'ゲ'], 5)).toEqual(['カ', 'ゲ'])
    expect(pickVariedReadings(SHITA_KUN, 50)).toEqual(SHITA_KUN)
    // No limit is the dictionary's case: everything, untouched.
    expect(pickVariedReadings(SHITA_KUN, undefined)).toEqual(SHITA_KUN)
    expect(pickVariedReadings(SHITA_KUN, 0)).toEqual(SHITA_KUN)
  })

  it('spends its five slots on five different stems', () => {
    const picked = pickVariedReadings(SHITA_KUN, 5)
    expect(picked).toHaveLength(5)
    // The point of the exercise: no stem twice.
    const stems = picked.map(readingStem)
    expect(new Set(stems).size).toBe(5)
    // And it reaches the stems a naive slice never got to.
    expect(stems).toContain('くだ')
    expect(picked).not.toContain('さ.がる')   // さ.げる already stands for さ
  })

  it('keeps the source order, so the primary reading stays first', () => {
    const picked = pickVariedReadings(SHITA_KUN, 5)
    expect(picked[0]).toBe('した')
    const idx = picked.map(r => SHITA_KUN.indexOf(r))
    expect(idx).toEqual([...idx].sort((a, b) => a - b))
  })

  it('fills the card when a kanji has fewer stems than slots', () => {
    // 通る/通う-style: every reading one word in different clothes.
    // One-per-stem alone would print a single reading and waste four
    // slots, so the rest are filled in order.
    const oneStem = ['とお.る', 'とお.す', 'とお.り', 'かよ.う']
    expect(pickVariedReadings(oneStem, 3)).toEqual(['とお.る', 'かよ.う', 'とお.す'].sort(
      (a, b) => oneStem.indexOf(a) - oneStem.indexOf(b)))
    expect(pickVariedReadings(oneStem, 3)).toHaveLength(3)
  })
})

// 木's and 山's real reading fields, from content/kanji_data.py.
const KI = ['ボク', 'モク', 'き', 'こ~']
const YAMA = ['サン', 'セン', 'やま']

describe('isOnyomiToken', () => {
  it('reads the register off the first kana, skipping markers', () => {
    expect(isOnyomiToken('モク')).toBe(true)
    expect(isOnyomiToken('き')).toBe(false)
    expect(isOnyomiToken('こ~')).toBe(false)
    expect(isOnyomiToken('~び')).toBe(false)   // the marker is not kana
    expect(isOnyomiToken('い.きる')).toBe(false)
  })

  it('survives junk', () => {
    expect(isOnyomiToken('')).toBe(false)
    expect(isOnyomiToken(undefined)).toBe(false)
    expect(isOnyomiToken('abc')).toBe(false)
  })
})

describe('pickPlateReadings', () => {
  it('takes the first on\'yomi and the first kun\'yomi when a kanji has both', () => {
    expect(pickPlateReadings(KI)).toEqual(['ボク', 'き'])
    expect(pickPlateReadings(YAMA)).toEqual(['サン', 'やま'])
  })

  it('falls back to two varied readings when only one register exists', () => {
    expect(pickPlateReadings(['カ', 'ゲ', 'キ'])).toEqual(['カ', 'ゲ'])
    expect(pickPlateReadings(SHITA_KUN)).toEqual(['した', 'しも'])
  })

  it('leaves a list that already fits alone, and survives junk', () => {
    expect(pickPlateReadings(['ガク', 'まな.ぶ'])).toEqual(['ガク', 'まな.ぶ'])
    expect(pickPlateReadings(['ひ'])).toEqual(['ひ'])
    expect(pickPlateReadings(undefined)).toEqual([])
  })
})
