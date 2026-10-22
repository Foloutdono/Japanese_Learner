import { describe, it, expect } from 'vitest'
import { pickInitialLang } from './locale'

describe('pickInitialLang', () => {
  it('honours a saved choice over the device', () => {
    expect(pickInitialLang('fr', 'en-US')).toBe('fr')
    expect(pickInitialLang('en', 'fr-FR')).toBe('en')
  })
  it('reads a French device as French, anything else as English', () => {
    expect(pickInitialLang(null, 'fr-CA')).toBe('fr')
    expect(pickInitialLang(null, 'FR')).toBe('fr')
    expect(pickInitialLang(null, 'en-GB')).toBe('en')
    expect(pickInitialLang(null, 'ja-JP')).toBe('en')
    expect(pickInitialLang(null, 'de-DE')).toBe('en')
    expect(pickInitialLang(null, undefined)).toBe('en')
  })
  it('ignores a saved value that is not a supported language', () => {
    expect(pickInitialLang('de', 'fr-FR')).toBe('fr')
    expect(pickInitialLang('', 'de')).toBe('en')
  })
})
