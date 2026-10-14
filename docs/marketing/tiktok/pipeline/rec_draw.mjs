import { phone } from './common.mjs'
import { startRec, tap, drawKanji, mark } from './rec.mjs'
import { watchAnswers } from './answers.mjs'
const { browser, page } = await phone()
const A = watchAnswers(page)
await page.goto('http://localhost:5173/learn/kanji/N5'); await page.waitForTimeout(3500)
const stop = await startRec(page, 'draw')
await page.waitForTimeout(1500)
await tap(page, page.locator('a:visible, button:visible').filter({ hasText: 'Draw the kanji' }).first(), 2200)
await mark(page, 'draw-grid', '.canvas-holder')
const body = await page.innerText('body')
const kc = A.kanji.find(k => k.kana && body.includes(k.kana))
if (!kc) { console.log('NO CARD MATCH', A.kanji.map(k => k.kanji + ' ' + k.kana).join(' | ')); process.exit(1) }
console.log('drawing', kc.kanji, kc.meaning)
await drawKanji(page, '.canvas-board', kc.kanji.codePointAt(0).toString(16).padStart(5, '0'), { msPerStroke: 520 })
await page.waitForTimeout(1200)
await tap(page, page.locator('button:has-text("Reveal answer")').first(), 2400)
await tap(page, page.getByRole('button', { name: /^Correct/ }).first(), 1600)
await stop(); await browser.close()
