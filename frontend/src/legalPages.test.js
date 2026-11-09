import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { flagSvg } from './components/ui/flags.js'

// ── The privacy policy and the account-deletion page (plan 302) ──
// Two static pages in public/, written by hand, each with its switch
// between the three languages. Their flags are copies of the app's
// (components/ui/flags.js), pasted as SVG because nothing builds these
// pages: this holds every copy to the one the app draws, so a flag
// changed there cannot stay old here.

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const LANGS = { fr: 'Français', en: 'English', es: 'Español' }

describe.each(['public/privacy.html', 'public/delete-account.html'])('%s', path => {
  const html = read(path)
  const nav = html.slice(html.indexOf('<nav class="lang"'), html.indexOf('</nav>', html.indexOf('<nav class="lang"')))

  it('switches between every language, each beside the app’s own flag', () => {
    for (const [code, name] of Object.entries(LANGS)) {
      // The flag, then the name (the privacy policy's pill also carries
      // the code it shows under 360px instead).
      const after = nav.slice(nav.indexOf(flagSvg(code)) + flagSvg(code).length)
      expect(nav, code).toContain(flagSvg(code))
      expect(after.replace('<span class="lang__name">', '').startsWith(name), code).toBe(true)
      expect(html, `#${code}`).toContain(`<section id="${code}" lang="${code}">`)
    }
    expect(nav.match(/<svg /g)).toHaveLength(Object.keys(LANGS).length)
  })
})
