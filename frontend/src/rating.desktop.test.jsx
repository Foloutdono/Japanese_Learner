import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { page } from 'vitest/browser'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { LangProvider } from './LangContext'
import './index.css'

// ── 評価 — the rating sheet on the desk (plan 167) ────────────────
// Opened by the Shell itself, so only ever in the chrome: a dialog in
// the window's middle at a column's width, as the claim sheet is --
// nothing on the rail opened it. Under five, the field takes the focus
// and the corner's ✕ is the way out a mouse has.

const posts = vi.hoisted(() => [])
vi.mock('./lib/api', () => ({
  api: p => p,
  apiFetch: vi.fn(async () => ({ ok: true, status: 200, json: async () => ({}) })),
  apiJson: vi.fn(async (path, _s, opts) => {
    if (path === '/api/rating/prompt') return { ask: true }
    if (path === '/api/rating') {
      const body = JSON.parse(opts.body)
      posts.push(body)
      return { ok: true, store: body.stars === 5 }
    }
    return {}
  }),
  apiJsonWithTimeout: vi.fn(), apiUpload: vi.fn(),
  ApiError: class extends Error {},
}))
vi.mock('./lib/supabase', () => ({
  supabase: { auth: {
    getSession: async () => ({ data: { session: { access_token: 'tok' } } }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
  } },
}))
vi.mock('./stores/profileSummary', async o => ({ ...(await o()),
  useProfileSummary: () => ({ level: 12, xp: 1200, xpPrevLevel: 1000, xpForNext: 1500, username: 'Aiko', streak: 3 }),
  useProfileSummaryState: () => ({ summary: null, failed: false }),
  refreshSummary: vi.fn(),
}))
vi.mock('./stores/journey', () => ({
  useJourneyStatus: () => ({ data: null, failed: false }),
  refreshJourney: vi.fn(), seedJourneyStatus: vi.fn(), openStatus: vi.fn(),
}))
vi.mock('./stores/today', () => ({
  useTodaySummary: () => ({ data: { total: 24, by_source: {}, lanes: [], next_due: null }, failed: false }),
  refreshToday: vi.fn(), seedTodaySummary: vi.fn(),
}))
vi.mock('./lib/audio', async o => ({ ...(await o()), playClick: vi.fn() }))
globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })

const rating = await import('./stores/rating')
const { Shell } = await import('./components/chrome/Shell')

const px = name => parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name))
function viewport() {
  const probe = document.createElement('div')
  probe.style.cssText = 'position: fixed; inset: 0'
  document.body.appendChild(probe)
  const box = probe.getBoundingClientRect()
  probe.remove()
  return box
}

function mount() {
  localStorage.setItem('lang', 'en')
  return render(
    <LangProvider>
      <MemoryRouter initialEntries={['/today']}>
        <Routes>
          <Route element={<Shell />}>
            <Route path="/today" element={<main id="main-content">here</main>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </LangProvider>
  )
}

beforeEach(() => {
  rating.resetRating()
  posts.length = 0
})

describe('the rating sheet on the desk', () => {
  it('opens from the chrome in the window\'s middle, at a column\'s width', async () => {
    for (let i = 0; i < rating.VISIT_REVIEWS; i++) rating.noteReview()
    mount()
    await expect.element(page.getByRole('dialog'), { timeout: 4000 }).toBeVisible()
    expect(document.documentElement.dataset.chrome).toBe('shell')
    const sheet = document.querySelector('.sheet.rate-sheet')
    const box = sheet.getBoundingClientRect()
    expect(box.width).toBe(px('--desk-side-w'))
    const view = viewport()
    expect(Math.abs((box.left - view.left) - (view.right - box.right))).toBeLessThanOrEqual(1)
    expect(Math.abs((box.top - view.top) - (view.bottom - box.bottom))).toBeLessThanOrEqual(1)
    // The five stars in one row.
    const stars = [...sheet.querySelectorAll('.rate-stars__star')].map(el => el.getBoundingClientRect())
    expect(stars).toHaveLength(5)
    expect(stars.every(r => r.top === stars[0].top)).toBe(true)
  })

  it('under five, hands the field the focus and a mouse its ✕', async () => {
    for (let i = 0; i < rating.VISIT_REVIEWS; i++) rating.noteReview()
    mount()
    await expect.element(page.getByRole('dialog'), { timeout: 4000 }).toBeVisible()
    await page.getByRole('button', { name: '4 stars' }).click()
    await expect.poll(() => document.activeElement?.id).toBe('rate-comment')
    await page.getByRole('button', { name: 'Close' }).click()
    await expect.poll(() => document.querySelector('[role="dialog"]')).toBe(null)
    expect(posts).toEqual([{ stars: 4, comment: null, platform: 'web', lang: 'en' }])
  })
})
