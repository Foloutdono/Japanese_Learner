// ── The language choice is the account's, and nothing else moves it ──
//
// An English learner was switched back to French "constantly": the
// choice lived in localStorage alone, and a browser forgets. What must
// hold: a choice reaches the account; the account's answer reaches a
// device that forgot; a choice only this device holds goes up instead
// of being overwritten; and a write that failed is not lost.
import { describe, it, expect, vi, beforeEach } from 'vitest'

const apiJson = vi.fn(() => Promise.resolve({}))
vi.mock('./api', () => ({ apiJson }))

const store = new Map()
globalThis.window = {
  localStorage: {
    getItem: k => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: k => store.delete(k),
  },
}

const { savedLang, rememberLang, syncLang, subscribeLang } = await import('./langChoice')
const session = { access_token: 't' }

beforeEach(() => {
  store.clear()
  apiJson.mockReset()
  apiJson.mockImplementation(() => Promise.resolve({}))
})

describe('a choice', () => {
  it('is kept on the device and written to the account', async () => {
    rememberLang('en', session)
    expect(savedLang()).toBe('en')
    await vi.waitFor(() => expect(apiJson).toHaveBeenCalledWith('/api/profile/learning', session, expect.objectContaining({
      method: 'PATCH', body: JSON.stringify({ uiLang: 'en' }),
    })))
  })

  it('is kept on the device alone without a session', async () => {
    rememberLang('en', null)
    await Promise.resolve()
    expect(savedLang()).toBe('en')
    expect(apiJson).not.toHaveBeenCalled()
  })

  it('ignores a language the app does not speak', () => {
    rememberLang('de', session)
    expect(savedLang()).toBeNull()
  })
})

describe('the boot', () => {
  it('gives a device that forgot the account\'s choice back', () => {
    const heard = vi.fn()
    subscribeLang(heard)
    syncLang('en', session)
    expect(savedLang()).toBe('en')
    expect(heard).toHaveBeenCalled()
    expect(apiJson).not.toHaveBeenCalled()
  })

  it('takes the account\'s choice over an older one on the device', () => {
    store.set('lang', 'fr')
    syncLang('en', session)
    expect(savedLang()).toBe('en')
  })

  it('carries a choice only the device holds up to an account never asked', async () => {
    store.set('lang', 'en')
    syncLang(null, session)
    expect(savedLang()).toBe('en')
    await vi.waitFor(() => expect(apiJson).toHaveBeenCalledWith('/api/profile/learning', session, expect.objectContaining({
      body: JSON.stringify({ uiLang: 'en' }),
    })))
  })

  it('changes nothing for a learner who never chose', () => {
    syncLang(null, session)
    expect(savedLang()).toBeNull()
    expect(apiJson).not.toHaveBeenCalled()
  })

  it('does not write what the account already has', () => {
    store.set('lang', 'en')
    syncLang('en', session)
    expect(apiJson).not.toHaveBeenCalled()
  })

  it('ignores a profile that says nothing or something odd', () => {
    store.set('lang', 'en')
    syncLang(undefined, session)
    syncLang('de', session)
    expect(savedLang()).toBe('en')
    expect(apiJson).not.toHaveBeenCalled()
  })
})

describe('a write that did not reach the account', () => {
  it('wins over the account\'s older answer at the next boot', async () => {
    apiJson.mockImplementation(() => Promise.reject(new Error('offline')))
    rememberLang('en', session)
    await vi.waitFor(() => expect(apiJson).toHaveBeenCalledTimes(1))
    await Promise.resolve()

    apiJson.mockImplementation(() => Promise.resolve({}))
    syncLang('fr', session)          // the account still says the old one
    expect(savedLang()).toBe('en')
    await vi.waitFor(() => expect(apiJson).toHaveBeenCalledTimes(2))
    expect(apiJson.mock.calls[1][2].body).toBe(JSON.stringify({ uiLang: 'en' }))
  })

  it('stops being pending once the account has it', async () => {
    rememberLang('en', session)
    await vi.waitFor(() => expect(apiJson).toHaveBeenCalledTimes(1))
    await Promise.resolve(); await Promise.resolve()
    syncLang('fr', session)          // another device moved it since
    expect(savedLang()).toBe('fr')
  })
})
