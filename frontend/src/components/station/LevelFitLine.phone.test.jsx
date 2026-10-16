import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { LangProvider } from '../../LangContext'
import '../../index.css'

// ── 乗り越し — Today's level-fit line (plan 224, the owner's D) ──
// One quiet row over the run's own when the answers say the level does
// not fit: its figures, a tap to the confirm sheet Settings opens, Stay
// keeping it out of the way on this device until the answers point
// somewhere else. Nothing at all when they say nothing.

const apiJson = vi.hoisted(() => vi.fn())
vi.mock('../../lib/api', () => ({
  api: p => p,
  apiJson: (...a) => apiJson(...a),
  apiFetch: vi.fn(),
  apiJsonWithTimeout: vi.fn(),
  ApiError: class ApiError extends Error {},
}))
const refreshToday = vi.hoisted(() => vi.fn())
vi.mock('../../stores/today', () => ({ refreshToday: () => refreshToday(), useTodaySummary: () => ({ data: null }) }))
vi.mock('../../stores/profileSummary', async o => ({ ...(await o()), refreshSummary: vi.fn(async () => {}) }))
vi.mock('../../stores/journey', async o => ({ ...(await o()), refreshJourney: vi.fn(async () => {}) }))
vi.mock('../../lib/audio', async o => ({ ...(await o()), playClick: vi.fn(), playUi: vi.fn() }))

const { default: LevelFitLine } = await import('./LevelFitLine')
const { forgetCachedJson } = await import('../../lib/cachedJson')

const settle = (ms = 60) => new Promise(r => setTimeout(r, ms))
const $ = sel => document.querySelector(sel)

const DOWN = {
  level: 'N3', suggest: 'down', to: 'N4',
  checks: [{ level: 'N5', passed: 12, answered: 12 }, { level: 'N4', passed: 3, answered: 14 }],
  words: { known: 0, met: 0 },
}
const PREVIEW = { direction: 'down', setAside: 0, returned: 883, deleted: 0 }

function answer(fit) {
  apiJson.mockImplementation(async (path, _s, opts) => {
    if (path === '/api/profile/level-fit') return fit
    if (path.startsWith('/api/profile/learning/preview')) return PREVIEW
    if (path === '/api/profile/learning' && opts?.method === 'PATCH') return {}
    throw new Error(`unexpected ${path}`)
  })
}

async function mount() {
  const screen = await render(<LangProvider><LevelFitLine session={{ access_token: 'tok' }} /></LangProvider>)
  await settle()
  return screen
}

beforeEach(() => {
  apiJson.mockReset()
  refreshToday.mockReset()
  forgetCachedJson()
  localStorage.removeItem('jp-level-fit-stay')
})

describe('the level-fit line', () => {
  it('says nothing when the answers say nothing', async () => {
    answer({ level: 'N3', suggest: null, to: null, checks: [], words: { known: 0, met: 0 } })
    await mount()
    expect($('[data-action="level-fit"]')).toBeNull()
  })

  it('names the stop behind the level the checks say is not known, and its figures', async () => {
    answer(DOWN)
    await mount()
    const line = $('[data-action="level-fit"]')
    expect(line.classList.contains('tdy-fit--down')).toBe(true)
    // French by default in this lane: the stop, its checks, the way on.
    expect(line.textContent).toContain('N4')
    expect(line.textContent).toContain('3')
    expect(line.textContent).toContain('14')
    expect(line.querySelector('.tdy-door__go').textContent).toContain('N4')
  })

  it('opens the confirm sheet, and moving PATCHes the level and refreshes the day', async () => {
    answer(DOWN)
    await mount()
    $('[data-action="level-fit"]').click()
    await settle()
    const sheet = $('[role="dialog"].lvl-sheet')
    expect(sheet.textContent).toMatch(/883/)
    sheet.querySelector('[data-action="level-confirm"]').click()
    await settle(120)
    const patch = apiJson.mock.calls.find(c => c[0] === '/api/profile/learning')
    expect(JSON.parse(patch[2].body)).toEqual({ jlptLevel: 'N4' })
    expect(refreshToday).toHaveBeenCalledTimes(1)
    expect($('[data-action="level-fit"]')).toBeNull()
  })

  it('Stay keeps it away on this device until the answers point elsewhere', async () => {
    answer(DOWN)
    const screen = await mount()
    $('[data-action="level-fit"]').click()
    await settle()
    $('[role="dialog"].lvl-sheet .btn-secondary').click()
    await settle(120)
    expect($('[data-action="level-fit"]')).toBeNull()
    expect(apiJson.mock.calls.some(c => c[0] === '/api/profile/learning')).toBe(false)
    expect(localStorage.getItem('jp-level-fit-stay')).toBe('N3>N4')
    await screen.unmount()

    // The same suggestion stays away; another one is said.
    forgetCachedJson()
    await mount()
    expect($('[data-action="level-fit"]')).toBeNull()
    forgetCachedJson()
    answer({ ...DOWN, to: 'N5', checks: [{ level: 'N5', passed: 2, answered: 12 }] })
    await mount()
    expect($('[data-action="level-fit"]')).not.toBeNull()
  })

  it('points up when the level\'s new words are known the first time they are asked', async () => {
    answer({ level: 'N5', suggest: 'up', to: 'N4', checks: [], words: { known: 29, met: 30 } })
    await mount()
    const line = $('[data-action="level-fit"]')
    expect(line.classList.contains('tdy-fit--up')).toBe(true)
    expect(line.textContent).toContain('29')
    expect(line.querySelector('.tdy-door__go').textContent).toContain('N4')
  })
})
