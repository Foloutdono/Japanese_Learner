import { describe, it, expect, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { MemoryRouter } from 'react-router-dom'
import { LangProvider } from './LangContext'
import './index.css'

// ── 定期入れ, tightened (plan 140) ──────────────────────────────
// The owner's pick A of the profile canvas: the same inserts, a third
// of the phone's height gone. The real screen at 390px, the backend
// down on purpose so the screen's own fallback (a believable pass,
// marked stale) is what renders -- every insert but the ledger, which
// profile.phone.test.jsx and LineLedger.browser.test.jsx hold.

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
const openBalance = vi.fn()
vi.mock('./stores/credits', async (o) => ({
  ...(await o()),
  useCredits: () => ({ balance: 34, cap: 50, dailyRefill: 10, refillAt: null }),
  openBalance: (...a) => openBalance(...a),
}))
vi.mock('./hooks/useGuide', () => ({ useGuide: () => ({ open: false, onEnd() {} }) }))
vi.mock('./lib/audio', async o => ({ ...(await o()), playUi: vi.fn(), playClick: vi.fn() }))
globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })

const { default: ProfileScreen } = await import('./screens/ProfileScreen')

const settle = (ms = 500) => new Promise(r => setTimeout(r, ms))

async function mount() {
  document.body.innerHTML = ''
  await render(
    <LangProvider>
      <MemoryRouter initialEntries={['/profile']}>
        <ProfileScreen session={{ access_token: 'tok' }} />
      </MemoryRouter>
    </LangProvider>
  )
  await settle()
}

const $ = sel => document.querySelector(sel)
const $$ = sel => [...document.querySelectorAll(sel)]

describe('the profile at phone width (plan 140)', () => {
  it('prints the XP once: an initial with no ring, the bar on the balance row', async () => {
    await mount()
    expect($('.pass__avatar')).not.toBeNull()
    expect($('.pass__ring')).toBeNull()
    expect($$('.pass__track')).toHaveLength(1)
  })

  it('prints the month the pass was issued under the name', async () => {
    await mount()
    const since = $('.pass__since')
    expect(since).not.toBeNull()
    // The lane is a French device; the fallback boarded six months ago.
    expect(since.textContent).toMatch(/^Depuis \S+ \d{4}$/)
    const name = $('.pass__holder .profile-card__name').getBoundingClientRect()
    expect(since.getBoundingClientRect().top).toBeGreaterThan(name.bottom - 1)
  })

  it('makes the balance line the door to the balance sheet, and stands no offer of its own', async () => {
    await mount()
    expect($('main .pw-open')).toBeNull()
    expect($('[data-source="profile"]')).toBeNull()
    const door = $('.pass__footer > .pass__door')
    expect(door.tagName).toBe('BUTTON')
    expect(door.querySelector('.balance-line')).not.toBeNull()
    expect(door.getBoundingClientRect().height).toBeGreaterThanOrEqual(44)
    door.click()
    expect(openBalance).toHaveBeenCalledTimes(1)
  })

  it('titles the stamp book with its month and prints the year in its margin', async () => {
    await mount()
    const title = $('.sbook__title').textContent
    expect(title[0]).toBe(title[0].toLocaleUpperCase('fr'))
    expect(title).toBe(title.charAt(0) + new Intl.DateTimeFormat('fr', { month: 'long' }).format(new Date()).slice(1))
    expect($('.sbook__month .fig__l').textContent).toBe(String(new Date().getFullYear()))
  })

  it('lays the inserts out in the canvas order: the pass, the stamps, the records, the doors, five on the board', async () => {
    await mount()
    const order = ['.pass', '.sbook', '.records--three', '.record--door', '.banzuke']
      .map(sel => $(sel).getBoundingClientRect().top)
    expect([...order].sort((a, b) => a - b)).toEqual(order)
    const figures = $$('.records--three > .record')
    expect(figures).toHaveLength(3)
    expect(figures.map(f => f.querySelector('.record__value').textContent)).toEqual(['842', '91%', '12'])
    expect($$('.record--door').map(d => d.tagName)).toEqual(['BUTTON', 'BUTTON'])
    expect($$('.banzuke .leaderboard-row')).toHaveLength(5)
  })
})
