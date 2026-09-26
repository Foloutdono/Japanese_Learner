import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { LangProvider } from '../LangContext'
import '../index.css'

// ── How the query is read: match and field ──
// Every term used to be a substring of everything ("sun" found Sunday
// and 寸法). The console now carries the search's strictness and its
// field under the field, while a query is typed, and a choice there is
// sent with the query; the defaults are never sent.

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

const wait = ms => new Promise(r => setTimeout(r, ms))
const searches = () => apiFetch.mock.calls
  .map(([p]) => String(p))
  .filter(p => p.startsWith('/api/dictionary?'))
  .map(p => new URLSearchParams(p.split('?')[1]))

beforeEach(() => {
  try { localStorage.removeItem('dict.search') } catch { /* none */ }
  apiFetch.mockReset()
  apiFetch.mockImplementation(async path => {
    if (String(path).startsWith('/api/dictionary/radicals')) return { ok: true, json: async () => ({ groups: [] }) }
    return { ok: true, json: async () => ({ results: [], total: 0, has_more: false }) }
  })
})

function type(input, value) {
  const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
  set.call(input, value)
  input.dispatchEvent(new Event('input', { bubbles: true }))
}

async function mount() {
  await render(
    <LangProvider>
      <MemoryRouter initialEntries={['/dictionary']}>
        <Routes><Route path="/dictionary" element={<DictionaryScreen session={{}} />} /></Routes>
      </MemoryRouter>
    </LangProvider>
  )
  await wait(200)
}

const field = () => document.querySelector('.dictionary input[type="text"], .dictionary input:not([type])')
const opts = () => document.querySelector('.dict-search-opts')

describe('the search options', () => {
  it('appear with a query and send only what differs from the default', async () => {
    await mount()
    expect(opts()).toBeNull()
    type(field(), 'sun')
    await wait(450)
    expect(opts()).not.toBeNull()
    const last = searches().at(-1)
    expect(last.get('q')).toBe('sun')
    expect(last.has('match')).toBe(false)
    expect(last.has('field')).toBe(false)

    const [matchGroup, fieldGroup] = opts().querySelectorAll('.console__chips')
    matchGroup.querySelectorAll('.chip')[2].click()   // anywhere
    await wait(100)
    expect(searches().at(-1).get('match')).toBe('any')
    fieldGroup.querySelectorAll('.chip')[2].click()   // meaning
    await wait(100)
    const both = searches().at(-1)
    expect(both.get('match')).toBe('any')
    expect(both.get('field')).toBe('meaning')
    expect(both.get('q')).toBe('sun')
  })
})
