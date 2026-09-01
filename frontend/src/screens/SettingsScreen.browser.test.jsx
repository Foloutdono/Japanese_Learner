import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { MemoryRouter } from 'react-router-dom'
import { LangProvider } from '../LangContext'
import '../index.css'

// ── 窓口 — the settings counter ────────────────────────────────
// The rail-and-slips rebuild (案三 of the settings round). Pinned
// here: the parts that fail quietly —
//   1. every counter is reachable and switching shows exactly one slip
//      (a pane lost to a typo'd id would just never render);
//   2. the level strip WRITES — a pretty radiogroup that never calls
//      PATCH /api/profile/learning is worse than the <select> it
//      replaced;
//   3. the reset is genuinely two-step: nothing may hit
//      DELETE /api/stats/reset until the second, explicit press.

const apiJson = vi.fn()
const apiFetch = vi.fn()

vi.mock('../lib/api', () => ({
  api: p => p,
  apiFetch: (...a) => apiFetch(...a),
  apiJson: (...a) => apiJson(...a),
  apiJsonWithTimeout: vi.fn(),
  apiUpload: vi.fn(),
  ApiError: class ApiError extends Error {},
}))

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: async () => ({ data: { session: { access_token: 'tok' } } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
      signOut: async () => {},
    },
  },
}))

// Real settings store (the presets test needs the live volume model);
// only the players are stubbed. Spread importOriginal — other modules
// in the graph pull further names out of lib/audio.
vi.mock('../lib/audio', async (importOriginal) => ({
  ...(await importOriginal()),
  playClick: vi.fn(),
  playToggle: vi.fn(),
  playUi: vi.fn(),
}))

globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })

const { default: SettingsScreen } = await import('./SettingsScreen')

const settle = (ms = 80) => new Promise(r => setTimeout(r, ms))

const PROFILE = {
  username: 'Tester', level: 3, xp: 10, xpPrevLevel: 0, xpForNext: 100,
  jlptLevel: 'N5', dailyNewTarget: 10, streak: 1, week: [], daruma: {},
}

function mount() {
  return render(
    <LangProvider>
      <MemoryRouter>
        <SettingsScreen session={{ access_token: 'tok', user: { email: 'dev@example.com' } }} />
      </MemoryRouter>
    </LangProvider>
  )
}

beforeEach(() => {
  apiJson.mockReset()
  apiFetch.mockReset()
  apiFetch.mockResolvedValue({ ok: true, status: 200, json: async () => PROFILE })
  apiJson.mockResolvedValue({})
  window.history.replaceState(null, '', '/')
})

describe('SettingsScreen — the counter', () => {
  it('shows one slip at a time and switches counters (hash included)', async () => {
    const screen = await mount()
    await settle()
    const root = screen.container

    const tabs = root.querySelectorAll('.stg-rail__item')
    expect(tabs).toHaveLength(5)

    // COMPUTED display, not the hidden attribute: the slip carries
    // .settings-card's display: flex, and an author display outranks
    // the UA's [hidden] rule — asserting the attribute alone passed
    // while every slip rendered at once (shipped broken exactly so).
    const visible = () => [...root.querySelectorAll('[role="tabpanel"]')]
      .filter(p => getComputedStyle(p).display !== 'none')
    expect(visible()).toHaveLength(1)
    expect(visible()[0].id).toBe('stg-pane-env')

    root.querySelector('[data-id="data"]').click()
    await settle(30)
    expect(visible()).toHaveLength(1)
    expect(visible()[0].id).toBe('stg-pane-data')
    expect(window.location.hash).toBe('#data')
  })

  it('opens on the counter the hash names', async () => {
    window.history.replaceState(null, '', '#son')
    const screen = await mount()
    await settle()
    const open = [...screen.container.querySelectorAll('[role="tabpanel"]')]
      .filter(p => getComputedStyle(p).display !== 'none')
    expect(open).toHaveLength(1)
    expect(open[0].id).toBe('stg-pane-son')
  })

  it('level strip marks the profile level and writes the picked one', async () => {
    const screen = await mount()
    await settle()
    const root = screen.container
    root.querySelector('[data-id="learning"]').click()
    await settle(30)

    const checked = root.querySelector('.stg-lvlstrip__stop[aria-checked="true"]')
    expect(checked.textContent).toBe('N5')

    const stops = [...root.querySelectorAll('.stg-lvlstrip__stop')]
    stops.find(s => s.textContent === 'N3').click()
    await settle(30)

    const call = apiJson.mock.calls.find(c => c[0] === '/api/profile/learning')
    expect(call, 'picking a stop must PATCH the learning profile').toBeTruthy()
    expect(call[2].method).toBe('PATCH')
    expect(JSON.parse(call[2].body)).toEqual({ jlptLevel: 'N3' })
  })

  it('reset fires only after the second, explicit press', async () => {
    const screen = await mount()
    await settle()
    const root = screen.container
    root.querySelector('[data-id="data"]').click()
    await settle(30)

    root.querySelector('.stg-danger-btn').click()
    await settle(30)
    expect(root.querySelector('.stg-confirm')).toBeTruthy()
    expect(apiJson.mock.calls.some(c => c[0] === '/api/stats/reset')).toBe(false)

    root.querySelector('.stg-confirm .stg-danger-btn').click()
    await settle(30)
    const call = apiJson.mock.calls.find(c => c[0] === '/api/stats/reset')
    expect(call).toBeTruthy()
    expect(call[2].method).toBe('DELETE')
  })

  it('the quiet preset silences exactly the station theatre', async () => {
    const audio = await import('../lib/audio')
    const screen = await mount()
    await settle()
    const root = screen.container
    root.querySelector('[data-id="son"]').click()
    await settle(30)

    const quiet = root.querySelector('.stg-preset')
    quiet.click()
    await settle(30)
    expect(quiet.getAttribute('aria-pressed')).toBe('true')

    // The model itself, not just the button: theatre at zero, study
    // channels untouched.
    const read = () => {
      let out
      const unsub = () => {}
      out = JSON.parse(window.localStorage.getItem('jp-app-volumes') ?? '{}')
      void unsub
      return out
    }
    const vols = read()
    expect(vols.ambiance).toBe(0)
    expect(vols.jingle).toBe(0)
    expect(vols.announcement).toBe(0)
    expect(vols.kana ?? audio.DEFAULT_VOLUMES.kana).toBe(audio.DEFAULT_VOLUMES.kana)
  })
})
