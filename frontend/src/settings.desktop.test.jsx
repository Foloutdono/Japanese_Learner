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
// Within a pixel: a 1fr track splits an odd pixel, and two boxes that
// share a line can land either side of a half.
const near = (a, b) => expect(Math.abs(a - b)).toBeLessThanOrEqual(1)
const SESSION = { access_token: 'tok', user: { email: 'dev@example.com' } }

const here = { path: null }
function Probe() {
  here.path = useLocation().pathname
  return null
}

function mount(path, session = SESSION) {
  return render(
    <LangProvider>
      <MemoryRouter initialEntries={[path]}>
        <div className="phone phone--desk">
          <div className="phone__content">
            <Routes>
              <Route path="/profile/settings" element={<SettingsScreen session={session} />} />
              <Route path="/profile/settings/:page" element={<SettingsScreen session={session} />} />
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
  // stopped at the card's), and its slips stand in rows of two (plan
  // 145): a row's two cards share their top and their height, with their
  // actions at its foot, so the page ends level rather than in two
  // columns of different lengths. Every card runs to the page's edge --
  // a page of one card stopped at the card's, its right third empty --
  // and no action runs past the card's width.
  it('lays a wide page in rows of two cards that end level', async () => {
    await page.viewport(1440, 900)
    try {
      await mount('/profile/settings/account')
      await settle()
      const pane = document.querySelector('.desk-settings__page')
      const cardW = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--card-w'))
      const p = pane.getBoundingClientRect()
      expect(p.width).toBeGreaterThan(cardW)
      // The policy and the sign-out, the trail and the export, the two
      // erasures: the phone's order, read across.
      const rows = [...pane.querySelectorAll('.stg-pair')]
      expect(rows.map(r => r.children.length)).toEqual([2, 2, 2])
      for (const row of rows) {
        const [a, b] = [...row.children].map(c => c.getBoundingClientRect())
        near(a.top, b.top)
        near(a.height, b.height)
        expect(b.left).toBeGreaterThan(a.right)
        near(a.left, p.left)
        near(b.right, p.right)
      }
      for (const row of rows) {
        const [a, b] = [...row.querySelectorAll('.slip__act, .seg')].map(x => x.getBoundingClientRect().bottom)
        near(a, b)
      }
      expect(getComputedStyle(pane.querySelector('.slip')).borderTopStyle).toBe('solid')
      for (const act of pane.querySelectorAll('.slip__act')) expect(act.getBoundingClientRect().width).toBeLessThanOrEqual(cardW)

      document.querySelector('.stg-door[data-page="destination"]').click()
      await settle()
      const dest = document.querySelector('.desk-settings__page')
      const slip = dest.querySelector(':scope > .slip')
      near(slip.getBoundingClientRect().width, dest.getBoundingClientRect().width)
      // On a card the hollow stops take the card's ground; the stop you
      // stand at stays filled in the ink.
      const ink = getComputedStyle(document.querySelector('.dest-here .dest__code')).color
      expect(getComputedStyle(document.querySelector('.dest-here .dest__dot')).backgroundColor).toBe(ink)
    } finally {
      await page.viewport(1100, 800)
    }
  })

  // A card of one action that takes the page's width lies across it
  // (plan 145): its words in the left half and its action in the right,
  // under the row's actions at their width, rather than a button the
  // page's width for one word. The Google offer (this pass has none),
  // the placement test and, with no destination, the way to one.
  it('lays a card of one action across the page, its action under the row\'s', async () => {
    await page.viewport(1440, 900)
    try {
      await mount('/profile/settings/account')
      await settle()
      const across = document.querySelector('.desk-settings__page > .slip--across')
      const words = across.querySelector('.slip__label').getBoundingClientRect()
      const act = across.querySelector('.auth-provider').getBoundingClientRect()
      const out = document.querySelector('.stg-pair > .slip:nth-child(2) .slip__act').getBoundingClientRect()
      expect(act.left).toBeGreaterThan(words.right)
      near(act.left, out.left)
      near(act.width, out.width)

      for (const [door, action] of [['level', '.slip__act'], ['service', '[data-action="goal-set"]']]) {
        document.querySelector(`.stg-door[data-page="${door}"]`).click()
        await settle()
        const slip = document.querySelector('.desk-settings__page > .slip--across')
        const s = slip.getBoundingClientRect()
        const a = slip.querySelector(action).getBoundingClientRect()
        const l = slip.querySelector('.slip__label').getBoundingClientRect()
        expect(Math.round(a.top - s.top)).toBeGreaterThan(0)
        expect(a.left).toBeGreaterThan(s.left + s.width / 2)
        expect(l.right).toBeLessThan(a.left)
      }
    } finally {
      await page.viewport(1100, 800)
    }
  })

  // A guest's claim is two ways in (plan 145): Google in the left half,
  // the address and its button in the right, under the one name -- not a
  // form and two buttons the page's width.
  it('sets a guest\'s two ways in side by side', async () => {
    await page.viewport(1440, 900)
    try {
      await mount('/profile/settings/account', { access_token: 'tok', user: { is_anonymous: true } })
      await settle()
      const cardW = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--card-w'))
      const claim = document.querySelector('.desk-settings__page > .slip--ways')
      const [google, form] = [...claim.querySelectorAll(':scope > .slip__way')].map(w => w.getBoundingClientRect())
      near(google.top, form.top)
      expect(form.left).toBeGreaterThan(google.right)
      expect(claim.querySelector('.slip__label').getBoundingClientRect().bottom).toBeLessThanOrEqual(google.top)
      for (const b of claim.querySelectorAll('.auth-provider, .slip__act, input')) {
        expect(b.getBoundingClientRect().width).toBeLessThanOrEqual(cardW)
      }
      const ways = claim.querySelectorAll(':scope > .slip__way')
      expect(ways[0].contains(claim.querySelector('.auth-provider'))).toBe(true)
      expect(ways[1].contains(claim.querySelector('input[type="email"]'))).toBe(true)
    } finally {
      await page.viewport(1100, 800)
    }
  })

  // The level's line on the desk names every stop (plan 145), as the
  // destination's does, while the page holds two columns; in one, five
  // names across it are too narrow, and only the stop you stand at
  // prints its name, as on the phone.
  it('names every stop of the level where the page holds two columns', async () => {
    const shown = () => [...document.querySelectorAll('.lvlstrip__jp')].filter(n => n.getBoundingClientRect().width > 0)
    await mount('/profile/settings/level')
    await settle()
    expect(shown().map(n => n.textContent)).toEqual(['Élémentaire'])

    await page.viewport(1440, 900)
    try {
      await settle()
      const names = shown().map(n => n.getBoundingClientRect())
      expect(names).toHaveLength(5)
      for (let i = 1; i < names.length; i++) expect(names[i].left).toBeGreaterThan(names[i - 1].right)
      const pane = document.querySelector('.desk-settings__page').getBoundingClientRect()
      near(document.querySelector('.lvlstrip').closest('.slip').getBoundingClientRect().width, pane.width)
    } finally {
      await page.viewport(1100, 800)
    }
  })

  // The presets over the mixer, each at the page's width (plan 145):
  // beside it, at half a page, the presets wrapped onto three lines and
  // the tracks were cut to a thumb's length. The mixer's names stand in
  // one column as wide as the longest, each on one line, and every track
  // starts and ends where the others do.
  it('stands the presets over a mixer whose tracks run together', async () => {
    await page.viewport(1440, 900)
    try {
      await mount('/profile/settings/sound')
      await settle()
      const pane = document.querySelector('.desk-settings__page')
      const [presets, mixer] = [...pane.querySelectorAll(':scope > .slip')].map(c => c.getBoundingClientRect())
      expect(presets.bottom).toBeLessThan(mixer.top)
      near(presets.width, mixer.width)
      const picks = [...pane.querySelectorAll('[data-preset]')].map(b => b.getBoundingClientRect())
      for (const b of picks) near(b.top, picks[0].top)
      const tracks = [...pane.querySelectorAll('.vol-slider-wrap')].map(t => t.getBoundingClientRect())
      expect(tracks).toHaveLength(8)
      for (const t of tracks) {
        near(t.left, tracks[0].left)
        near(t.width, tracks[0].width)
      }
      expect(tracks[0].width).toBeGreaterThan(mixer.width / 2)
      const names = [...pane.querySelectorAll('.category-volume-row__label')].map(l => l.getBoundingClientRect().height)
      for (const h of names) near(h, names[0])
    } finally {
      await page.viewport(1100, 800)
    }
  })

  // The themes beside the language (plan 139), the two languages one
  // over the other down the screens' height (plan 145): the row's two
  // cards end level, and neither holds a short pair of cards at its top.
  it('stands the languages down the theme screens\' height', async () => {
    await page.viewport(1440, 900)
    try {
      await mount('/profile/settings/display')
      await settle()
      const [theme, lang] = [...document.querySelectorAll('.stg-pair > .slip')].map(c => c.getBoundingClientRect())
      near(theme.height, lang.height)
      const [fr, en] = [...document.querySelectorAll('.lang-pick')].map(b => b.getBoundingClientRect())
      expect(en.top).toBeGreaterThan(fr.bottom)
      near(fr.height, en.height)
      const screens = document.querySelector('.theme-picks').getBoundingClientRect()
      expect(en.bottom).toBeGreaterThanOrEqual(screens.bottom - 1)
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
