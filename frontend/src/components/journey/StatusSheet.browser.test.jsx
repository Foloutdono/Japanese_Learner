import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { LangProvider } from '../../LangContext'
import '../../index.css'
import { addDays } from '../../domain/goalMath'

// ── The status sheet (plan 074) ──────────────────────────────────
// The pass's back, as a sheet off the HUD's station panel: the
// panel's word, the ghost track, the four figures and the two honest
// moves — and the round IV.1 detail that a reprint re-judges the
// pass the moment the fresh facts arrive.

const apiJson = vi.fn()
const apiFetch = vi.fn()
vi.mock('../../lib/api', () => ({
  apiJson: (...a) => apiJson(...a),
  apiFetch: (...a) => apiFetch(...a),
  apiJsonWithTimeout: vi.fn(),
  apiUpload: vi.fn(),
  ApiError: class ApiError extends Error {},
}))
vi.mock('../../lib/supabase', () => ({
  supabase: { auth: { getSession: async () => ({ data: { session: { access_token: 'tok' } } }) } },
}))
vi.mock('../../lib/audio', async o => ({ ...(await o()), playClick: vi.fn() }))
globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })

const { StatusSheet } = await import('./StatusSheet')
const { openStatus, closeStatus, seedJourneyStatus, seedVolumes } = await import('../../stores/journey')
const { seedSummary } = await import('../../stores/profileSummary')

const VOLUMES = {
  vocab: { N5: 667, N4: 634, N3: 1832, N2: 1796, N1: 3476 },
  kanji: { N5: 103, N4: 166, N3: 367, N2: 367, N1: 1232 },
  grammar: { N5: 71, N4: 71, N3: 71, N2: 71, N1: 71 },
  kana: 224,
}

const NOW = new Date()
const isoDate = d => d.toISOString().slice(0, 10)
const settle = (ms = 60) => new Promise(r => setTimeout(r, ms))

// 1,000 items at 10/day, signed 56 days ago, printed date 44 days out,
// last-14-days rhythm 2/day: delayed, recovery 21, projected +444d —
// the same worked case goalMath.test.js pins numerically.
function behindStatus() {
  return {
    goalStartLevel: 'N5',
    goalLevel: 'N3',
    goalTargetDate: isoDate(addDays(NOW, 44)),
    goalSetAt: addDays(NOW, -56).toISOString(),
    dailyDeparture: null,
    plannedPerDay: 10,
    itemsTotal: 1000,
    itemsDone: 112,
    actual14: 28,
    days14: 14,
  }
}

function renderSheet() {
  return render(
    <LangProvider>
      <MemoryRouter initialEntries={['/profile']}>
        <Routes>
          <Route path="/profile" element={<div className="probe-profile" />} />
          <Route path="/profile/settings/destination" element={<div className="probe-destination" />} />
          <Route path="/today" element={<div className="probe-today" />} />
        </Routes>
        <StatusSheet session={null} />
      </MemoryRouter>
    </LangProvider>
  )
}

const dialog = () => document.querySelector('[role="dialog"].status-sheet')

beforeEach(() => {
  closeStatus()
  apiJson.mockReset()
  apiFetch.mockReset()
  seedVolumes(VOLUMES)
  seedSummary({ username: 'Tester', level: 3, xp: 10, xpPrevLevel: 0, xpForNext: 100, jlptLevel: 'N5' })
})

describe('StatusSheet', () => {
  it('stays closed until the panel opens it, then turns the pass over', async () => {
    seedJourneyStatus(behindStatus())
    await renderSheet()
    expect(dialog()).toBeNull()

    openStatus()
    await settle()
    const sheet = dialog()
    expect(sheet).not.toBeNull()
    // Sumi: the pass's own material.
    expect(sheet.classList.contains('sheet--sumi')).toBe(true)
    // The panel's word, inked for a late train, and the drift in days.
    const chip = sheet.querySelector('.hud__status')
    expect(chip.classList.contains('hud__status--delayed')).toBe(true)
    expect(chip.querySelector('.hud__status-delta').textContent).toMatch(/\d/)
    // The track carries the plan car, and the four figures are there.
    expect(sheet.querySelector('.jour-track__plan')).not.toBeNull()
    expect(sheet.querySelectorAll('.jour-fig').length).toBe(4)
    expect(sheet.querySelectorAll('.jour-fig__v')[1].textContent).toContain('10')

    closeStatus()
    await settle(30)
    expect(dialog()).toBeNull()
  })

  it('offers the two honest moves when behind, and a pace reprint adopts the recovery', async () => {
    seedJourneyStatus(behindStatus())
    apiJson.mockImplementation(async (path, _session, opts = {}) => {
      if (path === '/api/journey/reprint') return { ...behindStatus(), plannedPerDay: JSON.parse(opts.body).dailyNewTarget }
      return {}
    })
    // The refetch after the reprint brings the fresh facts.
    apiFetch.mockImplementation(async path => ({
      ok: true, status: 200,
      json: async () => (path === '/api/journey/status' ? { ...behindStatus(), plannedPerDay: 21 } : {}),
    }))
    await renderSheet()
    openStatus()
    await settle()

    const acts = dialog().querySelectorAll('.jour-act')
    expect(acts.length).toBe(2)
    expect(acts[0].textContent).toContain('21')
    acts[0].click()
    await vi.waitFor(() => {
      const call = apiJson.mock.calls.find(c => c[0] === '/api/journey/reprint')
      expect(call).toBeTruthy()
      expect(JSON.parse(call[2].body)).toEqual({ dailyNewTarget: 21 })
    })
    // The store refetched: the sheet now judges the pass on the new pace.
    await vi.waitFor(() => {
      expect(dialog().querySelectorAll('.jour-fig__v')[1].textContent).toContain('21')
    })
  })

  it('moves the date in ink and re-judges the pass on the way back', async () => {
    seedJourneyStatus(behindStatus())
    const projectedIso = isoDate(addDays(NOW, 444))
    apiJson.mockImplementation(async (path, _session, opts = {}) => {
      if (path === '/api/journey/reprint') return { ...behindStatus(), goalTargetDate: JSON.parse(opts.body).goalTargetDate }
      return {}
    })
    apiFetch.mockImplementation(async path => ({
      ok: true, status: 200,
      json: async () => (path === '/api/journey/status' ? { ...behindStatus(), goalTargetDate: projectedIso } : {}),
    }))
    await renderSheet()
    openStatus()
    await settle()

    dialog().querySelectorAll('.jour-act')[1].click()
    await vi.waitFor(() => {
      const call = apiJson.mock.calls.find(c => c[0] === '/api/journey/reprint')
      expect(call).toBeTruthy()
      expect(JSON.parse(call[2].body)).toEqual({ goalTargetDate: projectedIso })
    })
    // The printed date now IS the projected one: on time again, and
    // the moves are gone.
    await vi.waitFor(() => {
      expect(dialog().querySelector('.hud__status').classList.contains('hud__status--onTime')).toBe(true)
      expect(dialog().querySelectorAll('.jour-act').length).toBe(0)
    })
  })

  it('judges a goal-less pass on pace alone and points at the office', async () => {
    seedJourneyStatus({
      goalStartLevel: null, goalLevel: null, goalTargetDate: null,
      goalSetAt: null, dailyDeparture: null,
      plannedPerDay: 10, itemsTotal: 7013, itemsDone: 500,
      actual14: 140, days14: 14,
    })
    const screen = await renderSheet()
    openStatus()
    await settle()
    const sheet = dialog()
    expect(sheet.querySelector('.hud__status').classList.contains('hud__status--onTime')).toBe(true)
    expect(sheet.querySelector('.jour-track__plan')).toBeNull()
    expect(sheet.querySelector('.jour-act')).toBeNull()
    const office = sheet.querySelector('.status-sheet__office')
    expect(office).not.toBeNull()
    office.click()
    await settle(30)
    expect(dialog()).toBeNull()
    expect(screen.container.querySelector('.probe-destination')).not.toBeNull()
  })
})
