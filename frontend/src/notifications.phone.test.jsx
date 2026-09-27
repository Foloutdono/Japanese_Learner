import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { LangProvider } from './LangContext'
import fr from './locales/fr/index.js'
import './index.css'

// ── Settings › Notifications on a phone (plan 156) ───────────────
// A shell's page only: the web has nothing to schedule, so neither the
// row nor the page exists there. In the shell, the daily train is a
// switch that asks the OS before it is stored, the hour is a door to
// the ride's page, and the next reminder is printed as it will read.

const PROFILE = { jlptLevel: 'N5', dailyNewTarget: 10, lines: ['vocab'], kanaKnown: 'both', ratingScale: 'simple' }
const ANSWERS = { '/api/profile': { ...PROFILE } }
const answer = p => ANSWERS[String(p).split('?')[0]] ?? {}
const patches = []

vi.mock('./lib/api', () => ({
  api: p => p,
  apiFetch: vi.fn(async p => ({ ok: true, status: 200, json: async () => answer(p) })),
  apiJson: vi.fn(async (p, _s, opts = {}) => {
    if (opts.method === 'PATCH') {
      const body = JSON.parse(opts.body)
      patches.push(body)
      Object.assign(ANSWERS['/api/profile'], body)
      return body
    }
    return answer(p)
  }),
  apiJsonWithTimeout: vi.fn(async () => ({})),
  apiUpload: vi.fn(),
  ApiError: class extends Error {},
}))
vi.mock('./lib/supabase', () => ({
  supabase: { auth: {
    getSession: async () => ({ data: { session: { access_token: 'tok' } } }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    signOut: vi.fn(),
  } },
}))
vi.mock('./lib/audio', async o => ({ ...(await o()), playUi: vi.fn(), playClick: vi.fn(), playToggle: vi.fn() }))

// The shell, as far as the page can tell: whether it is one, and what
// the OS says about notifications.
const shell = { native: true, permission: 'granted', grants: true }
vi.mock('./lib/platform', async o => ({
  ...(await o()),
  isNative: () => shell.native,
  canNudge: () => shell.native,
  nativePlatform: () => (shell.native ? 'android' : 'web'),
  nudgePermission: async () => shell.permission,
  requestNudgePermission: vi.fn(async () => {
    if (shell.permission === 'prompt') shell.permission = shell.grants ? 'granted' : 'denied'
    return shell.permission === 'granted'
  }),
}))

const { default: SettingsScreen } = await import('./screens/SettingsScreen')
const { refreshSummary } = await import('./stores/profileSummary')
const { setAheadPlan, forgetAheadPlan } = await import('./stores/ahead')

const settle = (ms = 300) => new Promise(r => setTimeout(r, ms))
const SESSION = { access_token: 'tok', user: { email: 'toi@exemple.fr' } }
// The lane is a French phone (vite.config.js); the copy is read from the
// same table the page reads, never typed here.
const t = fr

async function mount(path) {
  await refreshSummary()
  await render(
    <LangProvider>
      <MemoryRouter initialEntries={[path]}>
        <div className="phone"><div className="phone__content">
          <Routes>
            <Route path="/profile/settings" element={<SettingsScreen session={SESSION} />} />
            <Route path="/profile/settings/:page" element={<SettingsScreen session={SESSION} />} />
          </Routes>
        </div></div>
      </MemoryRouter>
    </LangProvider>
  )
  await settle()
}

const onOption = () => document.querySelector('.seg__opt[aria-checked="true"]')?.textContent
const hint = () => document.querySelector('.slip__hint')?.textContent

beforeEach(() => {
  Object.assign(shell, { native: true, permission: 'granted', grants: true })
  ANSWERS['/api/profile'] = { ...PROFILE, notifications: true, reminderTime: '19:00' }
  patches.length = 0
  forgetAheadPlan()
})

describe('Settings › Notifications at phone width', () => {
  it('is no row and no page on the web', async () => {
    shell.native = false
    await mount('/profile/settings/notifications')
    // Sent back to the list, which has no such row.
    expect(document.querySelector('.stg-home')).not.toBeNull()
    expect(document.querySelector('[data-page="notifications"]')).toBeNull()
  })

  it('is a row in the shell, saying the hour it rings at', async () => {
    await mount('/profile/settings')
    const row = document.querySelector('[data-page="notifications"]')
    expect(row).not.toBeNull()
    expect(row.textContent).toContain('19:00')
  })

  it('prints the switch, the hour’s door and the next reminder as it will read', async () => {
    const at = new Date(Date.now() + 26 * 3600_000)
    setAheadPlan({ nudges: [{
      id: 101, at, title: 'Your 19:00 train · 42 cards', summary: 'About 7 min · 3 new',
      lines: ['Vocabulary N5 · 30', 'Kanji N5 · 12'], body: '', extra: { to: '/today' },
    }], failed: false })
    await mount('/profile/settings/notifications')

    expect(onOption()).toBe(t.notifOnOff.on)
    const door = document.querySelector('[data-row="hour"]')
    expect(door.getAttribute('href')).toBe('/profile/settings/hour')
    expect(door.textContent).toContain('19:00')
    for (const row of document.querySelectorAll('.stg-row')) {
      expect(row.getBoundingClientRect().height).toBeGreaterThanOrEqual(44)
    }
    const next = document.querySelector('[data-next]')
    expect(next.textContent).toContain('Your 19:00 train · 42 cards')
    expect(next.textContent).toContain('Kanji N5 · 12')
    expect(hint()).toBe(t.notifRule)
    // Nothing wider than the phone.
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(390)
  })

  it('asks the OS before it stores a yes', async () => {
    ANSWERS['/api/profile'].notifications = false
    shell.permission = 'prompt'
    await mount('/profile/settings/notifications')
    expect(onOption()).toBe(t.notifOnOff.off)

    document.querySelector('.seg__opt[aria-checked="false"]').click()
    await settle()
    expect(patches).toEqual([{ notifications: true }])
    expect(onOption()).toBe(t.notifOnOff.on)
  })

  it('stores nothing when the OS says no, and says where to change it', async () => {
    ANSWERS['/api/profile'].notifications = false
    Object.assign(shell, { permission: 'prompt', grants: false })
    await mount('/profile/settings/notifications')

    document.querySelector('.seg__opt[aria-checked="false"]').click()
    await settle()
    expect(patches).toEqual([])
    expect(onOption()).toBe(t.notifOnOff.off)
    expect(hint()).toBe(t.notifDenied)
  })

  it('says so when there is no hour to ring at, or nothing due this week', async () => {
    ANSWERS['/api/profile'].reminderTime = null
    await mount('/profile/settings/notifications')
    expect(hint()).toBe(t.notifNoHour)
    expect(document.querySelector('[data-row="hour"]').textContent).toContain(t.destAnyTime)
  })

  it('says the week is quiet when the plan holds nothing', async () => {
    setAheadPlan({ nudges: [], failed: false })
    await mount('/profile/settings/notifications')
    expect(document.querySelector('[data-next]')).toBeNull()
    expect(hint()).toBe(t.notifQuiet)
  })

  it('turns the train off with one tap', async () => {
    await mount('/profile/settings/notifications')
    document.querySelector('.seg__opt[aria-checked="false"]').click()
    await settle()
    expect(patches).toEqual([{ notifications: false }])
    expect(onOption()).toBe(t.notifOnOff.off)
  })
})
