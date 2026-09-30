import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync, mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { APP_SHELL, routeLike } from '../appShell.js'

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

  // The landing page (plan 167) is the site's `/`, and `/en` its English
  // page: two static files under public/landing/, rewritten to, ahead of
  // the fallback. A rewrite never beats a file, so this works only
  // because the web build names the app's document app.html
  // (appShell.js) and leaves no index.html at the root to answer `/`.
  it('serves the landing at / and /en, ahead of the fallback', () => {
    const at = source => config.rewrites.findIndex(r => r.source === source)
    const fallback = config.rewrites.findIndex(r => r.destination === `/${APP_SHELL}`)
    for (const [source, file] of [['/', '/landing/index.html'], ['/en', '/landing/en/index.html'], ['/en/', '/landing/en/index.html']]) {
      expect(config.rewrites[at(source)]?.destination, source).toBe(file)
      expect(at(source), source).toBeLessThan(fallback)
      expect(existsSync(new URL(`../public${file}`, import.meta.url)), file).toBe(true)
    }
    expect(existsSync(new URL('../public/index.html', import.meta.url)), 'a public/index.html would take `/` back').toBe(false)
  })

  // Where the page stood before it was the root, sent on for good, so a
  // link or an index entry to /landing/ ends where the page is now.
  it('sends the landing page\u2019s old addresses to the root', () => {
    const to = Object.fromEntries((config.redirects ?? []).map(r => [r.source, r]))
    for (const [from, where] of [['/landing', '/'], ['/landing/', '/'], ['/landing/en', '/en'], ['/landing/en/', '/en']]) {
      expect(to[from]?.destination, from).toBe(where)
      expect(to[from]?.permanent, from).toBe(true)
    }
    for (const r of config.redirects) {
      expect(Object.keys(r).sort()).toEqual(['destination', 'permanent', 'source'])
    }
  })

  describe('the SPA fallback', () => {
    const fallback = config.rewrites.find(r => r.destination === `/${APP_SHELL}`)

    // Vercel compiles `source` with path-to-regexp; for a pattern that is
    // one capture group of plain regex this anchoring is the same match,
    // which is what lets the two cases below be checked and not asserted
    // as a string.
    const matches = path => new RegExp(`^${fallback.source}$`).test(path)

    it('is the last rule', () => {
      expect(config.rewrites.at(-1)).toBe(fallback)
    })

    it('catches the app routes, so deep links still boot', () => {
      for (const path of ['/app', '/today', '/learn/kana', '/decks/42', '/exam/7']) {
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

// The dev server and `vite preview` route by the same table (appShell.js,
// siteRoutes), so `/` is the landing page there too: dev mirrors prod.
describe('the dev server and preview, routed by the same table', () => {
  // A directory holding `files`, standing for public/ or the build.
  function served(files) {
    const dir = mkdtempSync(join(tmpdir(), 'routes-'))
    for (const file of files) {
      mkdirSync(join(dir, file, '..'), { recursive: true })
      writeFileSync(join(dir, file), '')
    }
    return dir
  }
  const LANDING = ['landing/index.html', 'landing/en/index.html', 'landing/landing.js', 'privacy.html', 'sw.js']
  const publicDir = served(LANDING)
  const buildDir = served([...LANDING, APP_SHELL, 'assets/index-abc.js'])

  // What the middleware does with a request: sent on (to which url), or
  // answered with a redirect.
  function route(dir, url, method = 'GET') {
    const req = { url, method }
    const res = { headers: {}, setHeader(k, v) { this.headers[k] = v }, end() { this.ended = true } }
    let passed = false
    routeLike(config, dir)(req, res, () => { passed = true })
    return passed ? { url: req.url } : { status: res.statusCode, location: res.headers.Location }
  }

  it('serves the landing at / and /en, its query kept', () => {
    for (const dir of [publicDir, buildDir]) {
      expect(route(dir, '/')).toEqual({ url: '/landing/index.html' })
      expect(route(dir, '/?landing')).toEqual({ url: '/landing/index.html?landing' })
      expect(route(dir, '/?code=abc')).toEqual({ url: '/landing/index.html?code=abc' })
      expect(route(dir, '/en')).toEqual({ url: '/landing/en/index.html' })
      expect(route(dir, '/en/')).toEqual({ url: '/landing/en/index.html' })
      expect(route(dir, '/privacy')).toEqual({ url: '/privacy.html' })
    }
  })

  it('sends the old addresses on, as the deployment does', () => {
    expect(route(publicDir, '/landing')).toEqual({ status: 308, location: '/' })
    expect(route(publicDir, '/landing/en/')).toEqual({ status: 308, location: '/en' })
    expect(route(buildDir, '/landing?x=1')).toEqual({ status: 308, location: '/?x=1' })
  })

  it('leaves the app routes to the dev server, which serves the source index.html', () => {
    for (const url of ['/app', '/today', '/learn/kana', '/src/main.jsx', '/@vite/client']) {
      expect(route(publicDir, url), url).toEqual({ url })
    }
  })

  it('serves the app document for the app routes on preview, as the fallback does', () => {
    for (const url of ['/app', '/today', '/learn/kana']) {
      expect(route(buildDir, url), url).toEqual({ url: `/${APP_SHELL}` })
    }
  })

  it('serves a file as it is, and a missing bundle as a 404', () => {
    expect(route(buildDir, '/sw.js')).toEqual({ url: '/sw.js' })
    expect(route(buildDir, '/assets/index-abc.js')).toEqual({ url: '/assets/index-abc.js' })
    expect(route(buildDir, '/assets/index-gone.js')).toEqual({ url: '/assets/index-gone.js' })
    expect(route(buildDir, '/landing/landing.js')).toEqual({ url: '/landing/landing.js' })
  })

  it('leaves the proxied paths and anything but a read alone', () => {
    expect(route(buildDir, '/api/today')).toEqual({ url: '/api/today' })
    expect(route(buildDir, '/kanjivg/0999c.svg')).toEqual({ url: '/kanjivg/0999c.svg' })
    expect(route(buildDir, '/', 'POST')).toEqual({ url: '/' })
    expect(route(buildDir, '/%E0%A4%A')).toEqual({ url: `/${APP_SHELL}` })
  })
})
