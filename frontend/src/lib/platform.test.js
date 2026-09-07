import { describe, it, expect } from 'vitest'
import { backAction, isNative, nudgeAt, TAB_ROOTS } from './platform'

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
