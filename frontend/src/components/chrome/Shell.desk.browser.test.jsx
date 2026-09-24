import { describe, it, expect, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { useState } from 'react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { LangProvider } from '../../LangContext'
import '../../index.css'

// ── 机 — a window dragged across 1100px keeps its screen (plan 113) ──
// The Shell swaps the phone's chrome for the desk's slot by slot: the
// HUD's place holds the rail, the tab bar's holds nothing, and the
// screen's container stays the same element at the same index. So a
// learner who narrows a window mid-sentence gets the phone's chrome and
// keeps the half-typed sentence — and widens it back without losing it.
// A real resize cannot be driven here (a CDP metrics change does not
// fire matchMedia's `change`), so the desk's answer is a store this
// test flips, standing in for hooks/useDesk.

const flag = vi.hoisted(() => {
  const listeners = new Set()
  let value = false
  return {
    get: () => value,
    set(next) { value = next; listeners.forEach(l => l()) },
    subscribe(l) { listeners.add(l); return () => listeners.delete(l) },
  }
})
vi.mock('../../hooks/useDesk', async () => {
  const { useSyncExternalStore } = await import('react')
  return {
    DESK_QUERY: '(min-width: 1100px)',
    useDesk: () => useSyncExternalStore(flag.subscribe, flag.get),
    isDesk: () => flag.get(),
  }
})
vi.mock('../../lib/api', () => ({
  api: p => p,
  apiFetch: vi.fn(async () => ({ ok: false, status: 500, json: async () => ({}) })),
  apiJson: vi.fn(async () => ({})),
  apiJsonWithTimeout: vi.fn(),
  apiUpload: vi.fn(),
  ApiError: class ApiError extends Error {},
}))
vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: async () => ({ data: { session: { access_token: 'tok' } } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    },
  },
}))
vi.mock('../../stores/today', () => ({
  useTodaySummary: () => ({ data: { total: 3, by_source: {}, lanes: [], next_due: null }, failed: false }),
  refreshToday: vi.fn(),
  seedTodaySummary: vi.fn(),
}))
globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })

const { Shell } = await import('./Shell')

const tick = () => new Promise(r => setTimeout(r, 30))

// A screen with state of its own: a counter only its own mount knows,
// and a field the learner is typing in.
function Probe() {
  const [n, setN] = useState(0)
  return (
    <main id="main-content">
      <button type="button" className="probe-count" onClick={() => setN(v => v + 1)}>{n}</button>
      <input className="probe-field" defaultValue="" aria-label="probe" />
    </main>
  )
}

describe('the shell across the desk line', () => {
  it('swaps the chrome and keeps the screen', async () => {
    flag.set(false)
    await render(
      <LangProvider>
        <MemoryRouter initialEntries={['/learn']}>
          <Routes>
            <Route element={<Shell />}>
              <Route path="/learn" element={<Probe />} />
            </Route>
          </Routes>
        </MemoryRouter>
      </LangProvider>
    )
    const screen = document.querySelector('main')
    const content = document.querySelector('.phone__content')
    document.querySelector('.probe-count').click()
    document.querySelector('.probe-count').click()
    document.querySelector('.probe-field').value = 'たべ'
    await tick()

    expect(document.querySelector('.hud')).not.toBeNull()
    expect(document.querySelector('.tabbar')).not.toBeNull()
    expect(document.querySelector('.desk-rail')).toBeNull()

    flag.set(true)
    await tick()
    expect(document.querySelector('.desk-rail')).not.toBeNull()
    expect(document.querySelector('.hud')).toBeNull()
    expect(document.querySelector('.tabbar')).toBeNull()
    expect(document.querySelector('.phone').classList.contains('phone--desk')).toBe(true)
    // The same nodes, so the same state.
    expect(document.querySelector('.phone__content')).toBe(content)
    expect(document.querySelector('main')).toBe(screen)
    expect(document.querySelector('.probe-count').textContent).toBe('2')
    expect(document.querySelector('.probe-field').value).toBe('たべ')

    flag.set(false)
    await tick()
    expect(document.querySelector('.desk-rail')).toBeNull()
    expect(document.querySelector('.hud')).not.toBeNull()
    expect(document.querySelector('.tabbar')).not.toBeNull()
    expect(document.querySelector('.phone').className).toBe('phone')
    expect(document.querySelector('main')).toBe(screen)
    expect(document.querySelector('.probe-count').textContent).toBe('2')
    expect(document.querySelector('.probe-field').value).toBe('たべ')
  })
})
