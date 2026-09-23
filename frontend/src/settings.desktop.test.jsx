import { describe, it, expect, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom'
import { LangProvider } from './LangContext'
import './index.css'

// ── 机 — the settings list beside the open page (plan 113) ──────
// On the desk the list and a page share the screen under the list's
// one heading: the page is a pane (an <h2>, no ‹ Settings — the list is
// right there), its row is marked, and the URLs are the phone's. The
// bare list opens on its first page rather than beside an empty pane.

vi.mock('./lib/api', () => ({
  api: p => p,
  apiFetch: vi.fn(async () => ({ ok: true, status: 200, json: async () => ({}) })),
  apiJson: vi.fn(async () => ({})),
  apiJsonWithTimeout: vi.fn(async () => ({})),
  apiUpload: vi.fn(),
  ApiError: class extends Error {},
}))
vi.mock('./lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: async () => ({ data: { session: { access_token: 'tok' } } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
      signOut: vi.fn(),
    },
  },
}))
vi.mock('./lib/audio', async o => ({
  ...(await o()), playUi: vi.fn(), playClick: vi.fn(), playToggle: vi.fn(),
}))
// iOS Safari, for the one test that needs its install row (plan 120):
// off by default, as headless Chromium is, so the page is as it was.
const install = vi.hoisted(() => ({ ios: false }))
vi.mock('./stores/installPrompt', async o => ({ ...(await o()), isIosSafari: () => install.ios }))
globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })

const { default: SettingsScreen } = await import('./screens/SettingsScreen')

const settle = (ms = 300) => new Promise(r => setTimeout(r, ms))
const SESSION = { access_token: 'tok', user: { email: 'dev@example.com' } }

const here = { path: null }
function Probe() {
  here.path = useLocation().pathname
  return null
}

function mount(path) {
  return render(
    <LangProvider>
      <MemoryRouter initialEntries={[path]}>
        <div className="phone phone--desk">
          <div className="phone__content">
            <Routes>
              <Route path="/profile/settings" element={<SettingsScreen session={SESSION} />} />
              <Route path="/profile/settings/:page" element={<SettingsScreen session={SESSION} />} />
            </Routes>
          </div>
        </div>
        <Probe />
      </MemoryRouter>
    </LangProvider>
  )
}

describe('settings on the desk', () => {
  it('opens the bare list on its first page', async () => {
    await mount('/profile/settings')
    await settle()
    expect(here.path).toBe('/profile/settings/display')
    expect(document.querySelector('.desk-settings__page')).not.toBeNull()
  })

  it('sets the list and the page side by side, under one heading', async () => {
    await mount('/profile/settings/sound')
    await settle()
    expect(document.querySelectorAll('main')).toHaveLength(1)
    expect(document.querySelectorAll('h1')).toHaveLength(1)
    const list = document.querySelector('.desk-settings__list')
    const page = document.querySelector('.desk-settings__page')
    expect(list.querySelector('h1')).not.toBeNull()
    expect(page.querySelector('h2')).not.toBeNull()
    const l = list.getBoundingClientRect()
    const p = page.getBoundingClientRect()
    expect(Math.round(l.top)).toBe(Math.round(p.top))
    expect(p.left).toBeGreaterThan(l.right)
  })

  it('marks the open page\'s row, and prints no way back to the list beside it', async () => {
    await mount('/profile/settings/sound')
    await settle()
    const on = [...document.querySelectorAll('.stg-row[aria-current="page"]')]
    expect(on.map(r => r.dataset.page)).toEqual(['sound'])
    expect(on[0].classList.contains('stg-row--on')).toBe(true)
    expect(document.querySelector('.desk-settings__page .stage__leave')).toBeNull()
  })

  it('walks the rows to their pages, keeping the list', async () => {
    await mount('/profile/settings/display')
    await settle()
    document.querySelector('.stg-row[data-page="sound"]').click()
    await settle()
    expect(here.path).toBe('/profile/settings/sound')
    expect(document.querySelector('.desk-settings__list')).not.toBeNull()
    expect(document.querySelector('.stg-row[aria-current="page"]').dataset.page).toBe('sound')
  })

  it('prints one Sign out beside the account page, not two (plan 115)', async () => {
    await mount('/profile/settings/account')
    await settle()
    const outs = [...document.querySelectorAll('button')].filter(b => /^(déconnexion|sign out)$/i.test(b.textContent.trim()))
    expect(outs).toHaveLength(1)
    expect(document.querySelector('.desk-settings__list .stg-signout')).toBeNull()

    document.querySelector('.stg-row[data-page="sound"]').click()
    await settle()
    expect(document.querySelector('.desk-settings__list .stg-signout')).not.toBeNull()
  })
})

// ── plan 120 — the install steps in the page ──
// iOS Safari installs from its share sheet alone, so the Display page's
// install row explains the two taps. An iPad on its side reaches the
// desk, and there the explanation opens in the page under the row
// rather than in a sheet over it. The phone's side is deskfree.phone.
describe('the install row on the desk', () => {
  it('opens the two taps in the page, and folds them again', async () => {
    install.ios = true
    try {
      await mount('/profile/settings/display')
      await settle()
      const page = document.querySelector('.desk-settings__page')
      const button = [...page.querySelectorAll('.slip__act')].pop()
      expect(button.getAttribute('aria-expanded')).toBe('false')
      button.click()
      await settle()
      expect(document.querySelector('[role="dialog"]')).toBeNull()
      expect(button.getAttribute('aria-expanded')).toBe('true')
      const steps = page.querySelector('.desk-install')
      expect(steps.id).toBe(button.getAttribute('aria-controls'))
      expect(steps.querySelectorAll('.install-sheet__steps li')).toHaveLength(2)
      button.click()
      await settle()
      expect(page.querySelector('.desk-install')).toBeNull()
      expect(button.getAttribute('aria-expanded')).toBe('false')
    } finally {
      install.ios = false
    }
  })
})
