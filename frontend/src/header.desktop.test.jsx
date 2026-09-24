import { describe, it, expect, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom'
import { LangProvider } from './LangContext'
import './index.css'

// ── 机 — the desk's header and its one key (plan 114) ────────────
// A phone screen's ‹ way out is a pill in its bar's corner, because a
// phone has no other way up. The desk has the rail, which already opens
// every gate and the lit gate's stations: a way out to one of those is
// not drawn, and any other becomes a crumb over the title. And "/" is
// the dictionary's search from anywhere the rail is. The phone's side
// is deskfree.phone.

vi.mock('./lib/api', () => ({
  api: p => p,
  apiFetch: vi.fn(async () => ({ ok: false, status: 500, json: async () => ({}) })),
  apiJson: vi.fn(async () => ({})),
  apiJsonWithTimeout: vi.fn(),
  apiUpload: vi.fn(),
  ApiError: class extends Error {},
}))
vi.mock('./stores/profileSummary', async o => ({ ...(await o()),
  useProfileSummary: () => ({ level: 12, xp: 1200, xpPrevLevel: 1000, xpForNext: 1500, username: 'Aiko', streak: 3 }),
  useProfileSummaryState: () => ({ summary: null, failed: false }),
}))
vi.mock('./stores/journey', () => ({
  useJourneyStatus: () => ({ data: null, failed: false }),
  refreshJourney: vi.fn(), seedJourneyStatus: vi.fn(), openStatus: vi.fn(),
}))
vi.mock('./stores/today', () => ({
  useTodaySummary: () => ({ data: { total: 0, by_source: {}, lanes: [], next_due: null }, failed: false }),
  refreshToday: vi.fn(), seedTodaySummary: vi.fn(),
}))
vi.mock('./lib/audio', async o => ({ ...(await o()), playClick: vi.fn() }))
globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })

const { Bar, Leave } = await import('./components/chrome/Bar')
const { DeskRail } = await import('./components/chrome/DeskRail')

const settle = (ms = 60) => new Promise(r => setTimeout(r, ms))
const $ = s => document.querySelector(s)
const where = { path: null, state: null }
function Probe() {
  const loc = useLocation()
  where.path = loc.pathname
  where.state = loc.state
  return null
}

function mountBar(aside, path = '/learn/kanji/tier/1') {
  return render(
    <LangProvider>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="*" element={<><Bar code="KJ" title="Kanji" sub="1–200" aside={aside} /><Probe /></>} />
        </Routes>
      </MemoryRouter>
    </LangProvider>
  )
}

describe('the way up', () => {
  it('draws no second door to a place the rail opens', async () => {
    for (const to of ['/learn', '/profile', '/learn/vocab', '/profile/stats', '/dictionary/analyzer']) {
      const screen = await mountBar(<Leave to={to}>Back</Leave>)
      await settle()
      expect($('.stage__leave')).toBeNull()
      expect($('.bar__aside')).toBeNull()
      expect($('.desk-crumb')).toBeNull()
      await screen.unmount()
    }
  })

  it('turns any other way out into a crumb over the title', async () => {
    await mountBar(<Leave to="/learn/kanji/tiers">Paliers</Leave>)
    await settle()
    const crumb = $('.bar > nav.desk-crumb')
    expect(crumb).not.toBeNull()
    expect($('.bar').firstElementChild).toBe(crumb)
    expect(crumb.getAttribute('aria-label')).toBeTruthy()
    // A place, so a link (plan 123): it opens in a new tab too.
    const up = crumb.querySelector('a.desk-crumb__up')
    expect(up.textContent).toBe('Paliers')
    expect(up.getAttribute('href')).toBe('/learn/kanji/tiers')
    expect($('.bar__aside')).toBeNull()
    // Above the title, not beside it, and no pill.
    expect(up.getBoundingClientRect().bottom).toBeLessThanOrEqual($('.bar__title').getBoundingClientRect().top + 1)
    expect(getComputedStyle(up).borderTopWidth).toBe('0px')
    // The caption back under the title once the corner is free.
    expect($('.bar__names--stacked')).toBeNull()

    up.click()
    await settle()
    expect(where.path).toBe('/learn/kanji/tiers')
  })

  it('keeps a way out that is a state, as a crumb', async () => {
    const onClick = vi.fn()
    await mountBar(<Leave onClick={onClick}>Niveaux</Leave>)
    await settle()
    $('.desk-crumb__up').click()
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('leaves an aside that is not a way out where it is', async () => {
    await mountBar(<button type="button" className="probe-new">+ New</button>)
    await settle()
    expect($('.bar__aside .probe-new')).not.toBeNull()
    expect($('.desk-crumb')).toBeNull()
  })
})

describe('the search key', () => {
  function mountRail(path) {
    return render(
      <LangProvider>
        <MemoryRouter initialEntries={[path]}>
          <DeskRail />
          <Routes><Route path="*" element={<><Probe /><input className="probe-field" aria-label="field" /></>} /></Routes>
        </MemoryRouter>
      </LangProvider>
    )
  }
  const slash = target => (target ?? window).dispatchEvent(new KeyboardEvent('keydown', { key: '/', bubbles: true, cancelable: true }))

  it('prints "/" on the Dictionary gate', async () => {
    await mountRail('/learn')
    await settle()
    const gate = $('[data-tab="dictionary"]')
    expect(gate.getAttribute('aria-keyshortcuts')).toBe('/')
    expect(gate.querySelector('.desk-kbd').textContent).toBe('/')
  })

  it('opens the dictionary with its field asked for, from anywhere the rail is', async () => {
    await mountRail('/learn/vocab/N5')
    await settle()
    slash()
    await settle()
    expect(where.path).toBe('/dictionary')
    expect(where.state).toEqual({ focusSearch: true })
  })

  it('types a slash in a field, and does nothing under a dialog', async () => {
    await mountRail('/learn')
    await settle()
    slash($('.probe-field'))
    await settle()
    expect(where.path).toBe('/learn')

    const dialog = document.createElement('div')
    dialog.setAttribute('aria-modal', 'true')
    document.body.append(dialog)
    slash()
    await settle()
    expect(where.path).toBe('/learn')
    dialog.remove()
  })
})
