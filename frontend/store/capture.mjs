// Store screenshots, step 1: the app's own screens, captured from a running
// dev stack (backend with DEV_USER_ID, `npm run dev`) on an Android-sized
// 393×740 phone at 3x, with a notch's safe area injected so the app draws as
// it does in the native shell. Besides each whole screen it keeps the pieces
// a slide lifts or floats (a card, a control bar, a sheet), cut exactly to
// their element, and their place on the screen (rects.json, in css px).
//   node store/capture.mjs <fr|en> <main|kanji|today|todaybig> [tablet]
// The tablet is a 7-inch one in portrait, 540×960 at 2x (9:16), in raw/<lang>-tablet/.
import { chromium } from 'playwright'
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { SESSION, KEY } from './session.mjs'

const [lang = 'fr', stage = 'main', device = 'phone'] = process.argv.slice(2)
const TABLET = device === 'tablet'
const px = n => Math.round(n * (TABLET ? 540 / 393 : 1))
const VW = TABLET ? 540 : 393, VH = TABLET ? 960 : 740, DPR = TABLET ? 2 : 3, F = VW / 393
const OUT = new URL(`./raw/${lang}${TABLET ? '-tablet' : ''}/`, import.meta.url).pathname
mkdirSync(OUT, { recursive: true })
const RECTS = OUT + 'rects.json'
const rects = existsSync(RECTS) ? JSON.parse(readFileSync(RECTS, 'utf8')) : {}
const BASE = process.env.BASE || 'http://127.0.0.1:5173'
const L = {
  fr: { vocab: /Vocabulaire/i, gramTab: /Grammaire/i, start: /Commencer/, next: /Suivante/, cont: /Continuer/, show: /Montre-moi/, gloss: 'Train électrique', roll: /Texte entier|Défilement/, furi: /Afficher les furigana/, use: /^Emploi$/, kind: /Vocabulaire/ },
  en: { vocab: /Vocabulary/i, gramTab: /Grammar/i, start: /Start|Begin/, next: /Next/, cont: /Continue/, show: /Show me/, gloss: 'Electric train', roll: /Whole text|Scroll|Rolling/, furi: /Show furigana/, use: /^(Use|Uses|Usage)$/, kind: /Vocabulary/ },
}[lang]

const browser = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] })
async function page(safe = true) {
  const ctx = await browser.newContext({ viewport: { width: VW, height: VH }, deviceScaleFactor: DPR, isMobile: !TABLET, hasTouch: true, locale: lang, colorScheme: 'light' })
  await ctx.addInitScript(([l, k, v, safe, TABLET]) => {
    try { localStorage.setItem('lang', l); localStorage.setItem(k, v) } catch {}
    if (!safe) return
    const add = () => { const st = document.createElement('style'); st.textContent = TABLET ? ':root{--safe-top:30px !important;--safe-bottom:0px !important}' : ':root{--safe-top:54px !important;--safe-bottom:30px !important}'; document.head.appendChild(st) }
    if (document.head) add(); else document.addEventListener('DOMContentLoaded', add)
  }, [lang, KEY, JSON.stringify(SESSION), safe, TABLET])
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
  const c = { x: Math.max(0, x - pad), y: Math.max(0, y - pad), width: Math.min(VW, w + 2 * pad) , height: h + 2 * pad }
  if (c.x + c.width > VW) c.width = VW - c.x
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
  await p.locator('.hud__status').first().click(); await p.waitForTimeout(2000)
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
  // on a tablet the question card is a tall empty slab: the piece lifted is the card squeezed to its stem
  if (TABLET) { await p.addStyleTag({ content: '.exam-page{flex:none !important;height:360px !important;min-height:0 !important}' }); await p.waitForTimeout(600) }
  const pg = await box(p.locator('.exam-page'))
  const ch = union(await Promise.all([0, 1, 2, 3].map(i => box(p.locator('.exam-dock button').nth(i)))))
  await piece('exam_page', [4, pg[1] - 4, VW - 8, ch[1] + ch[3] + 10 - (pg[1] - 4)])
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
  await piece('dict_entry', [0, top[1] - 14, VW, last[1] + last[3] + 18 - (top[1] - 14)])
  await go('/dictionary', 3000)
  await p.getByRole('button', { name: L.gramTab }).first().click(); await p.waitForTimeout(1500)
  await p.getByRole('button', { name: /^N4$/ }).first().click(); await p.waitForTimeout(1500)
  const i3 = p.locator('input').first(); await i3.click(); await i3.fill('ので'); await p.waitForTimeout(2500)
  await p.locator('main button').filter({ hasText: /ので/ }).first().click(); await p.waitForTimeout(5000)
  const t2 = await box(p.getByText(/^(NOUVEAU|NEW)$/i)), use = await box(p.locator(`text=${L.use}`))
  await piece('fiche', [0, t2[1] - 14, VW, use[1] - 16 - (t2[1] - 14)])
}

if (stage === 'today') {
  // Pieces of Today for the slide's variants: the day's forecast and the four lines' counts.
  p = await page()
  await p.clock.install({ time: new Date(2026, 9, 22, 17, 20) })
  await go('/today', 5500); await shot('today')
  const eta = await box(p.locator('.tdy-dial__line')), keys = await box(p.locator('.tdy-key--lines'))
  await piece('today_eta', union([eta, keys]), 6)
  await piece('today_counts', keys, 8)
  await piece('today_sun', await box(p.locator('.tdy-dial')))
  await piece('today_depart', await box(p.locator('.btn-depart')), 4)
  const d = await box(p.locator('.tdy-dial'))
  await piece('today_dial', [24, d[1] - 34, 300, d[3] + 96])
}

if (stage === 'todaybig') {
  // Today with the dial grown: a bigger disc, and what the count is (à réviser / due) set large.
  for (const [name, hour] of [['today_big', 17], ['today_big_night', 22]]) {
    p = await page()
    await p.clock.install({ time: new Date(2026, 9, 22, hour, 20) })
    await p.goto(BASE + '/today'); await p.waitForTimeout(1500)
    const def = (await box(p.locator('.tdy-dial')))[2]
    const dw = TABLET ? Math.round(def * 1.2) : 376, mt = TABLET ? 18 : -62
    await p.addStyleTag({ content: `
      .tdy-dial--print{width:${dw}px !important;margin:${mt}px 0 ${px(40)}px}
      .tdy-dial--print .tdy-dial__count{font-size:${px(104)}px !important}
      .tdy-dial--print .tdy-dial__unit{font-size:${px(lang === 'fr' ? 27 : 38)}px !important;font-weight:800 !important;letter-spacing:.06em !important;text-indent:.06em !important;margin-top:2px}
      .tdy-dial--print .tdy-dial__disc{filter:drop-shadow(0 0 ${px(16)}px rgba(255,240,205,.75))}
      .tpr-title{display:none !important}
      .tdy-dial--print .tdy-dial__line{background:rgba(10,14,40,.62);padding:7px ${px(18)}px;border-radius:${px(999)}px;white-space:nowrap;backdrop-filter:blur(8px);box-shadow:0 0 0 1px rgba(255,255,255,.14)}
      .tdy-dial__time{font-size:${px(24)}px !important;color:#fff !important}
      .tdy-dial__end{font-size:${px(15)}px !important;color:rgba(255,255,255,.82) !important}
      .tdy-key--lines{margin-top:${px(46)}px !important;background:rgba(10,14,40,.62);padding:6px ${px(20)}px;border-radius:${px(999)}px;backdrop-filter:blur(8px);box-shadow:0 0 0 1px rgba(255,255,255,.14);gap:${px(18)}px !important}
      .tdy-key--lines b{font-size:${px(19)}px !important;color:#fff !important}
      .tdy-key__ring{width:${px(13)}px !important;height:${px(13)}px !important}
      .tdy-dial__disc g[clip-path]{opacity:.5 !important;fill:#b39a63 !important}
      .tdy-dial--print .tdy-dial__glow{filter:drop-shadow(0 0 ${px(30)}px rgba(255,238,190,.8))}` })
    await p.evaluate(([lang, F]) => {
      // the gate button says what the headline says, and says it bigger
      const b = document.querySelector('.btn-depart')
      const label = [...b.querySelectorAll('*')].filter(e => !e.children.length && e.textContent.trim()).pop()
      if (label) { if (lang === 'en') label.textContent = 'Board'; label.style.fontSize = `${30 * F}px`; label.style.fontWeight = '800'; label.style.letterSpacing = '.01em' }
    }, [lang, F])
    await p.waitForTimeout(4500); await shot(name)
    if (hour === 17) {
      await piece('today_depart', await box(p.locator('.btn-depart')), 4)
      await piece('today_sun_big', await box(p.locator('.tdy-dial')))
    }
  }
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
  const kc = await box(p.locator('.prompt-card').first())
  await piece('kanji_readings', [kc[0], kc[1], kc[2], Math.round(kc[2] * 0.83)], 0)
}
writeFileSync(RECTS, JSON.stringify(rects, null, 1))
await browser.close()
