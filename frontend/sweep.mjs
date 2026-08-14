import { chromium } from 'playwright'

const VIEWPORTS = [[360, 800], [560, 900], [768, 630], [1024, 1000], [1440, 900], [1920, 1080]]
const SCREENS = [
  ['home', '/'], ['profile', '/profile'], ['stats', '/stats'], ['decks', '/decks'],
  ['storehouse', '/storehouse'], ['daruma', '/daruma'], ['settings', '/settings'],
  ['dictionary', '/dictionary'], ['kana', '/kana'], ['vocab', '/vocab'], ['kanji', '/kanji'],
]

const browser = await chromium.launch()
const errors = []
let n = 0

function mock(r) {
  const u = r.request().url()
  const json = b => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(b) })
  if (u.includes('/api/profile')) return json({
    username: 'Folout', level: 55, xp: 1200, xpPrevLevel: 1000, xpForNext: 1500,
    streak: 9, daruma: { ready: 2 }, badges: [], accuracy: 0.82, total_reviews: 4210 })
  if (u.includes('/api/decks')) return json({ decks: [
    { id: 1, name: 'JLPT N3 verbs', type: 'vocab', card_count: 120 },
    { id: 2, name: 'Kanji radicals', type: 'kanji', card_count: 64 },
    { id: 3, name: 'Keigo phrases', type: 'grammar', card_count: 38 }] })
  if (u.includes('/api/stats/extra')) return json({ streak: 9, trend: [], rhythm: null, forecast: [] })
  if (u.includes('/api/stats')) return json({ categories: {}, totals: { new: 40, learning: 22, mastered: 18 } })
  if (u.includes('tiers')) return json({ tiers: Array.from({ length: 6 }, (_, i) => ({
    tier: i, start_rank: i * 500 + 1, end_rank: (i + 1) * 500, count: 500 })) })
  if (u.includes('/api/daruma')) return json({
    daily: [], weekly: [], shelf: [], vows: [], vowsTaken: 0, vowSlots: 3,
    streak: 9, tokens: 2, mendableDay: null })
  if (u.includes('/api/cosmetics')) {
    const item = (id, owned, equipped) => ({
      id, name: 'Kozo', jp: '和紙', desc: 'Washi', owned, equipped,
      req: { kind: 'reviews', count: 500 }, progress: 320 })
    const slots = {}
    for (const sl of ['paper', 'ring', 'seal', 'title', 'backdrop', 'flourish', 'brush']) {
      slots[sl] = [item(sl + '1', true, true), item(sl + '2', false, false)]
    }
    return json({ rank: { name: 'Kaiden', jp: '皆伝', level: 5, mastered: 1240, next: 2000, nextLabel: 'Menkyo' },
      ownedCount: 12, totalCount: 36, loadout: {}, slots, unseen: [] })
  }
  return r.fulfill({ status: 503, contentType: 'application/json', body: '{}' })
}

for (const theme of ['dark', 'light']) {
  for (const lang of ['en', 'fr']) {
    for (const [label, path] of SCREENS) {
      for (const [w, h] of VIEWPORTS) {
        n++
        const page = await browser.newPage({ viewport: { width: w, height: h } })
        const tag = `${label} ${theme}/${lang} ${w}x${h}`
        page.on('pageerror', e => errors.push(`${tag}: ${e.message}`))
        page.on('console', m => {
          const t = m.text()
          if (m.type() === 'error' && !t.includes('404') && !t.includes('Failed to load resource')) errors.push(`${tag}: ${t}`)
        })
        await page.addInitScript(([th, lg]) => {
          window.localStorage.setItem('sb-placeholder-auth-token', JSON.stringify({
            access_token: 'x', refresh_token: 'x', expires_at: 9999999999,
            expires_in: 3600, token_type: 'bearer', user: { id: 'u', email: 'e@x.com' } }))
          window.localStorage.setItem('jp-theme', th)
          window.localStorage.setItem('jp-lang', lg)
        }, [theme, lang])
        await page.route('**/api/**', mock)
        try {
          await page.goto('http://localhost:5173' + path, { waitUntil: 'networkidle' })
          await page.waitForTimeout(700)
          const m = await page.evaluate(() => {
            const d = document.documentElement
            const ghosts = [...document.querySelectorAll(
              '.station-header, .platform-card, .route-stop, .board-row, .deck-card, .daruma-card, .hall-card')]
              .filter(el => Number(getComputedStyle(el).opacity) < 0.99).length
            const plate = document.querySelector('.station-sign')
            return {
              ov: d.scrollWidth - d.clientWidth,
              ghosts,
              plateTop: plate ? Math.round(plate.getBoundingClientRect().top) : 0,
            }
          })
          if (m.ov > 0) errors.push(`${tag}: OVERFLOW ${m.ov}px`)
          if (m.ghosts) errors.push(`${tag}: ${m.ghosts} stuck transparent`)
          if (m.plateTop < 0) errors.push(`${tag}: PLATE CLIPPED ${m.plateTop}px`)
        } catch (e) { errors.push(`${tag}: ${e.message.split('\n')[0]}`) }
        await page.close()
      }
    }
  }
}
console.log(`${n} combinations`)
console.log(errors.length ? [...new Set(errors)].join('\n') : 'zero overflow, nothing clipped, nothing stuck transparent, zero errors')
await browser.close()
