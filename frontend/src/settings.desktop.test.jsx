import { describe, it, expect, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { page } from 'vitest/browser'
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom'
import { LangProvider } from './LangContext'
import { contentBox } from './testing/contentBox'
import './index.css'

// ── 机 — the settings column beside the open page (plan 113) ────
// On the desk the column (the pass printed with its contract, over the
// list) and a page share the screen under the column's one heading: the
// page is a pane (an <h2>, no ‹ Settings — the column is right there),
// its door is marked, and the URLs are the phone's. The bare column
// opens on its first page rather than beside an empty pane. Neither
// prints a title (plan 139): the rail's station and the lit door name
// them, and both headings are clipped for a screen reader.

vi.mock('./lib/api', () => ({
  api: p => p,
  // A learner at N4, so the destination has a stop to stand at.
  apiFetch: vi.fn(async p => ({ ok: true, status: 200, json: async () => (String(p).startsWith('/api/profile') ? { jlptLevel: 'N4', dailyNewTarget: 10 } : {}) })),
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
  it('opens the bare column on the destination', async () => {
    await mount('/profile/settings')
    await settle()
    expect(here.path).toBe('/profile/settings/destination')
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
    const l = contentBox(list)
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

  it('prints no title over the column or the page (plan 139)', async () => {
    await mount('/profile/settings/sound')
    await settle()
    expect(document.querySelector('.desk-settings .bar')).toBeNull()
    const h1 = document.querySelector('.desk-settings__list h1')
    const h2 = document.querySelector('.desk-settings__page h2')
    for (const h of [h1, h2]) {
      expect(h.classList.contains('sr-only')).toBe(true)
      expect(h.getBoundingClientRect().width).toBeLessThanOrEqual(1)
    }
  })

  it('marks the pass\'s field whose page is open', async () => {
    await mount('/profile/settings/service')
    await settle()
    const on = [...document.querySelectorAll('.desk-settings__list [aria-current="page"]')]
    expect(on.map(d => d.dataset.page)).toEqual(['service'])
    expect(on[0].classList.contains('stg-pass__field--on')).toBe(true)
    expect(on[0].tagName).toBe('A')
    document.querySelector('.stg-door[data-page="level"]').click()
    await settle()
    expect(here.path).toBe('/profile/settings/level')
    expect(document.querySelector('.stg-door[data-page="level"]').classList.contains('stg-pass__stop--on')).toBe(true)
  })

  it('prints Sign out once, on the account page, and nowhere else (plan 139)', async () => {
    const outs = () => [...document.querySelectorAll('button')].filter(b => /^(déconnexion|sign out)$/i.test(b.textContent.trim()))
    await mount('/profile/settings/account')
    await settle()
    expect(outs()).toHaveLength(1)
    expect(document.querySelector('.desk-settings__page').contains(outs()[0])).toBe(true)

    document.querySelector('.stg-row[data-page="sound"]').click()
    await settle()
    expect(outs()).toHaveLength(0)
  })

  // A wide window: the page takes the width beside the column (it
  // stopped at the card's), and a page of two halves stands them side by
  // side; a card of the page's own width still stops at the card's.
  it('lays a wide page in two columns of cards', async () => {
    await page.viewport(1440, 900)
    try {
      await mount('/profile/settings/account')
      await settle()
      const pane = document.querySelector('.desk-settings__page')
      const cardW = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--card-w'))
      expect(pane.getBoundingClientRect().width).toBeGreaterThan(cardW)
      const [a, b] = [...pane.querySelectorAll('.stg-col')].map(c => c.getBoundingClientRect())
      expect(Math.round(a.top)).toBe(Math.round(b.top))
      expect(b.left).toBeGreaterThan(a.right)
      expect(getComputedStyle(pane.querySelector('.slip')).borderTopStyle).toBe('solid')
      for (const act of pane.querySelectorAll('.slip__act')) expect(act.getBoundingClientRect().width).toBeLessThanOrEqual(cardW)

      document.querySelector('.stg-door[data-page="destination"]').click()
      await settle()
      const slip = document.querySelector('.desk-settings__page > .slip')
      expect(slip.getBoundingClientRect().width).toBeLessThanOrEqual(cardW)
      // On a card the hollow stops take the card's ground; the stop you
      // stand at stays filled in the ink.
      const ink = getComputedStyle(document.querySelector('.dest-here .dest__code')).color
      expect(getComputedStyle(document.querySelector('.dest-here .dest__dot')).backgroundColor).toBe(ink)
    } finally {
      await page.viewport(1100, 800)
    }
  })

  // A laptop's short window (plan 123): the column is sticky, and
  // taller than the window it had its foot under the window's floor,
  // beyond any scroll. It is bounded by the window now, and scrolls on
  // its own to its last door.
  it('keeps the column\'s last door within reach on a short window', async () => {
    await page.viewport(1100, 600)
    try {
      await mount('/profile/settings/sound')
      await settle()
      const list = document.querySelector('.desk-settings__list')
      expect(list.getBoundingClientRect().bottom).toBeLessThanOrEqual(window.innerHeight)
      list.scrollTop = list.scrollHeight
      await settle(60)
      const doors = list.querySelectorAll('.stg-door')
      const last = doors[doors.length - 1].getBoundingClientRect()
      expect(last.bottom).toBeLessThanOrEqual(window.innerHeight)
      expect(last.top).toBeGreaterThanOrEqual(0)
    } finally {
      await page.viewport(1100, 800)
    }
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
