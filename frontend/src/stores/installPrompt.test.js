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

describe('a handed-over prompt', () => {
  // The listeners are attached at import when there is a window, so the
  // module is loaded fresh with one stubbed in.
  async function withPrompt(outcome) {
    vi.resetModules()
    const target = new EventTarget()
    vi.stubGlobal('window', target)
    const store = await import('./installPrompt')
    const event = new Event('beforeinstallprompt', { cancelable: true })
    event.prompt = vi.fn(() => Promise.resolve())
    event.userChoice = Promise.resolve({ outcome })
    target.dispatchEvent(event)
    return { store, event }
  }

  it('is spent once prompted, even when the learner dismisses it', async () => {
    const { store, event } = await withPrompt('dismissed')
    expect(await store.promptInstall()).toBe('dismissed')
    // A second press used to call prompt() on the spent event again,
    // which the browser rejects: a button that did nothing.
    expect(await store.promptInstall()).toBeNull()
    expect(event.prompt).toHaveBeenCalledTimes(1)
  })

  it('is spent once accepted', async () => {
    const { store, event } = await withPrompt('accepted')
    expect(await store.promptInstall()).toBe('accepted')
    expect(await store.promptInstall()).toBeNull()
    expect(event.prompt).toHaveBeenCalledTimes(1)
  })
})
