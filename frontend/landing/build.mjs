// ── 辻 — `npm run landing`: the landing pages, regenerated (plan 167) ──
// Writes the two pages under public/landing/, the Latin faces beside
// them, and the site's sitemap.xml and robots.txt. The output is
// committed, as public/privacy.html is: Vite copies public/ into the
// build untouched, so the deployment needs no step of its own, and a
// test (src/landing.test.js) fails when the committed pages drift from
// what this script would write. Run it after changing anything in
// frontend/landing/ or a deck the page counts.
import { mkdirSync, writeFileSync, copyFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PAGES, SITE_ORIGIN, mediaBase } from './config.mjs'
import { readFacts } from './content.mjs'
import { renderPage } from './page.mjs'

const root = new URL('../', import.meta.url)
const out = path => fileURLToPath(new URL(path, root))

function write(path, text) {
  mkdirSync(dirname(out(path)), { recursive: true })
  writeFileSync(out(path), text)
}

/** Every file the build writes, as { path: text }: the test compares
 *  these to the committed ones without writing anything. */
export function landingFiles() {
  const facts = readFacts()
  const media = mediaBase()
  const files = {}
  for (const page of Object.values(PAGES)) files[page.out] = renderPage(page.lang, facts, media)
  const alternates = Object.values(PAGES)
    .map(p => `    <xhtml:link rel="alternate" hreflang="${p.lang}" href="${SITE_ORIGIN}${p.path}"/>`).join('\n')
  files['public/sitemap.xml'] = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${Object.values(PAGES).map(p => `  <url>
    <loc>${SITE_ORIGIN}${p.path}</loc>
${alternates}
  </url>`).join('\n')}
</urlset>
`
  files['public/robots.txt'] = `User-agent: *
Allow: /

Sitemap: ${SITE_ORIGIN}/sitemap.xml
`
  return files
}

// The Latin faces the page sets its words in, copied from the package
// the app already loads them from (src/main.jsx).
const FACES = ['400', '500', '700'].map(w => `space-grotesk-latin-${w}-normal.woff2`)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  for (const [path, text] of Object.entries(landingFiles())) {
    write(path, text)
    console.log(`wrote ${path}`)
  }
  mkdirSync(out('public/landing/fonts'), { recursive: true })
  for (const face of FACES) {
    copyFileSync(out(`node_modules/@fontsource/space-grotesk/files/${face}`), out(`public/landing/fonts/${face}`))
  }
  console.log(`copied ${FACES.length} faces to public/landing/fonts/`)
}
