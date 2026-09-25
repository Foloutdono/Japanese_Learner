import { describe, it, expect } from 'vitest'
import { kanaToRomaji, toHiragana, romajiEquals } from './romaji'

// The readings drill's two sides: a reading stored in kana, and what the
// learner typed -- kana in either script, or romaji (ReadingsInput).

describe('toHiragana', () => {
  it('writes katakana in hiragana and leaves the rest', () => {
    expect(toHiragana('シュ')).toBe('しゅ')
    expect(toHiragana('ジョウ')).toBe('じょう')
    expect(toHiragana('ぬし')).toBe('ぬし')
    expect(toHiragana('shu')).toBe('shu')
    expect(toHiragana('ー')).toBe('ー')
  })
})

describe('kanaToRomaji', () => {
  it.each([
    ['シュ', 'shu'], ['ス', 'su'], ['ぬし', 'nushi'], ['あるじ', 'aruji'],
    ['ジョウ', 'jou'], ['キャク', 'kyaku'], ['チョウ', 'chou'], ['ニュウ', 'nyuu'],
    ['がっこう', 'gakkou'], ['マッチャ', 'matcha'], ['コーヒー', 'koohii'],
    ['シン', 'shin'], ['ツ', 'tsu'], ['ファ', 'fa'], ['ヂ', 'ji'], ['を', 'o'],
  ])('%s is %s', (kana, romaji) => {
    expect(kanaToRomaji(kana)).toBe(romaji)
  })

  it('meets the learner\'s spellings through the fold', () => {
    expect(romajiEquals('jō', kanaToRomaji('ジョウ'))).toBe(true)
    expect(romajiEquals('syu', kanaToRomaji('シュ'))).toBe(true)
    expect(romajiEquals('tyou', kanaToRomaji('チョウ'))).toBe(true)
    expect(romajiEquals('jo', kanaToRomaji('ジョウ'))).toBe(false)
  })
})
