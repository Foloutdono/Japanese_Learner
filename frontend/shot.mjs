import { chromium } from 'playwright'

const SCREENS = [
  ['home', '/'], ['profile', '/profile'], ['stats', '/stats'], ['decks', '/decks'],
  ['storehouse', '/storehouse'], ['daruma', '/daruma'], ['settings', '/settings'],
  ['dictionary', '/dictionary'], ['kana', '/kana'],
]

const browser = await chromium.launch()
const errors = []

for (const theme of ['dark', 'light']) {
  for (const [label, path] of SCREENS) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
    const tag = `${label} ${theme}`
    page.on('pageerror', e => errors.push(`${tag}: ${e.message}`))
    page.on('console', m => {
      const t = m.text()
      if (m.type() === 'error' && !t.includes('404') && !t.includes('Failed to load resource')) errors.push(`${tag}: ${t}`)
    })
    await page.addInitScript(th => {
      window.localStorage.setItem('sb-placeholder-auth-token', JSON.stringify({
        access_token: 'x', refresh_token: 'x', expires_at: 9999999999, expires_in: 3600,
        token_type: 'bearer', user: { id: 'u', email: 'e@x.com' },
      }))
      window.localStorage.setItem('jp-theme', th)
    }, theme)
    await page.route('**/api/**', r => {
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
      if (u.includes('/api/daruma')) return json({
        daily: [], weekly: [], shelf: [], vows: [], vowsTaken: 0, vowSlots: 3,
        streak: 9, tokens: 2, mendableDay: null })
      if (u.includes('/api/cosmetics')) {
        const item = (id, name, owned, equipped) => ({
          id, name, jp: '和紙', desc: 'Washi paper', owned, equipped,
          req: { kind: 'reviews', count: 500 }, progress: 320 })
        const slots = {}
        for (const sl of ['paper', 'ring', 'seal', 'title', 'backdrop', 'flourish', 'brush']) {
          slots[sl] = [item(sl + '1', 'Kozo', true, true), item(sl + '2', 'Sumi', false, false)]
        }
        return json({
          rank: { name: 'Kaiden', jp: '皆伝', level: 5, mastered: 1240, next: 2000, nextLabel: 'Menkyo' },
          ownedCount: 12, totalCount: 36, loadout: {}, slots, unseen: [] })
      }
      // The remaining screens all carry their own offline fallback
      // (buildMockProfile, MOCK_LEADERBOARD, the stats placeholders) —
      // failing the request is what exercises it, and returning an
      // empty 200 is what made them crash.
      return r.fulfill({ status: 503, contentType: 'application/json', body: '{}' })
    })
    try {
      await page.goto('http://localhost:5173' + path, { waitUntil: 'networkidle' })
      await page.waitForTimeout(900)
      const m = await page.evaluate(() => ({
        ov: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        plate: !!document.querySelector('.station-sign'),
        ghosts: [...document.querySelectorAll('.station-header, .platform-card, .deck-card, .daruma-card')]
          .filter(el => Number(getComputedStyle(el).opacity) < 0.99).length,
      }))
      if (m.ov > 0) errors.push(`${tag}: OVERFLOW ${m.ov}px`)
      if (m.ghosts) errors.push(`${tag}: ${m.ghosts} stuck transparent`)
      if (!m.plate && path !== '/') errors.push(`${tag}: NO PLATE`)
      await page.screenshot({ path: `shots/${theme}-${label}.png` })
    } catch (e) { errors.push(`${tag}: ${e.message.split('\n')[0]}`) }
    await page.close()
  }
}
console.log(errors.length ? [...new Set(errors)].join('\n') : 'every screen has its plate, zero overflow, zero errors')
await browser.close()
