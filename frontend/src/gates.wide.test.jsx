import { describe, it, expect, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { MemoryRouter } from 'react-router-dom'
import { LangProvider } from './LangContext'
import './index.css'

// ── 机 — the Practice gate three across (plan 129) ───────────────
// The `wide` lane: a laptop's 1440×900. Once three plates hold a French
// platform name whole, Practice's six stand three across in two rows,
// and the two rows still take the window: the grades' rows share each
// plate's height, the page does not scroll. At the desk's tightest
// (gates.desktop.test) they stay two across in three rows.

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
    },
  },
}))
vi.mock('./lib/audio', async o => ({
  ...(await o()), playUi: vi.fn(), playAnnouncement: vi.fn(), playClick: vi.fn(),
}))
vi.mock('./stores/profileSummary', async (o) => ({ ...(await o()), useProfileSummary: () => ({ jlptLevel: 'N5' }) }))
globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })

const { default: PracticeScreen } = await import('./screens/PracticeScreen')

const settle = (ms = 620) => new Promise(r => setTimeout(r, ms))
const box = el => el.getBoundingClientRect()

describe('the Practice gate on a laptop (plan 129)', () => {
  it('stands its six plates three across in two rows, filling the window', async () => {
    await render(
      <LangProvider>
        <MemoryRouter initialEntries={['/practice']}>
          <div className="phone phone--desk">
            <div className="phone__content"><PracticeScreen /></div>
          </div>
        </MemoryRouter>
      </LangProvider>
    )
    await settle()
    const plates = [...document.querySelectorAll('.practice > .plates > .plate')].map(box)
    expect(plates).toHaveLength(6)
    const tops = [...new Set(plates.map(p => Math.round(p.top)))]
    expect(tops).toHaveLength(2)
    expect(plates.filter(p => Math.round(p.top) === tops[0])).toHaveLength(3)
    expect(Math.max(...plates.map(p => p.width)) - Math.min(...plates.map(p => p.width))).toBeLessThanOrEqual(1)
    // Three across, and every French name still whole.
    for (const title of document.querySelectorAll('.plate__title')) {
      expect(title.scrollWidth).toBeLessThanOrEqual(title.clientWidth)
    }
    expect(document.scrollingElement.scrollHeight).toBeLessThanOrEqual(window.innerHeight + 1)
    const gutter = parseFloat(getComputedStyle(document.querySelector('.practice')).paddingBottom)
    expect(Math.abs(Math.max(...plates.map(p => p.bottom)) - (window.innerHeight - gutter))).toBeLessThanOrEqual(2)
  })
})
