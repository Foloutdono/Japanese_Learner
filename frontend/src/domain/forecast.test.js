import { describe, it, expect } from 'vitest'
import { dueFigure, dueText } from './forecast'
import fr from '../locales/fr'
import en from '../locales/en'

describe('a verdict\'s forecast in words (plan 126)', () => {
  it('says when the card comes back at the scale of the wait', () => {
    expect(dueText(180, fr)).toBe('dans 3 min')
    expect(dueText(600, fr)).toBe('dans 10 min')
    expect(dueText(3600, fr)).toBe('dans 1 h')
    expect(dueText(86400, fr)).toBe('demain')
    expect(dueText(3 * 86400, fr)).toBe('dans 3 j')
    expect(dueText(21 * 86400, fr)).toBe('dans 3 sem.')
    expect(dueText(90 * 86400, fr)).toBe('dans 3 mois')
    expect(dueText(36500 * 86400, fr)).toBe('dans 100 ans')
    expect(dueText(undefined, fr)).toBe('—')
  })
})

describe('the same wait as a tile\'s figure', () => {
  it('is a numeral and its unit, a day as much as a week', () => {
    const fig = s => { const f = dueFigure(s, fr); return f && `${f.value} ${f.unit}` }
    expect(fig(180)).toBe('3 min')
    expect(fig(600)).toBe('10 min')
    expect(fig(3600)).toBe('1 h')
    expect(fig(86400)).toBe('1 jour')
    expect(fig(3 * 86400)).toBe('3 jours')
    expect(fig(21 * 86400)).toBe('3 sem.')
    expect(fig(90 * 86400)).toBe('3 mois')
    expect(fig(365 * 86400 * 2)).toBe('2 ans')
    expect(fig(0)).toBe('1 min')
    expect(dueFigure(undefined, fr)).toBeNull()
  })

  it('names its unit in English too', () => {
    expect(dueFigure(86400, en)).toEqual({ value: 1, unit: 'day' })
    expect(dueFigure(3 * 86400, en)).toEqual({ value: 3, unit: 'days' })
    expect(dueFigure(90 * 86400, en)).toEqual({ value: 3, unit: 'mo' })
  })
})
