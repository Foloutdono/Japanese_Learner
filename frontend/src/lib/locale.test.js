import { describe, it, expect } from 'vitest'
import { pickInitialLang } from './locale'

describe('pickInitialLang', () => {
  it('honours a saved choice over the device', () => {
    expect(pickInitialLang('fr', 'en-US')).toBe('fr')
    expect(pickInitialLang('en', 'fr-FR')).toBe('en')
  })
  it('reads an English device as English, anything else as French', () => {
    expect(pickInitialLang(null, 'en-GB')).toBe('en')
    expect(pickInitialLang(null, 'EN')).toBe('en')
    expect(pickInitialLang(null, 'fr-CA')).toBe('fr')
    expect(pickInitialLang(null, 'ja-JP')).toBe('fr')
    expect(pickInitialLang(null, undefined)).toBe('fr')
  })
  it('ignores a saved value that is not a supported language', () => {
    expect(pickInitialLang('de', 'en-US')).toBe('en')
    expect(pickInitialLang('', 'fr')).toBe('fr')
  })
})
