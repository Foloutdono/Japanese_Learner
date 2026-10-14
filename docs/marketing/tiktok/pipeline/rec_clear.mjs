// Today -> Depart -> three cards (the first levels up) -> the day cleared
// on the 30th day in a row: Service complete, the stamp card, the 一ヶ月 ticket.
import { phone } from './common.mjs'
import { startRec, tap } from './rec.mjs'
const { browser, page } = await phone()
await page.goto('http://localhost:5173/today'); await page.waitForTimeout(4000)
const stop = await startRec(page, 'clear')
await page.waitForTimeout(2200)
await tap(page, page.locator('button:has-text("Depart")').first(), 2700)
for (let i = 0; i < 3; i++) {
  await tap(page, page.locator('[class*=card]:visible').filter({ hasText: /TAP TO REVEAL/i }).first(), 1300)
  await tap(page, page.getByRole('button', { name: /^Correct/ }).first(), i === 0 ? 3200 : 1500)
}
await page.waitForTimeout(17000)
console.log(page.url())
await stop(); await browser.close()
