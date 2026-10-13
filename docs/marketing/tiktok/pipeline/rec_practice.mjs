import { phone } from './common.mjs'
import { startRec, tap, swipe } from './rec.mjs'
import { watchAnswers } from './answers.mjs'
const { browser, page } = await phone()
const A = watchAnswers(page)
await page.goto('http://localhost:5173/practice'); await page.waitForTimeout(3500)
const stop = await startRec(page, 'practice')
await page.waitForTimeout(1300)
await swipe(page, 260, { ms: 700 }); await page.waitForTimeout(700)
await swipe(page, -260, { ms: 600 }); await page.waitForTimeout(500)
// Reading comprehension, N5
await tap(page, page.locator('a:visible, button:visible').filter({ hasText: /^\s*N5\s*$/ }).nth(1), 3200)
console.log(page.url())
await page.waitForTimeout(1200)
await tap(page, page.locator('button:has-text("Done reading")'), 1800)
for (let qi = 0; qi < 2; qi++) {
  const body = await page.innerText('body')
  const q = A.comp.questions.find(q => body.includes(q.question))
  const letter = 'ABCD'[q.correct]
  console.log('Q', q.question, '->', q.options[q.correct])
  await tap(page, page.locator('button:visible').filter({ hasText: q.options[q.correct] }).first(), 1800)
  await tap(page, page.getByRole('button', { name: 'Next', exact: true }).last(), 1600)
}
await stop(); await browser.close()
