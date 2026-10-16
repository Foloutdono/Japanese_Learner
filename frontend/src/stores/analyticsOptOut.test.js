// ── 足跡を残さない — the switch is the account's (plan 218) ──────────
//
// The local flag stopped one browser; the account's answer stops them
// all, and the server too. What must hold: a switch flipped in Settings
// is written to the account; the account's answer lands on the device at
// boot; and a device that said no before the account could hold it
// carries its no up rather than being turned back on.
import { describe, it, expect, vi, beforeEach } from 'vitest'

const apiJson = vi.fn(() => Promise.resolve({}))
vi.mock('../lib/api', () => ({ apiJson }))

const store = new Map()
globalThis.window = {
  localStorage: {
    getItem: k => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: k => store.delete(k),
  },
}

const { isOptedOut, setOptedOut, syncOptOut } = await import('./analyticsOptOut')
const session = { access_token: 't' }

beforeEach(() => {
  store.clear()
  apiJson.mockClear()
  setOptedOut(false)
})

describe('the switch', () => {
  it('writes the account when Settings flips it', async () => {
    setOptedOut(true, session)
    expect(isOptedOut()).toBe(true)
    await vi.waitFor(() => expect(apiJson).toHaveBeenCalledWith('/api/profile/learning', session, expect.objectContaining({
      method: 'PATCH', body: JSON.stringify({ analyticsOff: true }),
    })))
  })

  it("takes the account's answer at boot", () => {
    store.set('jp-trail-synced', '1')
    syncOptOut(true, session)
    expect(isOptedOut()).toBe(true)
    expect(apiJson).not.toHaveBeenCalled()
    syncOptOut(false, session)
    expect(isOptedOut()).toBe(false)
  })

  it("carries an older device's no up to the account, once", async () => {
    setOptedOut(true)            // the pre-218 local switch, no session
    syncOptOut(false, session)
    expect(isOptedOut()).toBe(true)
    await vi.waitFor(() => expect(apiJson).toHaveBeenCalledTimes(1))
  })

  it('does nothing without an answer from the account', () => {
    syncOptOut(undefined, session)
    expect(isOptedOut()).toBe(false)
    expect(apiJson).not.toHaveBeenCalled()
  })
})
