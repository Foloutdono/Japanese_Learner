import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

// The deployment's routing table (vercel.json). Two things about it are
// load-bearing enough to be worth a test rather than a comment:
//
//   1. The three proxy rewrites are why the browser never contacts
//      onrender.com -- some carriers cannot reach that zone at all
//      (2026-09-01). A new backend static mount needs a line here AND in
//      vite.config.js's dev proxy.
//   2. The SPA fallback must not swallow /assets/. Vercel checks the
//      filesystem before rewrites, so a real bundle never reaches the
//      catch-all -- but a MISSING one did, and came back as index.html at
//      HTTP 200. The module loader refuses that on MIME type, which is a
//      blank page rather than a clean 404, and the only clue is a console
//      line most learners will never open. Seen on 2026-09-09, when a tab
//      loaded from the previous deployment asked for a hash the new one
//      had already retired. index.html carries the client-side half of
//      that recovery.
const config = JSON.parse(
  readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'),
)

// vercel.json must stay strict JSON with no stray keys: Vercel validates
// the schema at build time and rejects the deployment over an unknown
// property, so the "why" above lives here and not in a "_comment".
describe('the vercel routing table', () => {
  it('is comment-free JSON with only routing keys', () => {
    for (const rule of config.rewrites) {
      expect(Object.keys(rule).sort()).toEqual(['destination', 'source'])
    }
  })

  it('proxies the backend paths rather than sending the browser to Render', () => {
    const proxied = config.rewrites
      .filter(r => r.destination.startsWith('http'))
      .map(r => r.source)
    expect(proxied).toEqual(['/api/:path*', '/kanjivg/:path*', '/exam-audio/:path*'])
    for (const r of config.rewrites) {
      if (!r.destination.startsWith('http')) expect(r.destination).not.toContain('onrender')
    }
  })

  describe('the SPA fallback', () => {
    const fallback = config.rewrites.find(r => r.destination === '/index.html')

    // Vercel compiles `source` with path-to-regexp; for a pattern that is
    // one capture group of plain regex this anchoring is the same match,
    // which is what lets the two cases below be checked and not asserted
    // as a string.
    const matches = path => new RegExp(`^${fallback.source}$`).test(path)

    it('is the last rule', () => {
      expect(config.rewrites.at(-1)).toBe(fallback)
    })

    it('catches the app routes, so deep links still boot', () => {
      for (const path of ['/', '/today', '/learn/kana', '/decks/42', '/exam/7']) {
        expect(matches(path), path).toBe(true)
      }
    })

    it('leaves /assets/ alone, so a retired bundle 404s instead of returning HTML', () => {
      for (const path of ['/assets/index-CvmBpgF-.js', '/assets/index-DXlHPQ_F.css']) {
        expect(matches(path), path).toBe(false)
      }
    })
  })
})
