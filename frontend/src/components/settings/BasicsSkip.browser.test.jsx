import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { MemoryRouter } from 'react-router-dom'
import { LangProvider } from '../../LangContext'
import '../../index.css'

// ── 基礎 — skipping the basics from Settings › Level (plan 186f) ───
// Drawn only while the course is ridden; it asks once on the slip
// before it writes, then says how many cards it marked known and
// refreshes the gate.

const apiJson = vi.hoisted(() => vi.fn(async () => ({ markedKnown: 287, basics: { done: true, of: 14 } })))
const refreshToday = vi.hoisted(() => vi.fn())
const todayRef = vi.hoisted(() => ({ current: null }))
vi.mock('../../lib/api', async o => ({ ...(await o()), apiJson: (...a) => apiJson(...a) }))
vi.mock('../../lib/audio', async o => ({ ...(await o()), playUi: vi.fn(), playClick: vi.fn() }))
vi.mock('../../stores/today', () => ({
  useTodaySummary: () => ({ data: todayRef.current, failed: false }),
  refreshToday: (...a) => refreshToday(...a),
}))
vi.mock('../../stores/profileSummary', async o => ({
  ...(await o()),
  useProfileSummaryState: () => ({ summary: { jlptLevel: 'N5', lines: null }, failed: false }),
  refreshSummary: vi.fn(async () => {}),
}))
globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })

const { LevelPage } = await import('./LevelPage')

const settle = (ms = 60) => new Promise(r => setTimeout(r, ms))
const AT_UNIT_3 = { done: false, unit: 3, of: 14, id: 'kazu', jp: '数', title: { en: 'Numbers', fr: 'Les nombres' } }

function mount() {
  return render(
    <LangProvider>
      <MemoryRouter>
        <LevelPage session={{ access_token: 't' }} />
      </MemoryRouter>
    </LangProvider>
  )
}

beforeEach(() => {
  apiJson.mockClear()
  refreshToday.mockClear()
})

describe('Settings › Level — the basics', () => {
  it('is not drawn above N5, nor once the course is met', async () => {
    todayRef.current = { total: 3, basics: null }
    let screen = await mount()
    expect(screen.container.querySelector('[data-action="basics-skip"]')).toBeNull()
    expect(screen.container.textContent).not.toMatch(/Passer les bases/)
    todayRef.current = { total: 3, basics: { done: true, of: 14 } }
    screen = await mount()
    expect(screen.container.textContent).not.toMatch(/Passer les bases/)
  })

  it('asks before it writes, then says what it marked', async () => {
    todayRef.current = { total: 3, basics: AT_UNIT_3 }
    const screen = await mount()
    const open = [...screen.container.querySelectorAll('button')].find(b => /Passer les bases/.test(b.textContent))
    expect(open).toBeTruthy()
    open.click()
    await settle()
    expect(apiJson).not.toHaveBeenCalled()
    screen.container.querySelector('[data-action="basics-skip"]').click()
    await settle()
    expect(apiJson).toHaveBeenCalledWith('/api/today/basics/skip', { access_token: 't' }, { method: 'POST' })
    expect(refreshToday).toHaveBeenCalled()
    expect(screen.container.querySelector('[role="status"]').textContent).toContain('287')
  })
})
