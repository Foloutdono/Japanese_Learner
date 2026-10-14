import { phone, U_NEW } from './common.mjs'
import { startRec, tap } from './rec.mjs'
const { browser, page } = await phone({ uid: U_NEW, signedIn: false })
const btn = (n) => page.getByRole('button', { name: n }).first()
const cont = async (p = 1100) => { await tap(page, page.locator('button:visible:has-text("Continue")').last(), p) }
const log = (m) => console.log(((Date.now() - T0) / 1000).toFixed(1), m)
const head = async () => (await page.locator('h1:visible, h2:visible').first().innerText().catch(() => '')).replace(/\n/g, ' ')
await page.goto('about:blank')
const stop = await startRec(page, 'onboard'); const T0 = Date.now()
await page.goto('http://localhost:5173/app'); log('welcome')
await page.waitForTimeout(5500)
await tap(page, '[data-action=board]', 1800); log('name')
const input = page.locator('input:visible').first()
await input.tap(); await input.fill(''); await page.waitForTimeout(300)
await input.pressSequentially('Alex', { delay: 140 }); await page.waitForTimeout(600)
await cont(1300)
for (let i = 0; i < 12; i++) {
  const h = await head(); log('step: ' + h)
  if (/Why are you/.test(h)) { await tap(page, btn('For a trip to Japan'), 700); await cont(1300) }
  else if (/read this/.test(h)) { await tap(page, btn(/Only すし/), 2600) }
  else if (/goal/.test(h)) { await tap(page, btn(/^N4/), 1100); await cont(1500) }
  else if (/rhythm/.test(h)) { await tap(page, btn(/Rapid/), 1000); await cont(1500) }
  else if (/When do you/.test(h)) { await tap(page, btn(/Evening/), 1100); await cont(1200) }
  else if (/plan is ready/.test(h)) { await page.waitForTimeout(5200); log('plan shown'); await cont(1000) }
  else if (/Keep your progress/.test(h)) {
    await page.waitForTimeout(1600)
    const em = page.locator('input[type=email]:visible'); await em.tap(); await em.pressSequentially('alex@mail.com', { delay: 55 })
    const pw = page.locator('input[type=password]:visible'); await pw.tap(); await pw.pressSequentially('tsuji-ride', { delay: 45 })
    await page.waitForTimeout(500); await tap(page, '[data-action=account-create]', 2500)
  }
  else if (/pass is ready/.test(h)) { await page.waitForTimeout(4000); await tap(page, '[data-action=enter]', 300); log('enter'); break }
  else { await page.waitForTimeout(900); await cont(1500) }
}
await page.waitForTimeout(6500); log(page.url())
await page.screenshot({ path: 'ob_after.png', scale: 'css' })
console.log((await page.innerText('body')).replace(/\n+/g,' | ').slice(0,300))
await stop()
await browser.close()
