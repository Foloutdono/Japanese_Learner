import { describe, it, expect } from 'vitest'
import { dueText } from './forecast'
import fr from '../locales/fr'

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
