import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

// ── 拡大 — what a pinch zooms, and what it leaves alone ──
// No screen of the app, on any platform. The store apps' WebViews have
// no pinch while Capacitor's zoomEnabled is off (the Android shell builds
// its WebView without zoom controls, the iOS one turns the pinch
// recogniser off), and the web's screens are index.html, which the web
// build writes as app.html and the native bundle keeps. Before its
// viewport fixed the scale, an Android browser let a learner pinch the
// whole app, the HUD and the tab bar off the screen. The pages that are
// documents, read rather than used, keep the browser's pinch.
const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

/** A page's viewport tag, as its keys: { 'user-scalable': 'no', … }. */
function viewport(page) {
  const tag = read(page).match(/<meta\s+name="viewport"\s+content="([^"]*)"/)
  expect(tag, `${page} has a viewport tag`).toBeTruthy()
  return Object.fromEntries(tag[1].split(',').map(part => part.split('=').map(s => s.trim())))
}

describe('a pinch', () => {
  it('zooms no screen of the web app: its document fixes the scale', () => {
    const v = viewport('index.html')
    expect(v['user-scalable']).toBe('no')
    expect(Number(v['maximum-scale'])).toBe(1)
    expect(Number(v['initial-scale'])).toBe(1)
    // What the tag said before still holds.
    expect(v.width).toBe('device-width')
    expect(v['viewport-fit']).toBe('cover')
  })

  it('zooms no screen of the store apps: neither shell turns Capacitor\'s zoom on', () => {
    // Android reads android.zoomEnabled, then zoomEnabled; iOS reads
    // ios.zoomEnabled, then zoomEnabled. Off unless one of them says so.
    const config = JSON.parse(read('capacitor.config.json'))
    for (const scope of [config, config.android ?? {}, config.ios ?? {}]) {
      expect(scope.zoomEnabled ?? false).toBe(false)
    }
  })

  it('still zooms the pages that are documents', () => {
    for (const page of ['landing/page.mjs', 'public/privacy.html', 'public/delete-account.html']) {
      const v = viewport(page)
      expect(v['user-scalable'], page).toBeUndefined()
      expect(v['maximum-scale'], page).toBeUndefined()
    }
  })
})
