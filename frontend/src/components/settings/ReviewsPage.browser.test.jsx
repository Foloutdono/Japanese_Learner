import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, cleanup } from 'vitest-browser-react'
import { userEvent } from 'vitest/browser'
import { MemoryRouter } from 'react-router-dom'
import { LangProvider } from '../../LangContext'
import fr from '../../locales/fr/index.js'
import '../../index.css'

// ── Settings › Reviews (plan 217) ────────────────────────────────
// The ceiling on the day's reviews, the catch-up under way and an
// absence declared ahead. These pin what each slip sends, that the page
// redraws from what the server answers, that a ceiling under the
// learner's own load says the backlog will grow, and that an absence
// the server would refuse is never sent.

const apiJson = vi.hoisted(() => vi.fn())
vi.mock('../../lib/api', () => ({ apiFetch: vi.fn(async () => ({ ok: false })), apiJson: (...a) => apiJson(...a) }))
const refreshToday = vi.hoisted(() => vi.fn())
vi.mock('../../stores/today', () => ({ refreshToday: (...a) => refreshToday(...a), useTodaySummary: () => ({ data: null }) }))
globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })

const { ReviewsPage, awayProblem } = await import('./ReviewsPage')

const settle = (ms = 60) => new Promise(r => setTimeout(r, ms))
const $ = sel => document.querySelector(sel)
const $$ = sel => [...document.querySelectorAll(sel)]

const PLAN = {
  reviewCap: null, capChoices: [50, 100, 150], load: 70,
  catchup: null, away: null, awayMaxDays: 30,
}

async function mount() {
  await render(
    <LangProvider>
      <MemoryRouter><ReviewsPage session={{ access_token: 'tok' }} /></MemoryRouter>
    </LangProvider>,
  )
  await settle()
}

function answer(plan) {
  apiJson.mockImplementation(async () => plan)
}

describe('Settings › Reviews', () => {
  beforeEach(() => {
    localStorage.setItem('lang', 'fr')
    apiJson.mockReset()
    refreshToday.mockReset()
    answer(PLAN)
  })
  afterEach(() => cleanup())

  it('sets a ceiling, redraws from the answer and warns when it sits under the load', async () => {
    await mount()
    const opts = $$('.seg__opt')
    expect(opts.map(o => o.textContent)).toEqual([fr.rvCapNone, '50', '100', '150'])
    expect(opts[0].getAttribute('aria-checked')).toBe('true')
    expect(document.body.textContent).not.toContain(fr.rvCapUnder(70))

    answer({ ...PLAN, reviewCap: 50 })
    await userEvent.click(opts[1])
    await settle()
    expect(apiJson).toHaveBeenLastCalledWith('/api/review-plan/cap', expect.anything(),
      expect.objectContaining({ method: 'PUT', body: JSON.stringify({ reviewCap: 50 }) }))
    expect($$('.seg__opt')[1].getAttribute('aria-checked')).toBe('true')
    expect(document.body.textContent).toContain(fr.rvCapUnder(70))
    expect(refreshToday).toHaveBeenCalled()

    answer(PLAN)
    await userEvent.click($$('.seg__opt')[0])
    await settle()
    expect(apiJson).toHaveBeenLastCalledWith('/api/review-plan/cap', expect.anything(),
      expect.objectContaining({ body: JSON.stringify({ reviewCap: null }) }))
  })

  it('shows the catch-up under way and stops it', async () => {
    answer({ ...PLAN, catchup: { per_day: 23, day: 2, of: 5 } })
    await mount()
    expect(document.body.textContent).toContain(fr.rvCatchupSpread(23, 2, 5))
    answer(PLAN)
    await userEvent.click($('[data-action="catchup-stop"]'))
    await settle()
    expect(apiJson).toHaveBeenLastCalledWith('/api/review-plan/catchup', expect.anything(),
      expect.objectContaining({ method: 'DELETE' }))
    expect($('[data-action="catchup-stop"]')).toBeNull()
  })

  it('declares an absence, and cancels it', async () => {
    await mount()
    expect($('[data-action="away-save"]').disabled).toBe(false)
    const [from, until] = $$('input[type="date"]')
    answer({ ...PLAN, away: { from: from.value, until: until.value } })
    await userEvent.click($('[data-action="away-save"]'))
    await settle()
    expect(apiJson).toHaveBeenLastCalledWith('/api/review-plan/away', expect.anything(),
      expect.objectContaining({ method: 'PUT', body: JSON.stringify({ start: from.value, until: until.value }) }))
    expect($('input[type="date"]')).toBeNull()

    answer(PLAN)
    await userEvent.click($('[data-action="away-cancel"]'))
    await settle()
    expect(apiJson).toHaveBeenLastCalledWith('/api/review-plan/away', expect.anything(),
      expect.objectContaining({ method: 'DELETE' }))
    expect($$('input[type="date"]').length).toBe(2)
  })

  it('never sends an absence the server would refuse', async () => {
    await mount()
    const [, until] = $$('input[type="date"]')
    await userEvent.fill(until, '2020-01-01')
    await settle()
    expect($('[data-action="away-save"]').disabled).toBe(true)
    expect(document.body.textContent).toContain(fr.rvAwayErr.order)
  })
})

describe('awayProblem', () => {
  it('names what is wrong with an absence, or nothing', () => {
    const today = '2026-10-16'
    expect(awayProblem('2026-10-17', '2026-10-20', 30, today)).toBeNull()
    expect(awayProblem('2026-10-16', '2026-10-16', 30, today)).toBeNull()
    expect(awayProblem('2026-10-15', '2026-10-20', 30, today)).toBe('past')
    expect(awayProblem('2026-10-20', '2026-10-17', 30, today)).toBe('order')
    expect(awayProblem('2026-10-17', '2026-11-16', 30, today)).toBe('long')
    expect(awayProblem('2026-10-17', '2026-11-15', 30, today)).toBeNull()
    expect(awayProblem('', '2026-10-20', 30, today)).toBe('missing')
  })
})
