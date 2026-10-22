import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { glyphOfUrl, strokesOf } from './kanjivg'

// ── 辻 — a KanjiVG file as data (plan 267) ──
const file = code => readFileSync(new URL(`../../../backend/kanjivg/${code}.svg`, import.meta.url), 'utf8')

describe('strokesOf', () => {
  it('reads a real file\'s strokes in order, past its DOCTYPE and its numbers', () => {
    // 水 has four strokes; the numbers' group holds no path.
    const strokes = strokesOf(file('06c34'))
    expect(strokes).toHaveLength(4)
    expect(strokes[0].startsWith('M52.77,15.08')).toBe(true)
    expect(strokes.every(d => /^M[-\d.]/.test(d))).toBe(true)
  })

  it('counts the same strokes the animation draws, over a spread of files', () => {
    // 日 4, 木 4, 語 14: the paths of the strokes' group, nested radicals included.
    expect(strokesOf(file('065e5'))).toHaveLength(4)
    expect(strokesOf(file('06728'))).toHaveLength(4)
    expect(strokesOf(file('08a9e'))).toHaveLength(14)
  })

  it('has no strokes for text that is not a KanjiVG file', () => {
    expect(strokesOf('')).toEqual([])
    expect(strokesOf(null)).toEqual([])
    expect(strokesOf('<svg><path d="M0,0L1,1"/></svg>')).toEqual([])
  })
})

describe('glyphOfUrl', () => {
  it('names the character a file draws', () => {
    expect(glyphOfUrl('/kanjivg/06c34.svg')).toBe('水')
    expect(glyphOfUrl('https://tsuji.app/kanjivg/03042.svg')).toBe('あ')
    expect(glyphOfUrl('/kanjivg/06c34-Kaisho.svg')).toBe('水')
  })

  it('says nothing of a url that is not one', () => {
    expect(glyphOfUrl(null)).toBe(null)
    expect(glyphOfUrl('/kanjivg/readme.txt')).toBe(null)
  })
})
