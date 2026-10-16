import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom'
import { LangProvider } from '../LangContext'

// ── 会話 — the conversation station (plan 217) ────────────────────
// A scenario is chosen by how the learner will answer and at which
// grade. Pinned: the station opens on the learner's own grade and on
// Choose; both choices ride the address, replaced; a scene is a
// platform card with its opening line as its specimen and the
// learner's record at its end; a card boards the scene ridden the way
// the band says. French copy: the lane's.

const apiJson = vi.fn()
vi.mock('../lib/api', () => ({
  api: p => p,
  apiFetch: vi.fn(),
  apiJson: (...a) => apiJson(...a),
  apiJsonWithTimeout: vi.fn(),
  apiUpload: vi.fn(),
  ApiError: class ApiError extends Error {},
}))
vi.mock('../lib/audio', async importOriginal => ({
  ...(await importOriginal()),
  playUi: () => {},
  startAmbiance: () => {},
  stopAmbiance: () => {},
}))
vi.mock('../stores/boarding', () => ({ board: commit => commit() }))
vi.mock('../stores/profileSummary', async o => ({ ...(await o()), useProfileSummary: () => ({ jlptLevel: 'N4' }) }))

const { default: ConversationStation } = await import('./ConversationStation')

const scene = (id, level, title) => ({
  id, level, title, situation: `Situation de ${title}.`, goal: 'Un but.', them: 'Vendeur', register: 'polite',
  place: { jp: '駅', parts: [{ text: '駅', reading: 'えき' }], name: 'Gare' },
  opener: `${title}の最初の一言です。`, turns: 5,
})
const CATALOGUE = {
  scenarios: [
    scene('konbini-lunch', 'N5', 'Le déjeuner'),
    scene('hotel-checkin', 'N4', 'À l’hôtel'),
    scene('clinic-reception', 'N4', 'À la clinique'),
  ],
  record: { 'hotel-checkin': { done: 5, right: 4, last: '2026-10-15T08:00:00+00:00' } },
}

const settle = (ms = 60) => new Promise(r => setTimeout(r, ms))
const here = { path: null }
function Probe() {
  const loc = useLocation()
  here.path = loc.pathname + loc.search
  return null
}

async function station(entry = '/practice/conversation') {
  const screen = await render(
    <LangProvider>
      <MemoryRouter initialEntries={[entry]}>
        <Routes>
          <Route path="/practice/conversation" element={<ConversationStation session={null} />} />
          <Route path="/practice/conversation/:scenario/:mode" element={<p className="run">run</p>} />
        </Routes>
        <Probe />
      </MemoryRouter>
    </LangProvider>
  )
  await settle(160)
  return screen.container
}

const titles = root => [...root.querySelectorAll('.platform-card__title')].map(el => el.textContent)

beforeEach(() => {
  apiJson.mockReset()
  apiJson.mockImplementation(async () => JSON.parse(JSON.stringify(CATALOGUE)))
})

describe('the conversation station', () => {
  it('opens on the learner\'s own grade and on Choose', async () => {
    const root = await station()
    expect(String(apiJson.mock.calls[0][0])).toBe('/api/conversation/scenarios?lang=fr')
    expect(titles(root)).toEqual(['À l’hôtel', 'À la clinique'])
    const on = root.querySelector('.console__band-opt--on')
    expect(on.textContent).toBe('Choisir')
    expect(root.querySelector('.chip--on').textContent).toBe('N4')
    // Nothing between the console and the scenes (the run's brief says how).
    expect(root.querySelector('.kaiwa-how')).toBeNull()
  })

  it('draws a scene as a platform card: its situation, its first line, its record', async () => {
    const root = await station()
    const card = root.querySelector('.platform-card')
    expect(card.querySelector('.platform-card__desc').textContent).toBe('Situation de À l’hôtel.')
    expect(card.querySelector('.platform-card__sample').textContent).toBe('À l’hôtelの最初の一言です。')
    expect(card.querySelector('.kaiwa-record').textContent).toContain('4/5')
    expect(card.querySelector('.kaiwa-record .sr-only').textContent).toBe('4 répliques justes sur 5')
    // A scene never ridden says nothing at its end.
    expect(root.querySelectorAll('.platform-card')[1].querySelector('.kaiwa-record')).toBeNull()
  })

  it('carries both choices in the address, and boards the scene the band\'s way', async () => {
    const root = await station()
    ;[...root.querySelectorAll('.console__chips .chip')].find(c => c.textContent === 'N5').click()
    await settle(60)
    expect(here.path).toBe('/practice/conversation?level=N5')
    expect(titles(root)).toEqual(['Le déjeuner'])
    ;[...root.querySelectorAll('.console__band-opt')].find(b => b.textContent === 'Libre').click()
    await settle(60)
    expect(here.path).toBe('/practice/conversation?level=N5&mode=free')
    root.querySelector('.platform-card').click()
    await vi.waitFor(() => expect(here.path).toBe('/practice/conversation/konbini-lunch/free'))
  })

  it('opens on the grade and the way the address names', async () => {
    const root = await station('/practice/conversation?level=N5&mode=translate')
    expect(titles(root)).toEqual(['Le déjeuner'])
    expect(root.querySelector('.console__band-opt--on').textContent).toBe('Traduire')
  })

  it('owns up to a list that did not come, and tries again', async () => {
    apiJson.mockImplementationOnce(async () => { throw new Error('down') })
    const root = await station()
    expect(root.querySelector('.empty--error')).not.toBeNull()
    root.querySelector('.empty__action').click()
    await settle(160)
    expect(titles(root)).toEqual(['À l’hôtel', 'À la clinique'])
  })
})
