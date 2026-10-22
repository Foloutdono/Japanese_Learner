// Store screenshots, step 1: the app's own screens, captured from a running
// dev stack (backend with DEV_USER_ID, `npm run dev`) at an iPhone 16 Pro's
// 393×852 @3x, with the notch's safe area injected so the app draws as it
// does in the native shell. See README.md.
//   node store/capture.mjs <fr|en> <stage: main|kanji>
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
import { SESSION, KEY } from './session.mjs'

const [lang = 'fr', stage = 'main'] = process.argv.slice(2)
const OUT = new URL(`./raw/${lang}/`, import.meta.url).pathname
mkdirSync(OUT, { recursive: true })
const BASE = process.env.BASE || 'http://127.0.0.1:5173'
const L = {
  fr: { vocab: /Vocabulaire/i, analyze: /^Analyser/, grammar: /Grammaire/, start: /Commencer/, next: /Suivante/, cont: /Continuer/, words: /Mots/, sent: '雨が降っているので、家で本を読みます。', q: '電車', gloss: 'Train électrique' },
  en: { vocab: /Vocabulary/i, analyze: /^Analy[sz]e/, grammar: /Grammar/, start: /Start|Begin/, next: /Next/, cont: /Continue/, words: /Words/, sent: '雨が降っているので、家で本を読みます。', q: '電車', gloss: 'Electric train' },
}[lang]

const browser = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] })
const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, locale: lang, colorScheme: 'light' })
await ctx.addInitScript(([l, k, v]) => {
  try { localStorage.setItem('lang', l); localStorage.setItem(k, v) } catch {}
  const add = () => { const st = document.createElement('style'); st.textContent = ':root{--safe-top:54px !important;--safe-bottom:30px !important}'; document.head.appendChild(st) }
  if (document.head) add(); else document.addEventListener('DOMContentLoaded', add)
}, [lang, KEY, JSON.stringify(SESSION)])
const p = await ctx.newPage()
const shot = async name => { await p.screenshot({ path: `${OUT}${name}.png` }); console.log('shot', name) }
const go = async (path, ms = 4500) => { await p.goto(BASE + path); await p.waitForTimeout(ms) }

if (stage === 'main') {
  // 1 + 7: Today at dusk, and its goal card (the status sheet).
  await p.clock.install({ time: new Date(2026, 9, 22, 17, 20) })
  await go('/today', 5500); await shot('today')
  await p.locator('.hud').first().click({ position: { x: 40, y: 80 } }); await p.waitForTimeout(2000); await shot('goal')
  await p.clock.uninstall?.().catch(() => {})
  // 2: a grammar question, then its trap when the tempting answer is chosen.
  await go('/learn/grammar/N5/grammar.contrast'); await shot('grammar')
  await p.keyboard.press('2'); await p.waitForTimeout(1500); await shot('grammar_trap')
  // 3: the dictionary, and an entry.
  await go('/dictionary', 3000)
  await p.getByRole('button', { name: L.vocab }).first().click(); await p.waitForTimeout(800)
  const inp = p.locator('input[type=search], input[type=text], input:not([type])').first()
  await inp.click(); await inp.fill(L.q); await p.waitForTimeout(3500); await shot('dictionary')
  await p.getByText(L.gloss).first().click(); await p.waitForTimeout(2500); await shot('dictionary_entry')
  // 4: the practice stations.
  await go('/practice'); await shot('practice')
  // 5: a mock exam, the ★ sentence-ordering item.
  await go('/practice/exam/n5-grammar-01', 3500)
  await p.getByRole('button', { name: L.start }).first().click(); await p.waitForTimeout(2500)
  for (let k = 1; k < 11; k++) { await p.getByRole('button', { name: L.next }).first().click(); await p.waitForTimeout(450) }
  await p.waitForTimeout(600); await shot('exam')
  await go('/practice/exam/n5-vocab-01', 3500); await shot('exam_intro')
  // 8: the breakdown.
  await go('/dictionary/analyzer', 3000)
  const ta = p.locator('textarea').first(); await ta.click(); await ta.fill(L.sent)
  await p.getByRole('button', { name: L.analyze }).first().click(); await p.waitForTimeout(5000); await shot('breakdown_sentence')
  await p.getByRole('button', { name: L.grammar }).first().click(); await p.waitForTimeout(1600); await shot('breakdown')
  await p.keyboard.press('Escape'); await p.waitForTimeout(700)
  await p.getByRole('button', { name: L.words }).first().click(); await p.waitForTimeout(1600); await shot('breakdown_words')
}

if (stage === 'kanji') {
  // 6: a kanji met for the first time, traced stroke by stroke (初見).
  await go('/learn/kanji/N5/kanji.flashcard.f2b', 7000); await shot('kanji_read')
  await p.getByRole('button', { name: L.cont }).click(); await p.waitForTimeout(1500)
  for (let s = 0; s < 4; s++) {
    await p.waitForTimeout(900)
    const pts = await p.evaluate(() => {
      const d = document.querySelector('.gt-hollow__edge').getAttribute('d')
      const svg = document.querySelector('.gt-pen')
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path'); path.setAttribute('d', d)
      const len = path.getTotalLength(); const m = svg.getScreenCTM()
      return Array.from({ length: 29 }, (_, i) => { const q = path.getPointAtLength(len * i / 28); return [q.x * m.a + m.e, q.y * m.d + m.f] })
    })
    await p.mouse.move(...pts[0]); await p.mouse.down()
    for (const q of pts.slice(1)) { await p.mouse.move(...q, { steps: 2 }); await p.waitForTimeout(12) }
    await p.mouse.up(); await p.waitForTimeout(700)
  }
  await p.waitForTimeout(900); await shot('kanji_trace')
}
await browser.close()
