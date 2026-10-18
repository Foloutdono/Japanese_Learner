import { describe, it, expect, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { MemoryRouter } from 'react-router-dom'
import { LangProvider } from './LangContext'
import { liveLearner } from './testing/profileRecord'
import './index.css'

// ── 低 — the holder on a laptop's short window (plans 169, 248) ──
// At 1280×600 the holder is taller than the window: the room round its
// inserts gives way a rung (the gaps, the doors', the figures', the
// lines' and the board's rows), the card and the stamps keep their
// size, and the page scrolls the rest. Nothing is crushed or cut, and
// the two columns still end together.

const api = vi.hoisted(() => ({ live: null }))
vi.mock('./lib/api', () => ({
  api: p => p,
  apiFetch: vi.fn(async path => {
    const body = api.live?.fetch(path)
    return body ? { ok: true, status: 200, json: async () => body } : { ok: false, status: 500, json: async () => ({}) }
  }),
  apiJson: vi.fn(async path => {
    const body = api.live?.json(path)
    if (body) return body
    throw new Error('down')
  }),
  apiJsonWithTimeout: vi.fn(async () => ({})),
  apiUpload: vi.fn(),
  ApiError: class extends Error {},
}))
vi.mock('./lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: async () => ({ data: { session: { access_token: 'tok' } } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    },
  },
}))
vi.mock('./lib/audio', async o => ({ ...(await o()), playUi: vi.fn(), playClick: vi.fn() }))
globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })

const { default: ProfileScreen } = await import('./screens/ProfileScreen')

const settle = (ms = 500) => new Promise(r => setTimeout(r, ms))
const $ = sel => document.querySelector(sel)
const $$ = sel => [...document.querySelectorAll(sel)]

describe('the profile on the short desk (plan 248)', () => {
  it('keeps every insert whole, the card and the stamps at their size, the columns ending together', async () => {
    api.live = liveLearner()
    await render(
      <LangProvider>
        <MemoryRouter initialEntries={['/profile']}>
          <div className="phone phone--desk">
            <div className="phone__content"><ProfileScreen session={{ access_token: 'tok' }} /></div>
          </div>
        </MemoryRouter>
      </LangProvider>
    )
    await settle()
    expect(window.innerHeight).toBe(600)
    // The room gives way a rung.
    expect(getComputedStyle($('.desk-profile__col')).rowGap).toBe('12px')
    expect(getComputedStyle($('.desk-bz__cell')).paddingTop).toBe('4px')
    // The objects keep their size: the card at the side column's width,
    // the stamps as round as on a tall desk.
    expect(Math.round($('.pcard-slot--profile').getBoundingClientRect().width)).toBe(360)
    const stamp = $('.sbook__stamp').getBoundingClientRect()
    expect(stamp.width).toBeGreaterThan(36)
    expect(stamp.height).toBeCloseTo(stamp.width, 0)
    // Nothing is cut: every insert holds its content.
    for (const sel of ['.desk-doors', '.sbook', '.records--three', '.pf-ledger', '.desk-bz']) {
      const el = $(sel)
      expect(el.scrollHeight, sel).toBeLessThanOrEqual(el.clientHeight + 1)
    }
    expect($$('.desk-bz__row').every(r => r.getBoundingClientRect().height >= r.querySelector('.leaderboard-row__rank').getBoundingClientRect().height)).toBe(true)
    // And the two columns still end together.
    const [left, right] = $$('.desk-profile > .desk-profile__col').map(c => c.getBoundingClientRect())
    expect(left.bottom).toBeCloseTo(right.bottom, 0)
  })
})
