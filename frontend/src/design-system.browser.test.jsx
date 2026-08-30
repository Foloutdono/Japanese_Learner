import { describe, it, expect, afterEach } from 'vitest'
// This file asserts on the token contract itself, not on a component, so
// it needs the real cascade -- index.css plus the three feature sheets it
// @imports. Nothing here renders; every assertion reads computed style
// off <html>, the element the theme attribute actually lands on (see
// NavControls.jsx:105). Same import trick as index.tokens.browser.test.jsx
// (the rules only exist if the sheet is really loaded) -- that file pins
// two specific call sites for the formerly-undefined --text/--text-dim
// bug; this one is the generalised sweep behind it: every token resolves
// non-empty in both themes, light and dark declare the same names, and
// nothing references a custom property that was never defined anywhere.
import './index.css'
import scale from './design-scale.json'

function eachStyleRule(fn) {
  // NOT `if (rule.cssRules) recurse; else if (rule.selectorText) fn(rule)`.
  // Modern Chromium implements CSS Nesting, so every CSSStyleRule now
  // carries its own (possibly empty) `.cssRules` -- an object, so always
  // truthy -- not just container rules like CSSMediaRule. Branching on
  // that truthiness silently recurses into an empty list for every plain
  // rule and never calls `fn` at all: a real bug, caught only because the
  // ":root declares at least one token" assertion below failed loudly
  // instead of passing vacuously like the other three did with an
  // always-empty rule set. Call `fn` on anything with a selectorText, and
  // separately recurse into cssRules whenever it actually has entries.
  const walk = list => {
    for (const rule of list) {
      if (rule.selectorText) fn(rule)
      if (rule.cssRules && rule.cssRules.length) walk(rule.cssRules)
    }
  }
  for (const sheet of document.styleSheets) {
    let rules
    try { rules = sheet.cssRules } catch { continue }  // cross-origin: fonts
    walk(rules)
  }
}

function declaredOn(selector) {
  const names = new Set()
  eachStyleRule(r => {
    if (r.selectorText !== selector) return
    for (const prop of r.style) if (prop.startsWith('--')) names.add(prop)
  })
  return names
}

function declaredAnywhere() {
  const names = new Set()
  eachStyleRule(r => { for (const prop of r.style) if (prop.startsWith('--')) names.add(prop) })
  return names
}

function referencedWithoutFallback() {
  const names = new Set()
  const RE = /var\(\s*(--[A-Za-z0-9_-]+)\s*([,)])/g
  eachStyleRule(r => {
    for (const [, name, next] of r.cssText.matchAll(RE)) if (next === ')') names.add(name)
  })
  return names
}

const root = () => getComputedStyle(document.documentElement)
const setTheme = t => { document.documentElement.dataset.theme = t }

afterEach(() => { delete document.documentElement.dataset.theme })

// The flattened, de-duplicated set of every token name in design-scale.json's
// `tokens`. Values are stored as full `var(--x)` strings (Guard 3 matches
// them against raw declaration text verbatim); pull out just the name.
function allScaleTokenNames() {
  const names = new Set()
  for (const list of Object.values(scale.tokens)) {
    for (const entry of list) {
      const m = /^var\(\s*(--[A-Za-z0-9_-]+)\s*\)$/.exec(entry)
      if (m) names.add(m[1])
    }
  }
  return [...names].sort()
}

describe('design token contract', () => {
  it('resolves every token in the approved scale, in both themes', () => {
    const names = allScaleTokenNames()
    expect(names.length).toBeGreaterThan(0)

    setTheme('dark')
    for (const name of names) {
      expect(root().getPropertyValue(name).trim(), `${name} (dark)`).not.toBe('')
    }

    setTheme('light')
    for (const name of names) {
      expect(root().getPropertyValue(name).trim(), `${name} (light)`).not.toBe('')
    }
  })

  it('declares no light-only token', () => {
    // index.css's own header comment: "Same variable names in both
    // themes -- only the values differ under [data-theme="light"]".
    // A token declared in light but never in bare :root would fall back
    // to nothing the moment the theme flips back to dark.
    const light = declaredOn(':root[data-theme="light"]')
    const dark = declaredOn(':root')
    const lightOnly = [...light].filter(n => !dark.has(n)).sort()
    expect(lightOnly).toEqual([])
  })

  it('resolves every :root token under the light theme too', () => {
    // Catches a light block that BLANKS a token (`--accent: ;`) rather
    // than re-valuing it -- the failure mode index.css's header comment
    // warns about. A token :root declares that light never touches keeps
    // its :root value under the cascade, so this should never fail for
    // an untouched token; it exists to catch the accidental blank.
    const names = [...declaredOn(':root')].sort()
    expect(names.length).toBeGreaterThan(0)

    setTheme('light')
    for (const name of names) {
      expect(root().getPropertyValue(name).trim(), `${name} (light)`).not.toBe('')
    }
  })

  it('references no undefined custom property', () => {
    // The generalised guard for the var(--text)/var(--text-dim) bug
    // class: a var() with no fallback naming a property declared
    // nowhere silently drops the whole declaration. JS-set properties
    // (--ember-x, --streak-angle, ...) are legitimate and excluded via
    // scale.knownUndefined, which is regenerated from a real scan --
    // never copied from a plan's prose (see design-scale.json's
    // _knownUndefined note).
    const referenced = referencedWithoutFallback()
    const declared = declaredAnywhere()
    const known = new Set(scale.knownUndefined ?? [])
    const undefinedRefs = [...referenced]
      .filter(n => !declared.has(n) && !known.has(n))
      .sort()
    expect(undefinedRefs).toEqual([])
  })
})
