import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { LangProvider } from '../LangContext'
import '../index.css'

// ── The catalogue shows the latest search, whatever answers last ──
// Two searches in flight can answer out of order: a slow "田" landing
// after a fast "山" used to overwrite the newer results with the older
// ones. And a failed page left its loading line up for good. fetchPage
// numbers its page-0 requests and applies only the latest.

vi.mock('../lib/api', () => ({
  api: p => p,
  apiFetch: vi.fn(),
  apiJson: vi.fn(async () => ({ decks: [] })),
  apiJsonWithTimeout: vi.fn(), apiUpload: vi.fn(),
  ApiError: class extends Error {},
}))
vi.mock('../lib/audio', async o => ({ ...(await o()), playUi: vi.fn(), playClick: vi.fn(), speakJapanese: vi.fn() }))
globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })

const { default: DictionaryScreen } = await import('./DictionaryScreen')
const { apiFetch } = await import('../lib/api')

const row = (kanji, meaning) => ({ type: 'kanji', kanji, kana: 'x', meaning, level: 'N5', status: { status: 'new' } })
const wait = ms => new Promise(r => setTimeout(r, ms))
// How long each search takes to answer: the older one, slower.
const DELAY = { '': 0, '田': 900, '山': 20 }
let fail = false

beforeEach(() => {
  fail = false
  apiFetch.mockReset()
  apiFetch.mockImplementation(async path => {
    const p = String(path)
    if (p.startsWith('/api/dictionary/radicals')) return { ok: true, json: async () => ({ groups: [] }) }
    const q = new URLSearchParams(p.split('?')[1]).get('q') ?? ''
    await wait(DELAY[q] ?? 0)
    if (fail && q) throw new Error('offline')
    return { ok: true, json: async () => ({ results: q ? [row(q, `row ${q}`)] : [row('駅', 'station')], total: 1, has_more: false }) }
  })
})

function type(input, value) {
  const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
  set.call(input, value)
  input.dispatchEvent(new Event('input', { bubbles: true }))
}

async function mount() {
  const screen = await render(
    <LangProvider>
      <MemoryRouter initialEntries={['/dictionary']}>
        <Routes><Route path="/dictionary" element={<DictionaryScreen session={{}} />} /></Routes>
      </MemoryRouter>
    </LangProvider>
  )
  await wait(200)
  return screen
}

const field = () => document.querySelector('.dictionary input[type="text"], .dictionary input:not([type])')

describe('the dictionary catalogue', () => {
  it('keeps the newer search when the older one answers last', async () => {
    await mount()
    type(field(), '田')
    await wait(350)        // the slow search is in flight
    type(field(), '山')
    await wait(1300)       // the fast one lands, then the slow one
    // The tile capitalises the meaning ("Row 山").
    const text = document.querySelector('.dictionary').textContent.toLowerCase()
    expect(text).toContain('row 山')
    expect(text).not.toContain('row 田')
  })

  it('takes the loading line down when a page fails', async () => {
    await mount()
    fail = true
    type(field(), '山')
    await wait(500)
    // The results' own wait, not the console's inline one.
    expect(document.querySelector('.dictionary .loading:not(.loading--inline)')).toBeNull()
  })
})
