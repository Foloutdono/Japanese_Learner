import { describe, it, expect, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { LangProvider } from './LangContext'
import './index.css'

// ── Settings on a phone (plan 139) ───────────────────────────────
// The pass printed with its contract over the list, and the pages they
// open, at 390px. Pinned here: what a narrow screen breaks first --
//   1. the pass's doors are thumb targets, the buttons they always were;
//   2. the Service page's time axis and each line's date stay inside
//      the chart and clear of each other on a track ~150px wide (the
//      first draw printed four ticks over each other and cut the dates
//      off at the screen's edge);
//   3. the themes stand three across, drawn.

const JOURNEY = {
  goalStartLevel: 'N4', goalLevel: 'N3', goalTargetDate: '2027-03-12', goalSetAt: '2026-09-01T00:00:00+00:00',
  plannedPerDay: 10, dailyDeparture: 'am', itemsTotal: 3300, itemsDone: 400, actual14: 112, days14: 14,
}
const ANSWERS = {
  '/api/profile': { jlptLevel: 'N4', dailyNewTarget: 10, lines: ['vocab', 'kanji', 'grammar'], kanaKnown: 'both', ratingScale: 'simple' },
  '/api/journey/status': JOURNEY,
  '/api/onboarding/volumes': {
    vocab: { N5: 800, N4: 600, N3: 1800, N2: 1800, N1: 2500 },
    kanji: { N5: 100, N4: 200, N3: 350, N2: 400, N1: 1200 },
    grammar: { N5: 80, N4: 80, N3: 120, N2: 140, N1: 200 },
    kana: 104,
  },
}
const answer = p => ANSWERS[String(p).split('?')[0]] ?? {}

vi.mock('./lib/api', () => ({
  api: p => p,
  apiFetch: vi.fn(async p => ({ ok: true, status: 200, json: async () => answer(p) })),
  apiJson: vi.fn(async p => answer(p)),
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

const { default: SettingsScreen } = await import('./screens/SettingsScreen')

const settle = (ms = 400) => new Promise(r => setTimeout(r, ms))
const SESSION = { access_token: 'tok', user: { email: 'toi@exemple.fr' } }

async function mount(path) {
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

const box = el => el.getBoundingClientRect()

describe('Settings at phone width', () => {
  it('prints the pass with its doors as thumb targets, buttons each', async () => {
    await mount('/profile/settings')
    const doors = [...document.querySelectorAll('.stg-pass .stg-door')]
    expect(doors).toHaveLength(5)
    for (const door of doors) {
      expect(door.tagName).toBe('BUTTON')
      expect(box(door).height).toBeGreaterThanOrEqual(44)
    }
    // The fields keep their chevron here; the stops name themselves.
    expect(document.querySelectorAll('.stg-pass__field .stg-pass__chev')).toHaveLength(3)
    // The card stands inside the screen's box.
    const pass = box(document.querySelector('.stg-pass'))
    const list = box(document.querySelector('.stg-list'))
    expect(Math.round(pass.left)).toBe(Math.round(list.left))
    expect(Math.round(pass.right)).toBe(Math.round(list.right))
  })

  it('keeps the service lines\' dates and ticks inside the chart and clear of each other', async () => {
    await mount('/profile/settings/service')
    const chart = box(document.querySelector('.svc-chart'))
    const whens = [...document.querySelectorAll('.svc-row__when')].map(box)
    expect(whens.length).toBeGreaterThanOrEqual(3)
    for (const w of whens) {
      expect(w.left).toBeGreaterThanOrEqual(chart.left - 1)
      expect(w.right).toBeLessThanOrEqual(chart.right + 1)
    }
    // Each date sits over its rail, never on it.
    for (const row of document.querySelectorAll('.svc-row')) {
      const when = box(row.querySelector('.svc-row__when'))
      const end = box(row.querySelector('.svc-row__end'))
      expect(when.bottom).toBeLessThanOrEqual(end.top + 1)
    }
    const ticks = [...document.querySelectorAll('.svc-chart__tick')].map(box)
    for (let i = 1; i < ticks.length; i++) expect(ticks[i].left).toBeGreaterThanOrEqual(ticks[i - 1].right)
    for (const t of ticks) expect(t.right).toBeLessThanOrEqual(chart.right + 1)
  })

  it('draws the three themes three across', async () => {
    await mount('/profile/settings/display')
    const picks = [...document.querySelectorAll('.theme-pick')].map(box)
    expect(picks).toHaveLength(3)
    expect(Math.round(picks[0].top)).toBe(Math.round(picks[2].top))
    expect(document.querySelectorAll('.theme-pick .theme-mini__face')).toHaveLength(4)
    expect(document.querySelector('[class*="desk-"]')).toBeNull()
  })
})
