import { phone } from './common.mjs'
import { startRec, tap, drawKanji } from './rec.mjs'
import { watchAnswers, answerChoose } from './answers.mjs'
const { browser, page } = await phone()
const A = watchAnswers(page)
const dump = async () => console.log((await page.innerText('body')).replace(/\n+/g, ' | ').slice(0, 300))
// ladder
await page.goto('http://localhost:5173/learn'); await page.waitForTimeout(3500)
let stop = await startRec(page, 'ladder')
await page.waitForTimeout(1000)
await tap(page, page.locator('a:visible, button:visible').filter({ hasText: /^BP\s*Grammar/ }).first(), 1600)
console.log('after grammar tap', page.url())
if (!/grammar\/N5/.test(page.url())) { const n5 = page.locator('a:visible, button:visible').filter({ hasText: /N5/ }).first(); await tap(page, n5, 1600) }
console.log('now', page.url())
await tap(page, page.locator('a:visible, button:visible').filter({ hasText: 'Climb the ladder' }).first(), 2600)
await dump()
if (/Which one fits/i.test(await page.innerText('body'))) await answerChoose(page, A, { tapFn: l => tap(page, l, 2600) })
await dump()
await stop()
// kanji draw
await page.goto('http://localhost:5173/learn/kanji/N5'); await page.waitForTimeout(3500)
stop = await startRec(page, 'draw')
await page.waitForTimeout(800)
await tap(page, page.locator('a:visible, button:visible').filter({ hasText: 'Draw the kanji' }).first(), 2000)
await dump()
const body = await page.innerText('body')
const kc = A.kanji.find(k => body.includes(JSON.stringify(k).match(/"meaning[s]?":\s*"([^"]+)"/)?.[1] ?? '@@')) || A.kanji[0]
const ch = kc.kanji; console.log('drawing', ch, Object.keys(kc).join(','))
await drawKanji(page, '.canvas-board', ch.codePointAt(0).toString(16).padStart(5, '0'), { msPerStroke: 600 })
await page.waitForTimeout(900)
await tap(page, page.locator('button:has-text("Reveal answer")').first(), 2200)
await dump()
await tap(page, page.getByRole('button', { name: /^Correct/ }).first(), 1500)
await stop()
await browser.close()
