import { describe, it, expect, vi } from 'vitest'
import { backAction, isNative, nudgeAt, openPath, openStore, PLAY_URL, TAB_ROOTS } from './platform'
import { STORES } from '../../landing/config.mjs'

// ── Where the app is running (plan 076) ───────────────────────
// The seams themselves are thin calls into plugins a browser does not
// have; what can be pinned here is the decisions: whether this is a
// shell, what Android's back button does, and what hour a nudge is.

describe('isNative', () => {
  it('is false with no bridge and true with one', () => {
    expect(isNative()).toBe(false)
    globalThis.window = { Capacitor: { isNativePlatform: () => true } }
    try {
      expect(isNative()).toBe(true)
    } finally {
      delete globalThis.window
    }
    expect(isNative()).toBe(false)
  })
})

describe('backAction', () => {
  it('closes an open sheet before anything else', () => {
    expect(backAction({ hasDialog: true, pathname: '/today' })).toBe('close')
    expect(backAction({ hasDialog: true, pathname: '/learn/kana' })).toBe('close')
  })
  it('leaves the app from a gate root, steps back elsewhere', () => {
    for (const root of TAB_ROOTS) expect(backAction({ hasDialog: false, pathname: root })).toBe('exit')
    expect(backAction({ hasDialog: false, pathname: '/learn/kana' })).toBe('back')
    expect(backAction({ hasDialog: false, pathname: '/profile/settings/data' })).toBe('back')
  })
  it('leaves when the history has nothing behind', () => {
    expect(backAction({ hasDialog: false, pathname: '/learn/kana', canGoBack: false })).toBe('exit')
  })
})

describe('nudgeAt', () => {
  it('reads a clock and refuses anything else', () => {
    expect(nudgeAt('07:30')).toEqual({ hour: 7, minute: 30 })
    expect(nudgeAt('21:00')).toEqual({ hour: 21, minute: 0 })
    expect(nudgeAt('24:00')).toBeNull()
    expect(nudgeAt('7:30')).toBeNull()
    expect(nudgeAt(null)).toBeNull()
    expect(nudgeAt('')).toBeNull()
  })
})

describe('openPath', () => {
  it('opens the gate and the run from the widget’s links and nothing else', () => {
    expect(openPath('app.tsuji://open/today')).toBe('/today')
    expect(openPath('app.tsuji://open/today/')).toBe('/today')
    expect(openPath('app.tsuji://open/run')).toBe('/today/run')
    expect(openPath('app.tsuji://open/run?lanes=x')).toBeNull()
    expect(openPath('app.tsuji://open/profile')).toBeNull()
    expect(openPath('app.tsuji://open/../settings')).toBeNull()
    expect(openPath('app.tsuji://auth-callback#access_token=x')).toBeNull()
    expect(openPath('https://example.com/open/today')).toBeNull()
    expect(openPath(null)).toBeNull()
  })
})

// Google Play (plan 307): the Android shell goes to the Play Store app
// through a market:// page the WebView hands to the OS; anywhere else,
// the app's page on the web, which the landing page links to as well.
describe('openStore', () => {
  it('is the landing page’s address', () => {
    expect(PLAY_URL).toBe(STORES.googlePlay)
  })
  it('hands the Android shell a market:// page', async () => {
    const location = { href: 'https://localhost/today' }
    globalThis.window = { Capacitor: { getPlatform: () => 'android' }, location, open: vi.fn() }
    try {
      await openStore()
      expect(location.href).toBe('market://details?id=app.tsuji')
      expect(window.open).not.toHaveBeenCalled()
    } finally {
      delete globalThis.window
    }
  })
  it('opens the web page in a new tab anywhere else', async () => {
    const location = { href: 'https://tsuji.app/app/today' }
    globalThis.window = { location, open: vi.fn() }
    try {
      await openStore()
      expect(window.open).toHaveBeenCalledWith(PLAY_URL, '_blank', 'noopener,noreferrer')
      expect(location.href).toBe('https://tsuji.app/app/today')
    } finally {
      delete globalThis.window
    }
  })
})
