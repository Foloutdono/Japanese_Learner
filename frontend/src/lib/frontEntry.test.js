import { describe, it, expect, vi } from 'vitest'
import { takeEntry, BOARD_PARAM } from './frontEntry'

// A window with only what takeEntry reads.
function fakeWindow(href, referrer = '') {
  return {
    location: { href },
    history: { state: { kept: true }, replaceState: vi.fn() },
    document: { referrer },
  }
}

describe('takeEntry', () => {
  it('reads Board pressed on the landing page, and takes it off the address', () => {
    const win = fakeWindow(`https://tsuji.app/app?${BOARD_PARAM}`, 'https://tsuji.app/')
    expect(takeEntry(win)).toEqual({ entry: 'board', back: '/' })
    expect(win.history.replaceState).toHaveBeenCalledWith({ kept: true }, '', '/app')
  })

  it('goes back to the page in the language it was read in', () => {
    const win = fakeWindow(`https://tsuji.app/app?${BOARD_PARAM}`, 'https://tsuji.app/en')
    expect(takeEntry(win).back).toBe('/en')
  })

  it('goes back to `/` from anywhere that is not the landing page', () => {
    for (const referrer of ['', 'https://example.com/', 'https://tsuji.app/today', 'not a url']) {
      expect(takeEntry(fakeWindow(`https://tsuji.app/app?${BOARD_PARAM}`, referrer)).back).toBe('/')
    }
  })

  it('keeps whatever else the address carries', () => {
    const win = fakeWindow(`https://tsuji.app/app?${BOARD_PARAM}&code=abc#frag`)
    takeEntry(win)
    expect(win.history.replaceState).toHaveBeenCalledWith({ kept: true }, '', '/app?code=abc#frag')
  })

  it('leaves a bare /app, and any other address, alone', () => {
    for (const href of ['https://tsuji.app/app', 'https://tsuji.app/app?code=abc', 'https://tsuji.app/today?boarding=1']) {
      const win = fakeWindow(href)
      expect(takeEntry(win)).toEqual({ entry: null, back: '/' })
      expect(win.history.replaceState).not.toHaveBeenCalled()
    }
  })

  it('reads nothing where there is no window', () => {
    expect(takeEntry(null)).toEqual({ entry: null, back: '/' })
  })
})
