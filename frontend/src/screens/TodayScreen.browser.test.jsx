import { describe, it, expect, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { MemoryRouter } from 'react-router-dom'
import { LangProvider } from '../LangContext'
// Same stylesheet-import trick as PromptCard.browser.test.jsx (plan 048):
// the rule this test pins only exists once the real sheet is loaded.
import '../index.css'

// Plan 051 — the screen's primary action, `.btn-primary`, had no rule
// anywhere in the stylesheet: the app's filled-action class was
// `.btn-primary-purple`, renamed to `.btn-deck-primary` in e9690b7, and
// TodayScreen reached for a name that had already gone. Nothing caught
// it, because nothing checks that a referenced class exists — so the
// "Start N cards" button (and its two siblings on the cleared-queue
// screens) fell through to the bare `button` rule and painted as the
// browser's own default control, in the platform's own face, on a
// screen that otherwise speaks entirely in --font-display.
//
// Written to fail against today's behaviour first, per plan convention
// (see PromptCard.browser.test.jsx / CardPrompt.browser.test.jsx, which
// do the same).

const apiJson = vi.fn()

vi.mock('../lib/api', () => ({
  api: p => p,
  apiFetch: vi.fn(),
  apiJson: (...a) => apiJson(...a),
  apiJsonWithTimeout: vi.fn(),
  apiUpload: vi.fn(),
  ApiError: class ApiError extends Error {},
}))

// LangContext fetches /api/translations/{kanji,vocab} on mount -- same
// offline stub as KanaScreen.pace.browser.test.jsx / RatingBar.browser.test.jsx.
globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })

const { default: TodayScreen } = await import('./TodayScreen')

const settle = (ms = 50) => new Promise(r => setTimeout(r, ms))

describe('TodayScreen — the primary button (plan 051)', () => {
  it('renders .btn-primary as a real filled button, not the bare-button default', async () => {
    // The emptiest shape that reaches a `.btn-primary`: no lanes due at
    // all renders the "back to station" button on the cleared screen
    // (TodayScreen.jsx:426) without needing any lane/card fixtures.
    apiJson.mockImplementation(async url => {
      if (url === '/api/today') return { lanes: [], total: 0, next_due: null }
      return {}
    })

    const screen = await render(
      <LangProvider>
        <MemoryRouter>
          <TodayScreen session={{ access_token: 'tok' }} />
        </MemoryRouter>
      </LangProvider>
    )
    await settle(200)

    const btn = screen.container.querySelector('.btn-primary')
    expect(btn, `no .btn-primary in DOM — page: ${screen.container.textContent.slice(0, 300)}`).toBeTruthy()

    const style = getComputedStyle(btn)
    // Not the bare `button` rule's fallthrough (no background set at
    // all -> transparent) and not a leftover default.
    expect(style.backgroundColor).not.toBe('rgba(0, 0, 0, 0)')
    expect(style.backgroundColor).not.toBe('transparent')
    // The app's own display face, not the page's inherited Segoe UI.
    expect(style.fontFamily).toContain('Space Grotesk')
  })
})
