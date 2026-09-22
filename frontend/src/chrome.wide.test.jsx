import { describe, it, expect, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { LangProvider } from './LangContext'
import { DESK_QUERY } from './hooks/useDesk'
import './index.css'

// ── 机 — the desk at a laptop's width (plan 112) ────────────────
// The `wide` lane: 1440×900 from the first paint. Where the desk lane
// (chrome.desktop.test.jsx) pins the tightest desk, this one is the
// ordinary one — the screen column stops at --board-w and centres in
// what the rail leaves.

vi.mock('./lib/api', () => ({
  api: p => p,
  apiFetch: vi.fn(async () => ({ ok: false, status: 500, json: async () => ({}) })),
  apiJson: vi.fn(async () => ({})),
  apiJsonWithTimeout: vi.fn(),
  apiUpload: vi.fn(),
  ApiError: class ApiError extends Error {},
}))
vi.mock('./lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: async () => ({ data: { session: { access_token: 'tok' } } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    },
  },
}))
globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })

const { Shell } = await import('./components/chrome/Shell')
const settle = (ms = 60) => new Promise(r => setTimeout(r, ms))

describe('the wide lane', () => {
  it('is a laptop, and the desk answers it', () => {
    expect(window.innerWidth).toBe(1440)
    expect(window.matchMedia(DESK_QUERY).matches).toBe(true)
  })
})

describe('the screen column on a laptop', () => {
  // The desk's canvas is --desk-board-w (1240, plan 113), where the
  // phone's column stopped at --board-w (1040): at 1440 the rail leaves
  // less than that, so the screen takes all of it.
  it('takes what the rail leaves, up to --desk-board-w', async () => {
    await render(
      <LangProvider>
        <MemoryRouter initialEntries={['/learn']}>
          <Routes>
            <Route element={<Shell />}>
              <Route path="/learn" element={<main id="main-content" className="learn">here</main>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </LangProvider>
    )
    await settle(420)
    const rail = document.querySelector('.desk-rail').getBoundingClientRect()
    const content = document.querySelector('.phone__content').getBoundingClientRect()
    expect(getComputedStyle(document.querySelector('.phone__content')).maxWidth).toBe('1240px')
    const left = content.left - rail.right
    // The frame's own edge, which stops short of the window by the
    // page's stable scrollbar gutter (index.css, `html {
    // scrollbar-gutter: stable }`): the room the rail leaves is the
    // frame's, not the window's.
    const right = document.querySelector('.phone').getBoundingClientRect().right - content.right
    expect(Math.abs(left - right)).toBeLessThanOrEqual(1)
    // Under the cap, so no margin at all: rail to frame edge.
    expect(content.width).toBeGreaterThan(1040)
    expect(left).toBeLessThanOrEqual(1)
  })
})
