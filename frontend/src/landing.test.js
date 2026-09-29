import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { DARK, LIGHT, SCALE } from '../landing/tokens.mjs'
import { PAGES, SITE_ORIGIN, STORES, PRESENTATION, CLIPS } from '../landing/config.mjs'
import { landingFiles } from '../landing/build.mjs'
import { STRINGS } from '../landing/strings.mjs'
import { readFacts } from '../landing/content.mjs'

// ── 辻 — the landing page (plan 167) ──
// A static page outside src/ (frontend/landing/, built by
// `npm run landing` into public/landing/), so none of the app's guards
// see it. These are its own: the tokens it copies stay the app's, the
// committed pages stay what the build writes, and what search engines
// read stays whole.

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const css = read('src/index.css')

/** The custom properties declared in the first block opening with `head`. */
function declared(head) {
  const start = css.indexOf(`${head} {`)
  const body = css.slice(start, css.indexOf('\n}', start)).replace(/\/\*[\s\S]*?\*\//g, '')
  return Object.fromEntries([...body.matchAll(/(--[\w-]+):\s*([^;]+);/g)]
    .map(([, name, value]) => [name, value.replace(/\s+/g, ' ').trim()]))
}

describe('the landing page', () => {
  describe('its tokens', () => {
    const root = declared(':root')
    const light = declared(':root[data-theme="light"]')

    it('are the app’s, value for value, in the dark theme and the scales', () => {
      for (const [name, value] of Object.entries({ ...DARK, ...SCALE })) {
        expect(root[name], name).toBe(value)
      }
    })

    it('are the app’s in the washi theme', () => {
      for (const [name, value] of Object.entries(LIGHT)) {
        expect(light[name], name).toBe(value)
      }
    })
  })

  describe('the committed pages', () => {
    const files = landingFiles()

    // `npm run landing` writes them; a deck change or an edit under
    // frontend/landing/ that was not followed by a build fails here.
    it('are what `npm run landing` writes', () => {
      for (const [path, text] of Object.entries(files)) {
        expect(read(path), `${path} is stale: run npm run landing`).toBe(text)
      }
    })

    it('carry their own fonts, script and share cards', () => {
      for (const path of ['public/landing/landing.js', ...Object.values(PAGES).map(p => `public${p.ogImage}`),
        ...['400', '500', '700'].map(w => `public/landing/fonts/space-grotesk-latin-${w}-normal.woff2`)]) {
        expect(existsSync(new URL(`../${path}`, import.meta.url)), path).toBe(true)
      }
    })
  })

  describe.each(Object.values(PAGES))('the $lang page, as a search engine reads it', page => {
    const html = read(page.out)
    const text = (re) => html.match(re)?.[1]

    it('has a title and a description that fit a search result', () => {
      expect(text(/<title>([^<]+)<\/title>/).length).toBeLessThanOrEqual(60)
      expect(text(/<meta name="description" content="([^"]+)"/).length).toBeLessThanOrEqual(160)
      expect(html.match(/<h1\b/g)).toHaveLength(1)
    })

    it('names its canonical address and both languages', () => {
      expect(text(/<link rel="canonical" href="([^"]+)"/)).toBe(`${SITE_ORIGIN}${page.path}`)
      for (const other of Object.values(PAGES)) {
        expect(html).toContain(`<link rel="alternate" hreflang="${other.lang}" href="${SITE_ORIGIN}${other.path}">`)
      }
      expect(html).toContain('hreflang="x-default"')
    })

    it('describes itself in JSON-LD whose FAQ is the one on the page', () => {
      const graph = JSON.parse(text(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/))['@graph']
      const faq = graph.find(n => n['@type'] === 'FAQPage')
      const summaries = [...html.matchAll(/<summary>([^<]+)<\/summary>/g)].map(m => m[1])
      expect(faq.mainEntity.map(q => q.name)).toEqual(summaries)
      // A VideoObject only once the presentation is in the bucket.
      expect(graph.some(n => n['@type'] === 'VideoObject')).toBe(Boolean(PRESENTATION.uploadDate))
    })

    it('links every in-page anchor to a section that exists', () => {
      for (const [, id] of html.matchAll(/href="#([^"]*)"/g)) {
        expect(id, 'an empty # link').not.toBe('')
        expect(html, `#${id}`).toContain(`id="${id}"`)
      }
    })

    it('links a store badge only where the listing exists', () => {
      const linked = [...html.matchAll(/data-store="(\w+)"/g)].map(m => m[1])
      expect(linked.sort()).toEqual(Object.keys(STORES).filter(k => STORES[k]).flatMap(k => [k, k]).sort())
    })

    it('holds every hook the client script reaches for', () => {
      const script = read('public/landing/landing.js')
      for (const [, hook] of script.matchAll(/\[data-([a-z-]+)/g)) {
        expect(html, `data-${hook}`).toContain(`data-${hook}`)
      }
    })
  })

  describe('its words', () => {
    const facts = readFacts()
    const fr = STRINGS.fr(facts)
    const en = STRINGS.en(facts)

    /** Every key path in `o`, functions and arrays included. */
    const shape = (o, at = '') => Object.entries(o).flatMap(([k, v]) =>
      v && typeof v === 'object' && !Array.isArray(v) ? shape(v, `${at}${k}.`) : [`${at}${k}`])

    it('say the same things in both languages', () => {
      expect(shape(en)).toEqual(shape(fr))
      for (const key of ['figures', 'nav']) expect(en[key]).toHaveLength(fr[key].length)
      expect(en.faq.items).toHaveLength(fr.faq.items.length)
      expect(en.presentation.chapters).toHaveLength(PRESENTATION.chapters.length)
    })

    it('name every clip the footage slots hold', () => {
      for (const t of [fr, en]) {
        expect(Object.keys(t.features.items)).toEqual(CLIPS.map(c => c.id))
      }
    })

    it('count the decks the app serves', () => {
      expect(facts.words).toBe(JSON.parse(read('../backend/datas/vocab/vocab_served.json')).length)
      expect(facts.grammar).toBeGreaterThan(500)
    })
  })
})
