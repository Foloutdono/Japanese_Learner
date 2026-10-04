import { describe, it, expect, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { MemoryRouter } from 'react-router-dom'
import { LangProvider } from './LangContext'
import './index.css'

// ── 定期入れ, tightened (plan 143) ──────────────────────────────
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

describe('the profile at phone width (plan 143)', () => {
  // Plan 172 replaced the pass with the learner's card: face up here,
  // its back a touch away, and the old pass's figures on that back.
  const turn = async () => { $('.pcard__turn').click(); await settle(100) }

  it('prints the learner\'s card face up, the climb in its engraving', async () => {
    await mount()
    const card = $('.pcard-slot--profile .pcard')
    expect(card.dataset.side).toBe('face')
    expect($('.pass__avatar')).toBeNull()
    expect(Number($('.pcf__seal').style.getPropertyValue('--ofr-xp'))).toBeGreaterThan(0)
    // The card at the column's width, at the card's proportions.
    const box = card.getBoundingClientRect()
    expect(box.height).toBeCloseTo(box.width * 172 / 272, 0)
  })

  it('prints the month the card was issued on its back', async () => {
    await mount()
    await turn()
    // The lane is a French device; the fallback boarded six months ago.
    expect($('.pcb__month').textContent).toMatch(/^Émise en \S+ \d{4}$/)
  })

  it('makes the balance meter the door to the balance sheet, and stands no offer of its own', async () => {
    await mount()
    expect($('main .pw-open')).toBeNull()
    expect($('[data-source="profile"]')).toBeNull()
    await turn()
    const door = $('.pcb__meter--balance')
    expect(door.tagName).toBe('BUTTON')
    expect(door.textContent).toContain('34')
    door.click()
    expect(openBalance).toHaveBeenCalledTimes(1)
    // A touch on a door never turns the card back.
    expect($('.pcard').dataset.side).toBe('back')
  })

  it('titles the stamp book with its month and prints the year in its margin', async () => {
    await mount()
    const title = $('.sbook__title').textContent
    expect(title[0]).toBe(title[0].toLocaleUpperCase('fr'))
    expect(title).toBe(title.charAt(0) + new Intl.DateTimeFormat('fr', { month: 'long' }).format(new Date()).slice(1))
    expect($('.sbook__month .fig__l').textContent).toBe(String(new Date().getFullYear()))
  })

  it('lays the inserts out in order: the card, the doors, the stamps, the records, five on the board', async () => {
    await mount()
    // The doors stand straight under the card (the owner's call after
    // the first round of plan 143), above the stamp book.
    const order = ['.pcard-slot--profile', '.record--door', '.sbook', '.records--three', '.banzuke']
      .map(sel => $(sel).getBoundingClientRect().top)
    expect([...order].sort((a, b) => a - b)).toEqual(order)
    const figures = $$('.records--three > .record')
    expect(figures).toHaveLength(3)
    expect(figures.map(f => f.querySelector('.record__value').textContent)).toEqual(['842', '91%', '12'])
    expect($$('.record--door').map(d => d.tagName)).toEqual(['BUTTON', 'BUTTON'])
    expect($$('.banzuke .leaderboard-row')).toHaveLength(5)
  })
})
