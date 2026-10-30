import { describe, it, expect } from 'vitest'
import { pickInitialLang, intlLocale } from './locale'

describe('pickInitialLang', () => {
  it('honours a saved choice over the device', () => {
    expect(pickInitialLang('fr', 'en-US')).toBe('fr')
    expect(pickInitialLang('en', 'fr-FR')).toBe('en')
  })
  it('reads a French device as French, a Spanish one as Spanish, anything else as English', () => {
    expect(pickInitialLang(null, 'fr-CA')).toBe('fr')
    expect(pickInitialLang(null, 'FR')).toBe('fr')
    expect(pickInitialLang(null, 'es-MX')).toBe('es')
    expect(pickInitialLang(null, 'es')).toBe('es')
    expect(pickInitialLang(null, 'en-GB')).toBe('en')
    expect(pickInitialLang(null, 'ja-JP')).toBe('en')
    expect(pickInitialLang(null, 'de-DE')).toBe('en')
    expect(pickInitialLang(null, 'pt-BR')).toBe('en')
    expect(pickInitialLang(null, undefined)).toBe('en')
  })
  it('honours a saved Spanish choice over the device', () => {
    expect(pickInitialLang('es', 'fr-FR')).toBe('es')
  })
  it('ignores a saved value that is not a supported language', () => {
    expect(pickInitialLang('de', 'fr-FR')).toBe('fr')
    expect(pickInitialLang('', 'de')).toBe('en')
  })
})

describe('intlLocale', () => {
  it('writes each language in its own locale, English in the one the screen asks', () => {
    expect(intlLocale('fr')).toBe('fr-FR')
    expect(intlLocale('es')).toBe('es-ES')
    expect(intlLocale('en')).toBe('en-US')
    expect(intlLocale('en', 'en-GB')).toBe('en-GB')
    expect(intlLocale('de')).toBe('en-US')
  })
})
