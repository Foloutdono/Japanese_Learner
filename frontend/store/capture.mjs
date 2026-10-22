// Store screenshots, step 1: the app's own screens, captured from a running
// dev stack (backend with DEV_USER_ID, `npm run dev`) on an Android-sized
// 393×740 phone at 3x, with a notch's safe area injected so the app draws as
// it does in the native shell. Besides each whole screen it keeps the pieces
// a slide lifts or floats (a card, a control bar, a sheet), cut exactly to
// their element, and their place on the screen (rects.json, in css px).
//   node store/capture.mjs <fr|en> <main|kanji>
import { chromium } from 'playwright'
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { SESSION, KEY } from './session.mjs'

const [lang = 'fr', stage = 'main'] = process.argv.slice(2)
const OUT = new URL(`./raw/${lang}/`, import.meta.url).pathname
mkdirSync(OUT, { recursive: true })
const RECTS = OUT + 'rects.json'
const rects = existsSync(RECTS) ? JSON.parse(readFileSync(RECTS, 'utf8')) : {}
const BASE = process.env.BASE || 'http://127.0.0.1:5173'
const VH = 740
const L = {
  fr: { vocab: /Vocabulaire/i, gramTab: /Grammaire/i, start: /Commencer/, next: /Suivante/, cont: /Continuer/, show: /Montre-moi/, gloss: 'Train électrique', roll: /Texte entier|Défilement/, furi: /Afficher les furigana/, use: /^Emploi$/, kind: /Vocabulaire/ },
  en: { vocab: /Vocabulary/i, gramTab: /Grammar/i, start: /Start|Begin/, next: /Next/, cont: /Continue/, show: /Show me/, gloss: 'Electric train', roll: /Whole text|Scroll|Rolling/, furi: /Show furigana/, use: /^(Use|Uses|Usage)$/, kind: /Vocabulary/ },
}[lang]

const browser = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] })
async function page(safe = true) {
  const ctx = await browser.newContext({ viewport: { width: 393, height: VH }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, locale: lang, colorScheme: 'light' })
  await ctx.addInitScript(([l, k, v, safe]) => {
    try { localStorage.setItem('lang', l); localStorage.setItem(k, v) } catch {}
    if (!safe) return
    const add = () => { const st = document.createElement('style'); st.textContent = ':root{--safe-top:54px !important;--safe-bottom:30px !important}'; document.head.appendChild(st) }
    if (document.head) add(); else document.addEventListener('DOMContentLoaded', add)
  }, [lang, KEY, JSON.stringify(SESSION), safe])
  return ctx.newPage()
}
let p
const shot = async name => { await p.screenshot({ path: `${OUT}${name}.png` }); console.log('shot', name) }
const go = async (path, ms = 4500) => { await p.goto(BASE + path); await p.waitForTimeout(ms) }
const box = async loc => { const b = await loc.first().boundingBox(); if (!b) throw new Error('no box'); return [b.x, b.y, b.width, b.height] }
const union = bs => { const x = Math.min(...bs.map(b => b[0])), y = Math.min(...bs.map(b => b[1])), r = Math.max(...bs.map(b => b[0] + b[2])), t = Math.max(...bs.map(b => b[1] + b[3])); return [x, y, r - x, t - y] }
// A piece of the screen, cut to a css-px rect (padded), kept with its place.
const piece = async (name, rect, pad = 0) => {
  const [x, y, w, h] = rect
  const c = { x: Math.max(0, x - pad), y: Math.max(0, y - pad), width: Math.min(393, w + 2 * pad) , height: h + 2 * pad }
  if (c.x + c.width > 393) c.width = 393 - c.x
  await p.screenshot({ path: `${OUT}${name}.png`, clip: c })
  rects[name] = [c.x, c.y, c.width, c.height]; console.log('piece', name, rects[name].map(Math.round).join(','))
}

if (stage === 'main') {
  // 1 + goal: Today at dusk, the dial lifted, and the goal card (the status sheet's).
  p = await page()
  await p.clock.install({ time: new Date(2026, 9, 22, 17, 20) })
  await go('/today', 5500); await shot('today')
  const d = await box(p.locator('.tdy-dial'))
  await piece('today_dial', [24, d[1] - 34, 300, d[3] + 96])
  await piece('today_sun', await box(p.locator('.tdy-dial')))
  await piece('today_depart', await box(p.locator('.btn-depart')), 4)
  await p.locator('.hud').first().click({ position: { x: 40, y: 80 } }); await p.waitForTimeout(2000)
  await piece('goal_card', await box(p.locator('.jcard')), 3)
  // 2: a grammar question.
  p = await page()
  await go('/learn/grammar/N5/grammar.contrast'); await shot('grammar')
  // 3: the dictionary, its results and the first one lifted.
  await go('/dictionary', 3000)
  await p.getByRole('button', { name: L.vocab }).first().click(); await p.waitForTimeout(800)
  const inp = p.locator('input').first(); await inp.click(); await inp.fill('電車'); await p.waitForTimeout(3500); await shot('dictionary')
  const tile = p.getByText(L.gloss).first().locator('xpath=ancestor::button[1]')
  await piece('dictionary_tile', await box(tile), 3)
  // 4: the practice stations; the first three lifted.
  await go('/practice'); await shot('practice')
  await piece('practice_plates', union(await Promise.all([0, 1, 2].map(i => box(p.locator('.plate').nth(i))))), 4)
  // 5: a mock exam, the ★ ordering item lifted, and the paper's cover.
  await go('/practice/exam/n5-grammar-01', 3500)
  await p.getByRole('button', { name: L.start }).first().click(); await p.waitForTimeout(2500)
  for (let k = 1; k < 9; k++) { await p.getByRole('button', { name: L.next }).first().click(); await p.waitForTimeout(300) }
  await p.waitForTimeout(600); await shot('exam')
  const pg = await box(p.locator('.exam-page'))
  const ch = union(await Promise.all([0, 1, 2, 3].map(i => box(p.locator('.exam-dock button').nth(i)))))
  await piece('exam_page', [4, pg[1] - 4, 385, ch[1] + ch[3] + 10 - (pg[1] - 4)])
  await go('/practice/exam/n5-vocab-01', 3500)
  await piece('exam_cover', await box(p.locator('.exam-cover')), 3)
  // 7: a vocab flashcard, answered side shown; the rating bar lifted.
  await go('/learn/vocab/N5/vocab.flashcard.f2b', 5500)
  await p.locator('.prompt-card').first().click(); await p.waitForTimeout(1200); await shot('flash')
  await piece('flash_rating', await box(p.locator('.rating-bar__buttons')), 6)
  // 8: a comprehension text rolling up its card, the controls lifted.
  await go('/practice/comprehension/N5', 5500)
  await p.locator('.roll-chip').click(); await p.waitForTimeout(700)
  await p.getByRole('button', { name: L.furi }).first().click().catch(() => {}); await p.waitForTimeout(2500); await shot('comp')
  const cc = await box(p.locator('.prompt-card--roll')), cl = await box(p.locator('.roll-ctl'))
  await piece('comp_ctl', cl, 8)
  await piece('comp_text', [cc[0], cc[1], cc[2], cl[1] - 8 - cc[1]], 0)
  // The pieces that stand on a sheet are cut where the sheet is not pushed down by the injected inset.
  p = await page(false)
  await go('/dictionary', 3000)
  await p.getByRole('button', { name: L.vocab }).first().click(); await p.waitForTimeout(800)
  const i2 = p.locator('input').first(); await i2.click(); await i2.fill('電車'); await p.waitForTimeout(3500)
  await p.getByText(L.gloss).first().click(); await p.waitForTimeout(4500)
  const top = (await box(p.getByText(/^(NOUVEAU|NEW)$/i))), last = await box(p.locator('text=/^(Véhicule|Car)$/'))
  await piece('dict_entry', [0, top[1] - 14, 393, last[1] + last[3] + 18 - (top[1] - 14)])
  await go('/dictionary', 3000)
  await p.getByRole('button', { name: L.gramTab }).first().click(); await p.waitForTimeout(1500)
  await p.getByRole('button', { name: /^N4$/ }).first().click(); await p.waitForTimeout(1500)
  const i3 = p.locator('input').first(); await i3.click(); await i3.fill('ので'); await p.waitForTimeout(2500)
  await p.locator('main button').filter({ hasText: /ので/ }).first().click(); await p.waitForTimeout(5000)
  const t2 = await box(p.getByText(/^(NOUVEAU|NEW)$/i)), use = await box(p.locator(`text=${L.use}`))
  await piece('fiche', [0, t2[1] - 14, 393, use[1] - 16 - (t2[1] - 14)])
}

if (stage === 'kanji') {
  // 6: a kanji met for the first time, traced stroke by stroke (初見), then its card turned,
  // the readings' shares marked.
  p = await page()
  await go('/learn/kanji/N5/kanji.flashcard.f2b', 7000)
  await p.getByRole('button', { name: L.cont }).click(); await p.waitForTimeout(1500)
  const stroke = async () => {
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
  for (let s = 0; s < 6; s++) await stroke()
  await p.waitForTimeout(900); await shot('kanji_trace')
  await piece('kanji_board', await box(p.locator('.gt-board')), 10)
  // on through the tour to the card's own exercise
  await p.getByRole('button', { name: L.show }).click(); await p.waitForTimeout(7000)
  await p.getByRole('button', { name: L.cont }).click(); await p.waitForTimeout(2500)
  await p.getByRole('button', { name: L.start }).click(); await p.waitForTimeout(3500)
  await p.locator('.prompt-card').first().click(); await p.waitForTimeout(1200)
  await p.addStyleTag({ content: '.reading-share__pct{background:#ffe08f !important;color:#3a2a00 !important;padding:2px 10px !important;border-radius:12px !important;font-weight:700 !important}' })
  await p.waitForTimeout(300); await shot('kanji_card')
  await piece('kanji_readings', await box(p.locator('.prompt-card').first()), 0)
}
writeFileSync(RECTS, JSON.stringify(rects, null, 1))
await browser.close()
