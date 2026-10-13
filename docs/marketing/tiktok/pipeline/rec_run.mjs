import { phone } from './common.mjs'
import { startRec, tap } from './rec.mjs'
import { watchAnswers, answerChoose } from './answers.mjs'
const { browser, page } = await phone()
const A = watchAnswers(page)
await page.goto('http://localhost:5173/today'); await page.waitForTimeout(4000)
const sk = page.getByRole('button', { name: 'Skip', exact: true }); if (await sk.isVisible().catch(() => false)) { await sk.tap(); await page.waitForTimeout(1200) }
const stop = await startRec(page, 'run')
await page.waitForTimeout(2200)
await tap(page, page.locator('button:has-text("Depart")').first(), 2600)
for (let i = 0; i < 4; i++) {
  const card = page.locator('[class*=card]:visible').filter({ hasText: /TAP TO REVEAL/i }).first()
  if (!(await card.count())) { if (/WHICH ONE FITS|Which one fits/.test(await page.innerText('body'))) { await page.waitForTimeout(900); await answerChoose(page, A, { tapFn: l => tap(page, l, 2200) }) } break }
  await tap(page, card, 1300)
  await tap(page, page.getByRole('button', { name: /^Correct/ }).first(), 1500)
}
await page.waitForTimeout(800)
await stop(); await browser.close()
