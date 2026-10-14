import { phone } from './common.mjs'
import { startRec, tap, mark } from './rec.mjs'
const { browser, page } = await phone()
let batch = null
page.on('response', async r => { if (/\/api\/reading\/batch/.test(r.url())) { try { batch = await r.json() } catch {} } })
await page.goto('http://localhost:5173/practice/reading/level/N5'); await page.waitForTimeout(3500)
const stop = await startRec(page, 'readprac')
await page.waitForTimeout(800)
for (let i = 0; i < 1; i++) {
  await tap(page, page.getByRole('button', { name: /Show the sentence/ }), 1500)
  const body = await page.innerText('body')
  const p = batch.phrases.find(p => body.includes(p.phrase)) || batch.phrases[i]
  console.log(p.phrase, p.romaji)
  const inp = page.locator('input:visible, textarea:visible').first()
  await inp.tap(); await inp.pressSequentially(p.romaji.replace(/[.。]$/, ''), { delay: 60 })
  await page.waitForTimeout(400)
  await tap(page, page.getByRole('button', { name: 'Submit' }), 1400)
  await mark(page, 'read-result', { texts: [p.phrase.slice(-3), p.translation, '100%', p.romaji.replace(/[.。]$/, '').split(' ')[0]] })
  await page.waitForTimeout(1600)
  console.log((await page.innerText('body')).replace(/\n+/g, ' | ').slice(0, 250))
  await tap(page, page.getByRole('button', { name: /^Correct/ }).first(), 1800)
}
await stop(); await browser.close()
