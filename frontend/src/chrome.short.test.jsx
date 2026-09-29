import { describe, it, expect, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { LangProvider } from './LangContext'
import './index.css'

// ── 低 — the rail on a laptop's short window (plan 169) ─────────────
// Five gates, the lit gate's stations and the pass at the foot were
// 676px on a 600px window: the gates' list scrolled with Dictionary and
// Profile under the pass, where a learner on a laptop never found them.
// The masthead and the pass come a rung closer and a station's row
// down to 28px, so the rail holds whole down to this window.

const apiFetch = vi.fn(async () => ({ ok: false, status: 500, json: async () => ({}) }))
vi.mock('./lib/api', () => ({
  api: p => p,
  apiFetch: (...a) => apiFetch(...a),
  apiJson: vi.fn(async () => ({})),
  apiJsonWithTimeout: vi.fn(),
  apiUpload: vi.fn(),
  ApiError: class ApiError extends Error {},
}))
vi.mock('./lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: async () => ({ data: { session: { access_token: 'tok' } } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    },
  },
}))
vi.mock('./stores/profileSummary', async (o) => ({ ...(await o()),
  useProfileSummary: () => ({ level: 12, xp: 1200, xpPrevLevel: 1000, xpForNext: 1500, username: 'Aiko', streak: 3 }),
  useProfileSummaryState: () => ({ summary: null, failed: false }),
  refreshSummary: vi.fn(),
}))
const journeyRef = { current: null }
vi.mock('./stores/journey', () => ({
  useJourneyStatus: () => ({ data: journeyRef.current, failed: false }),
  refreshJourney: vi.fn(),
  seedJourneyStatus: vi.fn(),
  openStatus: vi.fn(),
}))
// The balance on the rail's pass (plan 127): null is the store before
// the API has answered.
const creditsRef = { current: null }
vi.mock('./stores/credits', async (o) => ({ ...(await o()),
  useCredits: () => creditsRef.current,
  openBalance: vi.fn(),
}))
const todayRef = { current: { total: 24, by_source: {}, lanes: [], next_due: null } }
vi.mock('./stores/today', () => ({
  useTodaySummary: () => ({ data: todayRef.current, failed: false }),
  refreshToday: vi.fn(),
  seedTodaySummary: vi.fn(),
}))
vi.mock('./lib/audio', async (importOriginal) => ({
  ...(await importOriginal()),
  playClick: vi.fn(),
}))
globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })

const { Shell } = await import('./components/chrome/Shell')
const settle = (ms = 200) => new Promise(r => setTimeout(r, ms))

function mountShell(path) {
  const screen = <main id="main-content">here</main>
  return render(
    <LangProvider>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route element={<Shell />}>
            <Route path="/learn/kana" element={screen} />
            <Route path="/practice" element={screen} />
          </Route>
        </Routes>
      </MemoryRouter>
    </LangProvider>
  )
}

describe('the rail on a short window', () => {
  it.each(['/learn/kana', '/practice'])('holds every gate and every station of %s above the pass', async path => {
    await mountShell(path)
    await settle()
    const gates = document.querySelector('.desk-rail__gates')
    expect(gates.scrollHeight).toBeLessThanOrEqual(gates.clientHeight + 1)
    const foot = document.querySelector('.desk-rail__foot').getBoundingClientRect()
    const last = [...document.querySelectorAll('.desk-gate')].at(-1).getBoundingClientRect()
    expect(last.bottom).toBeLessThanOrEqual(foot.top)
    expect(foot.bottom).toBeLessThanOrEqual(window.innerHeight)
  })
})
