import { describe, it, expect } from 'vitest'
import './index.css'

// ── The scrollbar belongs to whoever is pointing ────────────────
// A page that styles a scrollbar AT ALL — the `::-webkit-scrollbar`
// pseudo-elements, or `scrollbar-width` / `scrollbar-color` — opts out
// of the browser's overlay theme and gets a classic bar back: painted
// permanently rather than on the flick, and taking its width out of the
// content. On a cursor that is exactly what is wanted, and index.css's
// "Themed scrollbar" draws a thin ink-toned one. On a phone it was a
// pale rail down the right of the welcome and of every boarding
// question, reported from an Android install on 2026-09-09.
//
// So the rule is: every scrollbar declaration in the stylesheet lives
// behind `(pointer: fine)`. This lane runs on chromium's default
// context, which reports a mouse — hence the second test, that the
// themed bar is still asked for where there IS one. The coarse half is
// asserted from the touch lane (screens/BoardingFlow.touch.test.jsx),
// which is the only lane that passes `hasTouch`.
//
// `scrollbar-gutter` is deliberately not counted: it reserves space
// only where the scrollbar is a classic one and nothing where it is an
// overlay, which is why `html { scrollbar-gutter: stable }` is global
// (see its own note, at the ticket gate).
const STYLES_A_SCROLLBAR = /^scrollbar-(width|color)$/

// Every style rule in the cascade, with the chain of at-rule conditions
// it sits under. Same walk as design-system.browser.test.jsx: call on
// anything with a selectorText, and recurse separately, because CSS
// Nesting gives every plain rule its own (empty) cssRules.
function eachStyleRule(fn) {
  const walk = (list, conditions) => {
    for (const rule of list) {
      const own = rule.conditionText ? [...conditions, rule.conditionText] : conditions
      if (rule.selectorText) fn(rule, own)
      if (rule.cssRules && rule.cssRules.length) walk(rule.cssRules, own)
    }
  }
  for (const sheet of document.styleSheets) {
    let rules
    try { rules = sheet.cssRules } catch { continue }  // cross-origin: fonts
    walk(rules, [])
  }
}

function scrollbarRules() {
  const found = []
  eachStyleRule((rule, conditions) => {
    const pseudo = rule.selectorText.includes('::-webkit-scrollbar')
    const property = [...rule.style].some(p => STYLES_A_SCROLLBAR.test(p))
    if (pseudo || property) found.push({ selector: rule.selectorText, conditions })
  })
  return found
}

describe('the themed scrollbar', () => {
  it('is written for a cursor and nothing else', () => {
    const rules = scrollbarRules()
    // A guard that found nothing to guard is not passing, it is broken.
    expect(rules.length).toBeGreaterThan(0)
    const unguarded = rules
      .filter(r => !r.conditions.some(c => c.replace(/\s/g, '').includes('pointer:fine')))
      .map(r => r.selector)
    expect(unguarded).toEqual([])
  })

  it('is drawn where there is a cursor', () => {
    expect(matchMedia('(pointer: fine)').matches, 'the lane has a mouse').toBe(true)
    expect(getComputedStyle(document.documentElement).getPropertyValue('scrollbar-width')).toBe('thin')
  })
})
