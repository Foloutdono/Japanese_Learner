import { describe, it, expect } from 'vitest'
import fr from './fr/index.js'
import en from './en/index.js'

// Plan 002 found two real defects this test would have caught: an English
// speaker saw the French word "Exemples" (a missing en key falling through
// to no translation), and a key was absent from the English table entirely.
// React renders a missing key as nothing, so these are silent blanks, not
// errors -- lint, build, and the rest of the test suite don't see them.
describe('locale parity (fr <-> en)', () => {
  it('has every French key present in English', () => {
    const missing = Object.keys(fr).filter(k => !(k in en))
    expect(missing, `missing in en/index.js: ${missing.join(', ')}`).toEqual([])
  })

  it('has every English key present in French', () => {
    const missing = Object.keys(en).filter(k => !(k in fr))
    expect(missing, `missing in fr/index.js: ${missing.join(', ')}`).toEqual([])
  })

  it('has matching value types for every shared key', () => {
    // A function (interpolated string) on one side against a plain string
    // on the other crashes at the call site instead of rendering blank --
    // worth catching even though today's tables happen to agree.
    const mismatched = Object.keys(fr)
      .filter(k => k in en && typeof fr[k] !== typeof en[k])
      .map(k => `${k} (fr: ${typeof fr[k]}, en: ${typeof en[k]})`)
    expect(mismatched, `type mismatch: ${mismatched.join(', ')}`).toEqual([])
  })
})
