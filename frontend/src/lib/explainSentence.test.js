import { describe, it, expect } from 'vitest'
import { explainErrorText } from './explainSentence'
import { ApiError } from './api'
import en from '../locales/en/index.js'
import fr from '../locales/fr/index.js'

describe('explainErrorText', () => {
  it('names the spent day on a 429, from an ApiError or explainSentence\'s own Error', () => {
    expect(explainErrorText(new ApiError(429, { detail: 'Daily limit' }, '/api/phrase/analyze'), en)).toBe(en.explainLimitReached)
    expect(explainErrorText(new Error('429'), fr)).toBe(fr.explainLimitReached)
  })

  it('names the provider down on a 503, and anything else a plain failure', () => {
    expect(explainErrorText(new ApiError(503, null, '/api/phrase/analyze'), en)).toBe(en.explainUnavailable)
    expect(explainErrorText(new Error('503'), en)).toBe(en.explainUnavailable)
    expect(explainErrorText(new Error('500'), en)).toBe(en.explainFailed)
    expect(explainErrorText(new TypeError('Failed to fetch'), en)).toBe(en.explainFailed)
    expect(explainErrorText(undefined, en)).toBe(en.explainFailed)
  })

  it('is worded in both languages', () => {
    for (const t of [en, fr]) expect(typeof t.explainLimitReached).toBe('string')
  })
})
