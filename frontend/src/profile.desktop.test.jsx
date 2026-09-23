import { describe, it, expect, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { MemoryRouter } from 'react-router-dom'
import { LangProvider } from './LangContext'
import './index.css'

// ── 机 — the pass holder opened flat (plan 113) ─────────────────
// On the desk the profile's inserts are the phone's, in the phone's
// order, split after the stamp book into two columns: the pass and its
// stamps on the left, the record on the right. The backend is down here
// on purpose — the screen's own fallback (a believable pass, marked
// stale) is what renders, which is every insert but the ledger.

vi.mock('./lib/api', () => ({
  api: p => p,
  apiFetch: vi.fn(async () => ({ ok: false, status: 500, json: async () => ({}) })),
  apiJson: vi.fn(async () => { throw new Error('down') }),
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

describe('the profile on the desk', () => {
  it('opens the holder flat: the pass on the left, the record on the right', async () => {
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
    const cols = [...document.querySelectorAll('.desk-profile > .desk-profile__col')]
    expect(cols).toHaveLength(2)
    const [left, right] = cols.map(c => c.getBoundingClientRect())
    expect(Math.round(left.top)).toBe(Math.round(right.top))
    expect(right.left).toBeGreaterThan(left.right)
    // The pass and its stamps at the phone's own size (plan 115), the
    // record taking the rest.
    expect(Math.round(left.width)).toBe(360)
    expect(right.width).toBeGreaterThan(left.width)
    expect(cols[0].querySelector('[data-guide="profile.pass"]')).not.toBeNull()
    expect(cols[0].querySelector('[data-guide="profile.stamps"]')).not.toBeNull()
    expect(cols[1].querySelector('[data-guide="profile.records"]')).not.toBeNull()
    // The stale note is the screen's, over both columns.
    expect(document.querySelector('.profile > .profile__stale')).not.toBeNull()
  })

  it('keeps the phone\'s reading order', async () => {
    await render(
      <LangProvider>
        <MemoryRouter initialEntries={['/profile']}>
          <ProfileScreen session={{ access_token: 'tok' }} />
        </MemoryRouter>
      </LangProvider>
    )
    await settle()
    const order = [...document.querySelectorAll('[data-guide^="profile."]')].map(el => el.dataset.guide)
    const expected = ['profile.pass', 'profile.stamps', 'profile.records']
    expect(order.filter(g => expected.includes(g))).toEqual(expected)
  })
})
