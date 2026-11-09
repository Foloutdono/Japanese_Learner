import { describe, it, expect } from 'vitest'
import { pickInitialLang, intlLocale, contentLang, setInterfaceLocale, firstOfMonth, offeredLocales } from './locale'

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
    expect(pickInitialLang('es-MX', 'de')).toBe('en')
  })
  // Plan 303: Spain's Spanish, an interface over the one Spanish content.
  it('reads a device set to Spain as Spain\'s Spanish, every other Spanish one as Latin America\'s', () => {
    expect(pickInitialLang(null, 'es-ES')).toBe('es-ES')
    expect(pickInitialLang(null, 'es-es')).toBe('es-ES')
    expect(pickInitialLang(null, 'es-AR')).toBe('es')
    expect(pickInitialLang(null, 'es-419')).toBe('es')
  })
  it('honours a saved variety over the device', () => {
    expect(pickInitialLang('es-ES', 'es-MX')).toBe('es-ES')
    expect(pickInitialLang('es', 'es-ES')).toBe('es')
  })
})

describe('contentLang', () => {
  it('reads Spain\'s Spanish as the Spanish content, and anything unknown as English', () => {
    expect(contentLang('es-ES')).toBe('es')
    expect(contentLang('es')).toBe('es')
    expect(contentLang('fr')).toBe('fr')
    expect(contentLang('de')).toBe('en')
  })
})

describe('intlLocale', () => {
  it('writes each language in its own locale, English in the one the screen asks', () => {
    expect(intlLocale('fr')).toBe('fr-FR')
    expect(intlLocale('es')).toBe('es-419')
    expect(intlLocale('en')).toBe('en-US')
    expect(intlLocale('en', 'en-GB')).toBe('en-GB')
    expect(intlLocale('de')).toBe('en-US')
  })
  it('writes Spanish figures as the interface\'s Spanish does (plan 303)', () => {
    setInterfaceLocale('es-ES')
    expect(intlLocale('es')).toBe('es-ES')
    expect((12000).toLocaleString(intlLocale('es'))).toBe('12.000')
    setInterfaceLocale('es')
    expect(intlLocale('es')).toBe('es-419')
    expect((12000).toLocaleString(intlLocale('es'))).toBe('12,000')
    expect(intlLocale('fr')).toBe('fr-FR')
  })
})

describe('firstOfMonth', () => {
  it('says the first of a month as each language does', () => {
    expect(firstOfMonth('fr', 'novembre')).toBe('1er novembre')
    expect(firstOfMonth('es', 'noviembre')).toBe('1 de noviembre')
    expect(firstOfMonth('en', 'November')).toBe('November 1')
  })
  it('says it the English way in a language with no line, never the French (plan 312)', () => {
    expect(firstOfMonth('de', 'November')).toBe('November 1')
  })
})

// Indonesian is in preview (plan 312, the owner's pick D3): spoken, but
// offered to the accounts the server lists for it alone, and never the
// language a device starts in.
describe('a language in preview', () => {
  it('is never picked from the device, and is kept when the learner chose it', () => {
    expect(pickInitialLang(null, 'id-ID')).toBe('en')
    expect(pickInitialLang(null, 'id')).toBe('en')
    expect(pickInitialLang('id', 'en-US')).toBe('id')
    expect(contentLang('id')).toBe('id')
  })
  it('is offered only to an account listed for it, or while it is in use', () => {
    expect(offeredLocales([], 'fr')).not.toContain('id')
    expect(offeredLocales(undefined, 'fr')).not.toContain('id')
    expect(offeredLocales(['id'], 'fr')).toContain('id')
    expect(offeredLocales([], 'id')).toContain('id')
    expect(offeredLocales([], 'fr')).toEqual(['fr', 'en', 'es', 'es-ES'])
  })
  it('writes its figures as Indonesia does', () => {
    expect(intlLocale('id')).toBe('id-ID')
    expect((1234.5).toLocaleString(intlLocale('id'))).toBe('1.234,5')
  })
})
