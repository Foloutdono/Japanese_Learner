import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from 'vitest-browser-react'

// ── 改札の戻り — the page the shell's Google round trip lands on ──
// It never boots the app: it forwards the callback to the deep link,
// and offers the same link as a button for a browser that will not
// follow a custom scheme by itself.

const replace = vi.fn()

vi.mock('../lib/platform', () => ({ hideSplash: vi.fn(), isNative: () => false }))

// LangContext pulls the content-translation maps over the network on
// mount — the same stub App's tests use.
globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })

const { default: NativeReturn } = await import('./NativeReturn')

const settle = (ms = 60) => new Promise(r => setTimeout(r, ms))

beforeEach(() => {
  replace.mockReset()
  window.history.replaceState(null, '', '/auth/native#access_token=at1&refresh_token=rt1&token_type=bearer')
})

describe('NativeReturn', () => {
  it('offers the callback on the deep link, fragment intact', async () => {
    const screen = await render(<NativeReturn />)
    await settle()
    const a = screen.container.querySelector('[data-action="native-return"]')
    expect(a).not.toBeNull()
    expect(a.getAttribute('href')).toBe('app.tsuji://auth-callback#access_token=at1&refresh_token=rt1&token_type=bearer')
  })

  it('leaves the tokens on the URL for the link to carry — nothing here consumes them', async () => {
    await render(<NativeReturn />)
    await settle()
    expect(window.location.hash).toContain('access_token=at1')
  })
})
