import { describe, it, expect } from 'vitest'
import { APP_STORE_ID, PLAY_ID, storePage, storePages, storeReview } from './stores'

// ── 評価 — where a five is sent (plan 167) ────────────────────
describe('the store listings', () => {
  it('names Play by the bundle id, for the shell and the browser alike', () => {
    expect(PLAY_ID).toBe('app.tsuji')
    expect(storePage('android')).toBe('https://play.google.com/store/apps/details?id=app.tsuji')
    expect(storeReview('android')).toBe(storePage('android'))
  })

  it('sends nothing to an App Store listing it cannot name', () => {
    if (APP_STORE_ID) {
      expect(storeReview('ios')).toBe(`https://apps.apple.com/app/id${APP_STORE_ID}?action=write-review`)
    } else {
      expect(storePage('ios')).toBe(null)
      expect(storeReview('ios')).toBe(null)
    }
  })

  it('offers a browser only the listings that exist', () => {
    for (const { url } of storePages()) expect(url).toMatch(/^https:\/\//)
    expect(storePages().map(s => s.store)).toContain('android')
    expect(storeReview('web')).toBe(null)
  })
})
