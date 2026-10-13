import { phone } from './common.mjs'
import { startRec, tap, swipe } from './rec.mjs'
const { browser, page } = await phone()
await page.goto('http://localhost:5173/profile'); await page.waitForTimeout(4000)
const stop = await startRec(page, 'progress')
await page.waitForTimeout(1500)
await swipe(page, 300, { ms: 700 }); await page.waitForTimeout(1200)
await swipe(page, 360, { ms: 750 }); await page.waitForTimeout(1300)
await swipe(page, -480, { ms: 500 }); await page.waitForTimeout(150); await swipe(page, -480, { ms: 500 }); await page.waitForTimeout(500)
await tap(page, page.locator('a:has-text("Statistics"), button:has-text("Statistics")').first(), 2200)
await swipe(page, 380, { ms: 800 }); await page.waitForTimeout(1500)
await stop(); await browser.close()
