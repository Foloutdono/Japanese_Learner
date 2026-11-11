import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { LangProvider } from '../LangContext'

// A theme run studies the band the learner picked: its cards are asked
// for at that level, as its progress bar is, or 上級 served the whole
// theme easiest first while the bar counted the band alone.

vi.mock('../lib/audio', async o => ({
  ...(await o()),
  playUi: vi.fn(), playClick: vi.fn(), speakJapanese: vi.fn(),
}))
const apiJson = vi.hoisted(() => vi.fn())
const apiFetch = vi.hoisted(() => vi.fn())
vi.mock('../lib/api', () => ({
  api: p => p,
  apiFetch,
  apiJson,
  apiJsonWithTimeout: vi.fn(async () => ({})),
  apiUpload: vi.fn(),
  ApiError: class extends Error {},
}))
globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })

const { default: VocabRun } = await import('./VocabRun')

beforeEach(() => {
  localStorage.clear()
  apiJson.mockReset()
  apiJson.mockResolvedValue({ cards: [] })
  apiFetch.mockReset()
  apiFetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })
})

const settle = (ms = 200) => new Promise(r => setTimeout(r, ms))
const urls = mock => mock.mock.calls.map(([u]) => String(u))

describe('a theme run', () => {
  it('asks for its cards at the level it was opened on, as its progress does', async () => {
    await render(
      <LangProvider>
        <MemoryRouter initialEntries={['/learn/vocab/theme/animaux/level/advanced/vocab.flashcard.f2b']}>
          <Routes>
            <Route path="/learn/vocab/theme/:theme/level/:themeLevel/:mode" element={<VocabRun session={{ access_token: 't' }} />} />
          </Routes>
        </MemoryRouter>
      </LangProvider>,
    )
    await settle()
    const cards = urls(apiJson).filter(u => u.startsWith('/api/vocab/theme/animaux/cards?'))
    expect(cards.length).toBeGreaterThan(0)
    expect(cards.every(u => new URLSearchParams(u.split('?')[1]).get('level') === 'advanced')).toBe(true)
    const stats = urls(apiFetch).filter(u => u.startsWith('/api/vocab/theme/animaux/stats?'))
    expect(stats.every(u => u.includes('level=advanced'))).toBe(true)
  })
})
