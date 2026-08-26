import { describe, it, expect } from 'vitest'
import { parseTimecode, formatTimecode } from './timecode'

describe('parseTimecode', () => {
  it('reads mm:ss', () => {
    expect(parseTimecode('2:30')).toBe(150)
    expect(parseTimecode('02:30')).toBe(150)
    expect(parseTimecode('0:05')).toBe(5)
  })

  it('reads h:mm:ss', () => {
    expect(parseTimecode('1:02:03')).toBe(3723)
  })

  it('reads a bare number as seconds', () => {
    expect(parseTimecode('150')).toBe(150)
    expect(parseTimecode('0')).toBe(0)
    expect(parseTimecode('12.5')).toBe(12.5)
  })

  it('trims surrounding whitespace', () => {
    expect(parseTimecode('  2:30 ')).toBe(150)
  })

  // The caller decides what to do with null. This module never guesses.
  it('returns null for anything it cannot read', () => {
    expect(parseTimecode('')).toBeNull()
    expect(parseTimecode('   ')).toBeNull()
    expect(parseTimecode('abc')).toBeNull()
    expect(parseTimecode('-30')).toBeNull()
    expect(parseTimecode('2:')).toBeNull()
    expect(parseTimecode(':30')).toBeNull()
    expect(parseTimecode('1:2:3:4')).toBeNull()
    expect(parseTimecode(undefined)).toBeNull()
    expect(parseTimecode(null)).toBeNull()
    expect(parseTimecode(150)).toBeNull()
  })

  // Deliberate, and the kind of thing a later "improvement" will helpfully
  // relax: 2:75 is not 195. A field that silently reinterprets what you
  // typed is worse than one that says it did not understand.
  it('rejects an out-of-range seconds part rather than normalising it', () => {
    expect(parseTimecode('2:75')).toBeNull()
    expect(parseTimecode('1:99:00')).toBeNull()
  })
})

describe('formatTimecode', () => {
  it('pads seconds to two digits and never pads minutes', () => {
    expect(formatTimecode(150)).toBe('2:30')
    expect(formatTimecode(5)).toBe('0:05')
    expect(formatTimecode(65)).toBe('1:05')
    expect(formatTimecode(0)).toBe('0:00')
  })

  it('floors fractional seconds', () => {
    expect(formatTimecode(12.9)).toBe('0:12')
  })

  it('falls back to 0:00 rather than printing NaN', () => {
    expect(formatTimecode(NaN)).toBe('0:00')
    expect(formatTimecode(-5)).toBe('0:00')
    expect(formatTimecode(undefined)).toBe('0:00')
  })

  it('round-trips with parseTimecode', () => {
    for (const s of [0, 5, 59, 60, 65, 150, 3599]) {
      expect(parseTimecode(formatTimecode(s))).toBe(s)
    }
  })
})
