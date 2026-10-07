import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { LangProvider } from './LangContext'
import './index.css'

// ── 終着 — the day's run, finished, on a phone (plan 191) ─────────────
// /today/clear takes the run's tally from the router's state, asks the
// server once whether the day is cleared and plays the answer: the
// app's three dots while it asks, then the everyday clear (ClearPhone)
// or, with cards left, the partial finish. A finish with no run, or
// one already shown before a reload (which keeps the router's state),
// goes back to the gate.

const api = vi.hoisted(() => ({ next: null }))
vi.mock('./lib/api', () => ({
  api: p => p,
  apiFetch: vi.fn(async () => ({ ok: true, status: 200, json: async () => ({}) })),
  apiJson: vi.fn(path => (path === '/api/today/clear' ? api.next : Promise.resolve({}))),
  apiJsonWithTimeout: vi.fn(async () => ({})),
  apiUpload: vi.fn(),
  ApiError: class extends Error {},
}))
vi.mock('./lib/audio', async o => ({ ...(await o()), playDayClear: vi.fn(), playMilestone: vi.fn(), playArrival: vi.fn(), playClick: vi.fn() }))
vi.mock('./stores/today', () => ({
  useTodaySummary: () => ({ data: null, failed: false }),
  refreshToday: vi.fn(), seedTodaySummary: vi.fn(),
}))
vi.mock('./stores/profileSummary', async o => ({ ...(await o()),
  useProfileSummary: () => ({ level: 14, jlptLevel: 'N5', streak: 5, week: [] }),
  applyXpGain: vi.fn(() => ({ leveledUp: false, newLevel: 14 })),
}))

const { default: DayClearScreen } = await import('./screens/DayClearScreen')
const { resetDayClear } = await import('./stores/dayClear')
const { RUN_DAY, CLEAR_DAY, RUN_PARTIAL, CLEAR_PARTIAL } = await import('./components/dayclear/fixtures')

const settle = (ms = 60) => new Promise(r => setTimeout(r, ms))

function deferred() {
  let resolve
  const promise = new Promise(r => { resolve = r })
  return { promise, resolve }
}

function mount(state) {
  return render(
    <LangProvider>
      <MemoryRouter initialEntries={[{ pathname: '/today/clear', state }]}>
        <Routes>
          <Route path="/today/clear" element={<DayClearScreen session={{ access_token: 't' }} />} />
          <Route path="/today" element={<main className="gate-stub">gate</main>} />
        </Routes>
      </MemoryRouter>
    </LangProvider>
  )
}

beforeEach(() => resetDayClear())

describe('/today/clear on a phone', () => {
  it('waits on the three dots, then plays the everyday clear', async () => {
    const answer = deferred()
    api.next = answer.promise
    const screen = await mount({ run: RUN_DAY })
    await settle()
    expect(screen.container.querySelector('.loading')).not.toBeNull()
    expect(screen.container.querySelector('.clr-phone')).toBeNull()

    answer.resolve(CLEAR_DAY)
    await settle(120)
    const clear = screen.container.querySelector('main.clr-phone')
    expect(clear).not.toBeNull()
    expect(screen.container.querySelector('.loading')).toBeNull()
    // The ceremony begins on the run's deck and the count of the trip.
    expect(clear.querySelector('.clr-phone__of').textContent).toBe('/ 32')
    // A tap skips to the rest: the title, the week, the fare, the piles.
    clear.click()
    await settle()
    expect(clear.querySelector('.clrk-hdr__title').textContent).toBe('Service terminé')
    expect(clear.querySelectorAll('.clrk-week > .clrk-slot')).toHaveLength(7)
    expect(clear.querySelector('.clrk-xp').textContent.replace(/\s/g, '')).toContain('+252')
    expect([...clear.querySelectorAll('.clr-phone__pile-n')].map(b => b.textContent)).toEqual(['6', '18', '8'])
    expect(clear.querySelector('.btn-depart--gate').textContent).toContain('Retour à la gare')
  })

  it('plays the partial finish when cards remain today', async () => {
    api.next = Promise.resolve(CLEAR_PARTIAL)
    const screen = await mount({ run: RUN_PARTIAL })
    await settle(120)
    const partial = screen.container.querySelector('main.ptl')
    expect(partial).not.toBeNull()
    expect(screen.container.querySelector('.clr-phone')).toBeNull()
    expect(partial.querySelector('.clrk-hdr__title').textContent).toBe('Trajet terminé')
    expect(partial.querySelector('.btn-depart--gate').textContent).toContain('Continuer · 14 cartes')
  })

  it('goes back to the gate with no run to finish', async () => {
    api.next = Promise.resolve(CLEAR_DAY)
    const screen = await mount(null)
    await settle()
    expect(screen.container.querySelector('.gate-stub')).not.toBeNull()
  })

  it('goes back to the gate on a reload, which keeps the run but not the answer', async () => {
    // What a reload leaves: the router's state (history.state survives
    // it) and the tab's note of the run it asked for, and no answer in
    // the store -- so no second ask and no second ceremony.
    const { apiJson } = await import('./lib/api')
    apiJson.mockClear()
    window.sessionStorage.setItem('tsuji.dayClear.asked', String(RUN_DAY.at))
    api.next = Promise.resolve({ ...CLEAR_DAY, already: true })
    const screen = await mount({ run: RUN_DAY })
    await settle(120)
    expect(screen.container.querySelector('.gate-stub')).not.toBeNull()
    expect(screen.container.querySelector('.clr-phone')).toBeNull()
    expect(apiJson).not.toHaveBeenCalledWith('/api/today/clear', expect.anything(), expect.anything())
  })

  it('plays a run it has not asked about, though the tab asked about another', async () => {
    window.sessionStorage.setItem('tsuji.dayClear.asked', 'an-earlier-run')
    api.next = Promise.resolve(CLEAR_DAY)
    const screen = await mount({ run: RUN_DAY })
    await settle(120)
    expect(screen.container.querySelector('main.clr-phone')).not.toBeNull()
  })
})
