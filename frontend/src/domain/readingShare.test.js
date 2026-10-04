import { describe, it, expect } from 'vitest'
import { SCOPE_ALL, SCOPE_COURSE, formatPct, readingRows, sharePct, shareTier } from './readingShare'

// 生, as study/kanji_words.py counts it (the course: 55 words).
const GROUPS = [
  { reading: 'セイ', words: [{ kanji: '学生', level: 'N5' }, { kanji: '生徒', level: 'N5' }] },
  { reading: 'ショウ', words: [{ kanji: '誕生', level: 'N3' }] },
  { reading: 'い.ける', words: [{ kanji: '生ける', level: null }] },
  { reading: 'い.きる', words: [{ kanji: '生きる', level: 'N4' }, { kanji: '生け花', level: null }] },
  { reading: 'なま', words: [{ kanji: '生', level: 'N3' }] },
]
const COURSE = { total: 55, whole: 3, readings: { 'セイ': 27, 'ショウ': 8, 'い.きる': 4, 'なま': 4 } }
const ALL = { total: 1943, whole: 77, readings: { 'セイ': 1341, 'ショウ': 192, 'い.ける': 6, 'い.きる': 72, 'なま': 125 } }

describe('shareTier', () => {
  it('names a reading by the share of the words it carries', () => {
    expect(shareTier(49)).toBe('core')
    expect(shareTier(20)).toBe('core')
    expect(shareTier(19.9)).toBe('usual')
    expect(shareTier(5)).toBe('usual')
    expect(shareTier(4.9)).toBe('rare')
    expect(shareTier(0)).toBe('rare')
  })
})

describe('sharePct', () => {
  it('is a share of the words counted, and zero of nothing', () => {
    expect(sharePct(27, 54)).toBe(50)
    expect(sharePct(5, 0)).toBe(0)
  })
})

describe('readingRows', () => {
  it('lists the readings with words, most used first, and the rest as idle', () => {
    const { rows, idle, whole, total } = readingRows(GROUPS, COURSE, SCOPE_COURSE)
    expect(rows.map(r => r.reading)).toEqual(['セイ', 'ショウ', 'い.きる', 'なま'])
    expect(idle).toEqual(['い.ける'])
    expect(total).toBe(55)
    expect(whole.n).toBe(3)
    expect(rows[0].pct).toBeCloseTo(49.09, 1)
    expect(rows.map(r => r.tier)).toEqual(['core', 'usual', 'usual', 'usual'])
  })

  it('keeps the deck order between two readings with the same count', () => {
    const { rows } = readingRows(GROUPS, COURSE, SCOPE_COURSE)
    expect(rows.slice(2).map(r => r.reading)).toEqual(['い.きる', 'なま'])
  })

  it('shows only the course\'s own words under a reading in the course scope', () => {
    const { rows } = readingRows(GROUPS, COURSE, SCOPE_COURSE)
    expect(rows.find(r => r.reading === 'い.きる').words.map(w => w.kanji)).toEqual(['生きる'])
  })

  it('shows every word, and more readings, over all of JMdict', () => {
    const { rows, idle, total } = readingRows(GROUPS, ALL, SCOPE_ALL)
    expect(total).toBe(1943)
    expect(idle).toEqual([])
    expect(rows.map(r => r.reading)).toEqual(['セイ', 'ショウ', 'なま', 'い.きる', 'い.ける'])
    expect(rows.find(r => r.reading === 'い.きる').words).toHaveLength(2)
    expect(rows.at(-1).tier).toBe('rare')
  })

  it('has no whole-word line when no word is read as a whole', () => {
    expect(readingRows(GROUPS, { ...COURSE, whole: 0 }, SCOPE_COURSE).whole).toBeNull()
  })

  it('is empty until the counts are known', () => {
    expect(readingRows(GROUPS, null, SCOPE_ALL)).toEqual({ rows: [], idle: [], whole: null, total: 0 })
  })
})

describe('formatPct', () => {
  it('prints one decimal in the learner\'s language', () => {
    expect(formatPct(49.09, 'fr')).toBe('49,1')
    expect(formatPct(49.09, 'en')).toBe('49.1')
    expect(formatPct(0.4, 'fr')).toBe('0,4')
  })
})
