import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { userEvent } from 'vitest/browser'
import { MemoryRouter } from 'react-router-dom'
import { LangProvider } from '../../LangContext'
import '../../index.css'

// ── 任務 — the pill, its sheet and the plates (plan 328) ──────────────
// The gate's pill counts the day's missions and opens a sheet of coupons;
// a finished one is a button, the tap collects it and the server's answer
// redraws everything. The holder's insert hangs the plates and the
// discoveries, a reached one that was not collected tappable. Nothing is
// drawn before the server has answered.

const apiJson = vi.fn(async () => ({}))
vi.mock('../../lib/api', async o => ({ ...(await o()), apiJson: (...a) => apiJson(...a) }))
vi.mock('../../lib/supabase', () => ({ supabase: { auth: { getSession: async () => ({ data: { session: null } }) } } }))
vi.mock('../../lib/audio', async o => ({ ...(await o()), playClick: vi.fn() }))
const countUse = vi.fn()
vi.mock('../../lib/screenTrail', async o => ({ ...(await o()), countUse: (...a) => countUse(...a) }))
vi.mock('../../stores/credits', async o => ({ ...(await o()), refreshCredits: vi.fn(async () => {}) }))
vi.mock('../../stores/profileSummary', async o => ({ ...(await o()), refreshSummary: vi.fn(async () => {}) }))
globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 404, json: async () => ({}) })

const { MissionsGate, MissionsInsert } = await import('./Missions')
const { MissionsNewsSheet } = await import('./MissionsNewsSheet')
const { seedMissions, seedMissionsBook, forgetMissions } = await import('../../stores/missions')
const { missionsFixture, bookFixture } = await import('./fixtures')
const { default: en } = await import('../../locales/en/index.js')

const settle = (ms = 60) => new Promise(r => setTimeout(r, ms))
const shell = ui => render(<LangProvider><MemoryRouter>{ui}</MemoryRouter></LangProvider>)

beforeEach(() => {
  localStorage.setItem('lang', 'en')
  forgetMissions()
  apiJson.mockReset()
  countUse.mockReset()
})

describe('the gate\'s pill', () => {
  it('draws nothing before the server has answered', async () => {
    const screen = await shell(<MissionsGate />)
    await settle()
    expect(screen.container.querySelector('.msn-pill')).toBeNull()
  })

  it('counts the day and names it for a screen reader', async () => {
    seedMissions(missionsFixture())
    const screen = await shell(<MissionsGate />)
    const pill = screen.container.querySelector('.msn-pill')
    expect(pill.textContent).toContain('2/3')
    expect(pill.textContent).toContain('+30')
    expect(pill.getAttribute('aria-label')).toBe(en.msnPillLabel(2))
    expect(pill.querySelector('.msn-pill__flag')).toBeNull()
  })

  it('lights a lamp on the pill when a reward waits', async () => {
    seedMissions(missionsFixture({ step: 1 }))
    const screen = await shell(<MissionsGate />)
    expect(screen.container.querySelector('.msn-pill__flag')).not.toBeNull()
  })

  it('shows the pass its sums as XP', async () => {
    seedMissions(missionsFixture({ plan: 'max' }))
    const screen = await shell(<MissionsGate />)
    expect(screen.container.querySelector('.msn-pill__sum').textContent).toBe('+50 XP')
  })

  it('opens the sheet of coupons, the day then the week, and counts the opening', async () => {
    seedMissions(missionsFixture())
    const screen = await shell(<MissionsGate />)
    await userEvent.click(screen.container.querySelector('.msn-pill'))
    await settle()
    const sheet = document.querySelector('.msn-sheet')
    expect(sheet).not.toBeNull()
    expect(sheet.querySelectorAll('.msn-cpn')).toHaveLength(3 + 1 + 3)   // the day, its bonus, the week
    expect(sheet.textContent).toContain(en.msnLabel.due())
    expect(sheet.textContent).toContain(en.msnLabel.days5())
    expect(countUse).toHaveBeenCalledWith('missions', 'open')
  })

  it('collects a finished mission with the tap, and redraws on the answer', async () => {
    seedMissions(missionsFixture({ step: 1 }))
    apiJson.mockResolvedValueOnce({ paid: { credits: 8, xp: 5, scope: 'day', kind: 'due' }, missions: missionsFixture({ step: 2 }) })
    const screen = await shell(<MissionsGate />)
    await userEvent.click(screen.container.querySelector('.msn-pill'))
    await settle()
    // The reviews are done, and with them the day's three: the coupon and
    // the bonus wait; the first one's stub is the one torn.
    expect(document.querySelectorAll('.msn-cpn--ready')).toHaveLength(2)
    await userEvent.click(document.querySelector('.msn-cpn--ready [data-action="mission-collect"]'))
    await settle()
    expect(apiJson).toHaveBeenCalledTimes(1)
    const [path, , opts] = apiJson.mock.calls[0]
    expect(path).toBe('/api/missions/claim')
    expect(JSON.parse(opts.body)).toEqual({ scope: 'day', kind: 'due' })
    expect(document.querySelectorAll('.msn-cpn--ready')).toHaveLength(1)      // the bonus is still to collect
    expect(document.querySelector('.msn-cpn--ready').textContent).toContain(en.msnLabel.all3())
    expect(document.querySelectorAll('.msn-cpn--torn')).toHaveLength(3)
  })

  it('says so when a reward could not be collected', async () => {
    seedMissions(missionsFixture({ step: 1 }))
    apiJson.mockRejectedValueOnce(new Error('boom'))
    const screen = await shell(<MissionsGate />)
    await userEvent.click(screen.container.querySelector('.msn-pill'))
    await settle()
    await userEvent.click(document.querySelector('[data-action="mission-collect"]'))
    await settle()
    expect(document.querySelector('.msn-note').textContent).toBe(en.msnClaimError)
    expect(document.querySelector('.msn-cpn--ready')).not.toBeNull()   // still there to try again
  })
})

describe('the holder\'s insert', () => {
  it('hangs the plates and the discoveries, the reached ones lit', async () => {
    seedMissionsBook(bookFixture())
    const screen = await shell(<MissionsInsert />)
    const plates = screen.container.querySelectorAll('.msn-plate')
    expect(plates).toHaveLength(10)
    expect(screen.container.querySelectorAll('.msn-plate:not(.msn-plate--off)')).toHaveLength(3)
    expect(screen.container.querySelectorAll('.msn-lattice__cell')).toHaveLength(10)
    expect(screen.container.querySelectorAll('.msn-lattice__cell.on')).toHaveLength(3)
    expect(screen.container.textContent).toContain('312')
  })

  it('collects a discovery found and not yet collected', async () => {
    seedMissionsBook(bookFixture())
    apiJson.mockResolvedValueOnce({ paid: { credits: 10, xp: 10 }, missions: missionsFixture() })
    const screen = await shell(<MissionsInsert />)
    const ready = screen.container.querySelector('.msn-lattice__cell--ready')
    expect(ready).not.toBeNull()
    await userEvent.click(ready)
    await settle()
    expect(JSON.parse(apiJson.mock.calls[0][2].body)).toEqual({ scope: 'mark', kind: 'first_friend' })
  })

  it('draws the plates in platinum for the pass', async () => {
    seedMissionsBook(bookFixture({ plan: 'max' }))
    const screen = await shell(<MissionsInsert />)
    expect(screen.container.querySelector('.msn-plate--max')).not.toBeNull()
  })
})

describe('the announcement', () => {
  it('is told once, whichever way it is shut', async () => {
    apiJson.mockResolvedValue({})
    const onClose = vi.fn()
    await shell(<MissionsNewsSheet session={null} onClose={onClose} />)
    await settle()
    await userEvent.click(document.querySelector('[data-action="missions-news-later"]'))
    await settle()
    expect(apiJson.mock.calls[0][0]).toBe('/api/onboarding/news/missions')
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(countUse).toHaveBeenCalledWith('missions_news', 'hide')
  })
})
