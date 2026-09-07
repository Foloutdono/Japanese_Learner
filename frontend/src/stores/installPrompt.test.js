import { describe, it, expect, vi, afterEach } from 'vitest'
import { isIosSafari, promptInstall } from './installPrompt'

afterEach(() => vi.unstubAllGlobals())

function ua(userAgent, maxTouchPoints = 0) {
  vi.stubGlobal('navigator', { userAgent, maxTouchPoints })
}

describe('isIosSafari', () => {
  it('is true for Safari on iPhone and on an iPad that calls itself a Mac', () => {
    ua('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1')
    expect(isIosSafari()).toBe(true)
    ua('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15', 5)
    expect(isIosSafari()).toBe(true)
  })

  it('is false for Chrome on iPhone (no share-sheet install there) and for Android', () => {
    ua('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/118.0 Mobile/15E148 Safari/604.1')
    expect(isIosSafari()).toBe(false)
    ua('Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0 Mobile Safari/537.36')
    expect(isIosSafari()).toBe(false)
  })
})

describe('promptInstall', () => {
  it('is a no-op when no prompt was handed over', async () => {
    expect(await promptInstall()).toBeNull()
  })
})
