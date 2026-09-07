import { describe, it, expect, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom'
import { LangProvider } from '../../LangContext'
import '../../index.css'

// ── The run stops at the balance (plan 069) ───────────────────
// A 402 out_of_credits from a review raises the sheet (through the
// store, from anywhere); it prints zero in the danger register, what
// was cleared and what waits, and its one action goes back to the
// station and takes the sheet down.

vi.mock('../../lib/supabase', () => ({
  supabase: { auth: { getSession: async () => ({ data: { session: null } }) } },
}))
vi.mock('../../lib/api', () => ({ apiFetch: vi.fn(async () => ({ ok: false })) }))
vi.mock('../../stores/today', () => ({
  useTodaySummary: () => ({ data: { total: 24, lanes: [] }, failed: false }),
  refreshToday: vi.fn(),
}))
globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })

const credits = await import('../../stores/credits')
const { RunOutSheet } = await import('./RunOutSheet')

const settle = (ms = 60) => new Promise(r => setTimeout(r, ms))

function Where() {
  const { pathname } = useLocation()
  return <span id="where">{pathname}</span>
}

describe('RunOutSheet', () => {
  it('rises on a refusal, prints the figures, and leaves for the station', async () => {
    credits.seedCredits({ balance: 3, cap: 50, dailyRefill: 30, refillAt: null, plan: 'free', unlimited: false, enforced: true })
    await render(
      <LangProvider>
        <MemoryRouter initialEntries={['/learn/kana']}>
          <Routes>
            <Route path="*" element={<Where />} />
          </Routes>
          <RunOutSheet />
        </MemoryRouter>
      </LangProvider>
    )
    expect(document.querySelector('.sheet')).toBeNull()

    credits.markRunOut({ balance: 0, refillAt: null, cleared: 12 })
    await settle()
    const sheet = document.querySelector('.sheet')
    expect(sheet).toBeTruthy()
    const fig = sheet.querySelector('.balance__fig')
    expect(fig.classList.contains('balance__fig--out')).toBe(true)
    expect(fig.textContent.startsWith('0')).toBe(true)
    expect(sheet.querySelector('.balance__of').textContent).toContain('12')
    expect(credits.peekBalance()).toBe(0)

    sheet.querySelector('.btn-depart').click()
    await settle()
    expect(document.querySelector('.sheet')).toBeNull()
    expect(document.getElementById('where').textContent).toBe('/today')
    expect(credits.peekRunOut()).toBe(null)
  })
})
