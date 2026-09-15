import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { LangProvider } from '../LangContext'

// ── The station's points (plan 087) ───────────────────────────
// The level page carries a door with learned over total that opens the
// level's index; a row opens the lesson sheet; a deep link ?point= opens
// it straight away; and a platform whose pool is empty at this level is
// not offered.

const apiJson = vi.fn()
vi.mock('../lib/api', () => ({
  api: p => p,
  apiFetch: vi.fn(async () => ({ ok: true, status: 200, json: async () => ({}) })),
  apiJson: (...a) => apiJson(...a),
  apiJsonWithTimeout: vi.fn(),
  apiUpload: vi.fn(),
  ApiError: class ApiError extends Error { constructor(status) { super(); this.status = status } },
}))
vi.mock('../lib/audio', async (o) => ({ ...(await o()), playClick: vi.fn(), playUi: vi.fn() }))
vi.mock('../stores/boarding', () => ({ board: fn => fn() }))
globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })

const { default: GrammarScreen } = await import('./GrammarScreen')

const INDEX = {
  level: 'N5',
  points: [
    { raw_id: 'grammar_N5_です／だ', pattern: 'です／だ', meaning: 'the copula', stage: 'mastered', rich: false },
    { raw_id: 'grammar_N5_〜てください', pattern: '〜てください', meaning: 'please do', stage: 'new', rich: true },
  ],
  learned: 1, started: 0, total: 2,
  totals: { 'grammar.flashcard.f2b': 2, 'grammar.flashcard.b2f': 2, 'grammar.fill_in': 1, 'grammar.contrast': 0 },
}
const POINT = {
  raw_id: 'grammar_N5_〜てください', level: 'N5', pattern: '〜てください', structure: 'verb て-form + ください',
  meaning: 'please do', register: 'polite', steps: [{ kind: 'rule', text: 'A polite request.' }], compare: [], examples: [],
  status: { status: 'not_started' },
}

const settle = (ms = 200) => new Promise(r => setTimeout(r, ms))

function mount(path) {
  apiJson.mockImplementation(async (url) => {
    if (String(url).startsWith('/api/grammar/points')) return INDEX
    if (String(url).startsWith('/api/grammar/point')) return POINT
    return {}
  })
  return render(
    <LangProvider>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/learn/grammar/:level" element={<GrammarScreen session={{ access_token: 'tok' }} />} />
          <Route path="/learn/grammar/:level/:mode" element={<div className="run-probe">run</div>} />
        </Routes>
      </MemoryRouter>
    </LangProvider>
  )
}

beforeEach(() => { apiJson.mockReset(); localStorage.setItem('lang', 'en') })
afterEach(() => { localStorage.removeItem('lang') })

describe('the grammar station', () => {
  it('prints the points door with learned over total, and opens the index and a lesson from it', async () => {
    const screen = await mount('/learn/grammar/N5')
    await settle(300)
    const door = screen.container.querySelector('.gl-points-door')
    expect(door.querySelector('.rad-door__fig').textContent.replace(/\s/g, '')).toBe('1/2')
    expect(door.querySelector('.rad-door__label').textContent).toBe('The points')
    door.click()
    await settle()
    const rows = [...screen.container.querySelectorAll('.gl-index__row')]
    expect(rows.map(r => r.querySelector('.gl-index__pattern').textContent)).toEqual(['です／だ', '〜てください'])
    expect(rows[0].querySelector('.stage-mark').textContent).toBeTruthy()
    rows[1].click()
    await settle(300)
    expect(document.querySelector('.gl-sheet .dict-plate__word').textContent).toBe('〜てください')
    document.querySelector('.gl-sheet [aria-label="Close"]').click()
    await settle()
    expect(document.querySelector('.gl-sheet')).toBeNull()
  })

  it('opens a deep-linked point straight onto the platforms, and hides a platform with nothing to serve', async () => {
    const screen = await mount('/learn/grammar/N5?point=grammar_N5_%E3%80%9C%E3%81%A6%E3%81%8F%E3%81%A0%E3%81%95%E3%81%84')
    await settle(300)
    expect(document.querySelector('.gl-sheet .dict-plate__word').textContent).toBe('〜てください')
    document.querySelector('.gl-sheet [aria-label="Close"]').click()
    await settle()
    const cards = [...screen.container.querySelectorAll('.platform-card')]
    const text = cards.map(c => c.textContent).join(' ')
    expect(text).toContain('Name the rule')
    expect(text).not.toContain('Which one fits')
  })
})
