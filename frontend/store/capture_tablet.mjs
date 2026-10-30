// Store screenshots, tablet (7-inch, landscape 16:9): the app's own screens at a tablet's
// width, 1280×720 css px at 2x, where it draws its wide layout (the rail, the side panels),
// into raw/<lang>-tablet7/, with the pieces a slide lifts or enlarges (rects.json, css px).
//   node store/capture_tablet.mjs <fr|en> <main|kanji>
import { chromium } from 'playwright'
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { SESSION, KEY } from './session.mjs'

const [lang = 'fr', stage = 'main'] = process.argv.slice(2)
const OUT = new URL(`./raw/${lang}-tablet7/`, import.meta.url).pathname
mkdirSync(OUT, { recursive: true })
const RECTS = OUT + 'rects.json'
const rects = existsSync(RECTS) ? JSON.parse(readFileSync(RECTS, 'utf8')) : {}
const BASE = process.env.BASE || 'http://127.0.0.1:5173'
const L = {
  fr: { vocab: /Vocabulaire/i, start: /Commencer/, next: /Suivante/, cont: /Continuer/, show: /Montre-moi/, gloss: 'Train électrique', goal: /en avance|en retard/i },
  en: { vocab: /Vocabulary/i, start: /Start|Begin/, next: /Next/, cont: /Continue/, show: /Show me/, gloss: 'Electric train', goal: /ahead|behind/i },
}[lang]

const browser = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] })
const page = async () => {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 2, hasTouch: true, locale: lang, colorScheme: 'light' })
  await ctx.addInitScript(([l, k, v]) => { try { localStorage.setItem('lang', l); localStorage.setItem(k, v) } catch {} }, [lang, KEY, JSON.stringify(SESSION)])
  return ctx.newPage()
}
let p
const shot = async name => { await p.screenshot({ path: `${OUT}${name}.png` }); console.log('shot', name) }
const go = async (path, ms = 4500) => { await p.goto(BASE + path); await p.waitForTimeout(ms) }
const box = async loc => { const b = await loc.first().boundingBox(); if (!b) throw new Error('no box'); return [b.x, b.y, b.width, b.height] }
const piece = async (name, rect) => {
  const [x, y, w, h] = rect
  await p.screenshot({ path: `${OUT}${name}.png`, clip: { x, y, width: w, height: h } })
  rects[name] = rect.map(Math.round); console.log('piece', name, rects[name].join(','))
}

if (stage === 'main') {
  // 1 Today at dusk: the day's plan panel, the Board button.
  p = await page()
  await p.clock.install({ time: new Date(2026, 9, 22, 17, 20) })
  await go('/today', 9000)
  // the gate button says what the title says
  if (lang === 'en') await p.evaluate(() => { const b = document.querySelector('.btn-depart'); const t = [...b.querySelectorAll('*')].filter(e => !e.children.length && /^Depart$/.test(e.textContent.trim())).pop(); if (t) t.textContent = 'Board' })
  await shot('today')
  const col = await box(p.locator('.tdy-desk__col'))
  await piece('today_plan', [col[0], col[1], col[2], 316])
  await piece('today_board', await box(p.locator('.btn-depart')))
  // 2 A grammar answer: the card, and the fiche that opens beside it.
  p = await page()
  await go('/learn/grammar/N5/grammar.contrast'); await p.keyboard.press('1'); await p.waitForTimeout(1800); await shot('grammar')
  await piece('grammar_fiche', [896, 12, 372, 696])
  // 3 The dictionary: the results and the entry beside them.
  await go('/dictionary', 3000)
  await p.getByRole('button', { name: L.vocab }).first().click(); await p.waitForTimeout(800)
  const inp = p.locator('input').first(); await inp.click(); await inp.fill('電車'); await p.waitForTimeout(3500); await shot('dictionary')
  await piece('dict_entry', [820, 16, 448, 466])
  // 4 Practice: the seven stations, each with its exercise in miniature.
  await go('/practice'); await shot('practice')
  // 5 A mock exam question, and the answer sheet beside it.
  await go('/practice/exam/n5-grammar-01', 3500)
  await p.getByRole('button', { name: L.start }).first().click(); await p.waitForTimeout(2500)
  for (let k = 1; k < 9; k++) { await p.getByRole('button', { name: L.next }).first().click(); await p.waitForTimeout(300) }
  await p.waitForTimeout(600); await shot('exam')
  await piece('exam_sheet', [920, 0, 360, 520])
  // 7 A flashcard answered: what each rating schedules, and the goal card.
  await go('/learn/vocab/N5/vocab.flashcard.f2b', 5500)
  await p.locator('.prompt-card').first().click(); await p.waitForTimeout(1200); await shot('flash')
  await piece('flash_intervals', [20, 168, 316, 480])
  await go('/today', 4500)
  await p.locator('.desk-holder__st').click(); await p.waitForTimeout(2500); await shot('goal_sheet')
  await piece('goal_card', [266, 444, 358, 262])
  // 8 A comprehension text rolling up its card.
  await go('/practice/comprehension/N5', 5500)
  await p.locator('.roll-chip').click(); await p.waitForTimeout(3000); await shot('comp')
  await piece('comp_ctl', await box(p.locator('.roll-ctl')))
  await piece('comp_card', await box(p.locator('.prompt-card--roll')))
}

if (stage === 'kanji') {
  // 6 A kanji met for the first time, traced stroke by stroke.
  p = await page()
  await go('/learn/kanji/N5/kanji.flashcard.f2b', 7000)
  await p.getByRole('button', { name: L.cont }).click(); await p.waitForTimeout(1500)
  for (let s = 0; s < 6; s++) {
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
  await p.waitForTimeout(900); await shot('kanji')
  await piece('kanji_board', await box(p.locator('.gt-board')))
  await p.getByRole('button', { name: L.show }).click(); await p.waitForTimeout(7000)
  await p.getByRole('button', { name: L.cont }).click(); await p.waitForTimeout(2500)
  await p.getByRole('button', { name: L.start }).click(); await p.waitForTimeout(3500)
  await p.locator('.prompt-card').first().click(); await p.waitForTimeout(1200)
  await p.addStyleTag({ content: '.reading-share__pct{background:#ffe08f !important;color:#3a2a00 !important;padding:2px 10px !important;border-radius:12px !important;font-weight:700 !important}' })
  await p.waitForTimeout(300); await shot('kanji_card')
  await piece('kanji_readings', [448, 240, 384, 200])
}
writeFileSync(RECTS, JSON.stringify(rects, null, 1))
await browser.close()
