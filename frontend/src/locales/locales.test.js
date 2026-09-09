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

  // ── **…** ────────────────────────────────────────────────────
  // The emphasis marker (components/ui/Emphasized.jsx) is the one
  // piece of markup the string tables carry, and an unclosed run is
  // invisible until it prints its asterisks to a learner: the split
  // simply finds no pair and the whole sentence renders raw. Cheap to
  // catch here, in both tables at once.
  it('closes every emphasis run it opens', () => {
    const unbalanced = []
    for (const [lang, table] of [['fr', fr], ['en', en]]) {
      for (const [key, value] of Object.entries(table)) {
        // Interpolated copy is a function; the arguments only have to
        // be enough to build the string, not to be right.
        const text = typeof value === 'function'
          ? (() => { try { return value(1, 2, 3, 4, 5) } catch { return '' } })()
          : value
        if (typeof text !== 'string') continue
        const marks = (text.match(/\*\*/g) ?? []).length
        if (marks % 2) unbalanced.push(`${lang}.${key}`)
      }
    }
    expect(unbalanced, `unclosed ** run in: ${unbalanced.join(', ')}`).toEqual([])
  })

  // ── L'espace insécable ──────────────────────────────────
  // French puts a space before : ; ! ? and inside « », and that space
  // may not be broken across lines. A plain U+0020 there is exactly a
  // line-break opportunity, and the arrival screen took it: the colon
  // ending "… pour vous :" printed alone on the next line, under the
  // chart. frenchSpacing.js welds the table on the way out, and this
  // is what holds the whole table — nested groups and interpolated
  // sentences included — to the rule, so a new string cannot bring
  // the orphan back.
  it('never leaves a breakable space against high punctuation', () => {
    const loose = []
    // Both tables: French because the space is its own, English
    // because a guillemet that strays in brings the same break with it.
    for (const [lang, table] of [['fr', fr], ['en', en]]) walk(table, lang, loose)
    expect(loose, `breakable space before : ; ! ? » (or after «) in: ${loose.join(', ')}`).toEqual([])
  })
})

// Every leaf of a table, as the learner receives it: a plain string, a
// copy function's result, or the same again inside a nested group
// (brdFor, brdPromise, onbTestKind…), which the key-parity tests above
// do not descend into.
function walk(value, path, out) {
  if (typeof value === 'function') {
    // The arguments only have to build a string, not be right.
    let built
    try { built = value(1, 2, 3, 4, 5) } catch { return }
    return walk(built, `${path}()`, out)
  }
  if (typeof value === 'string') {
    if (/ [:;!?»]|« /.test(value)) out.push(path)
    return
  }
  if (Array.isArray(value)) return value.forEach((v, i) => walk(v, `${path}[${i}]`, out))
  if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) walk(v, `${path}.${k}`, out)
  }
}
