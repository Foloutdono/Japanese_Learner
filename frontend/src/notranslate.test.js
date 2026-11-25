import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

// ── 翻訳 — no browser translates the app, and a rewritten page stands ──
// A learner's Chrome translated the app; each text node became <font>
// elements React never made, and every card turned threw removeChild and
// left a blank page (2026-11-25). index.html asks every browser not to
// translate; lib/domGuard keeps React standing when the page is rewritten
// all the same (lib/domGuard.browser.test.js).
const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

describe('the app document', () => {
  it('asks browsers not to translate it', () => {
    const html = read('index.html')
    expect(html).toMatch(/<html[^>]*\btranslate="no"/)
    expect(html).toMatch(/<meta\s+name="google"\s+content="notranslate"/)
  })

  it('guards the DOM before the first render', () => {
    const main = read('src/main.jsx')
    expect(main.indexOf('guardDom()')).toBeGreaterThan(-1)
    expect(main.indexOf('guardDom()')).toBeLessThan(main.indexOf('createRoot('))
  })
})
