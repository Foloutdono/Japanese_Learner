import { describe, it, expect, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { LangProvider } from './LangContext'
import POINTS from './testing/grammarPoints.json'
import KANA from './testing/kanaRows.json'
import './index.css'

// ── 机 — the grammar page on a laptop's width (plan 128) ─────────────
// At 1440 the grammar page's entry has room for its lesson in two
// columns, each at least a desk column's least width: the rule, its
// uses and its trap down the left, the sentences over the rivals down
// the right, each column opening under the stripe (plan 145; they were
// one flow balanced across CSS columns, which opened the sentences at
// the left column's foot). A typical point (は: three steps, four
// sentences, two rivals) reads whole with no scroll. On the narrow desk
// the lesson is one column (dictionary.desktop).

vi.mock('./lib/api', () => ({
  api: p => p,
  apiFetch: vi.fn(async path => {
    const rows = KANA[new URLSearchParams(String(path).split('?')[1] ?? '').get('category')] ?? POINTS
    return { ok: true, status: 200, json: async () => ({ results: rows, total: rows.length, has_more: false }) }
  }),
  apiJson: vi.fn(async () => ({ decks: [] })),
  apiJsonWithTimeout: vi.fn(), apiUpload: vi.fn(),
  ApiError: class extends Error {},
}))
vi.mock('./lib/audio', async o => ({ ...(await o()), playUi: vi.fn(), playClick: vi.fn(), speakJapanese: vi.fn() }))
globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })

const { default: DictionaryScreen } = await import('./screens/DictionaryScreen')
const settle = (ms = 250) => new Promise(r => setTimeout(r, ms))

async function mount(category = 'grammar') {
  await render(
    <LangProvider>
      <MemoryRouter initialEntries={[`/dictionary?category=${category}`]}>
        <div className="phone phone--desk">
          <div className="phone__content">
            <Routes><Route path="/dictionary" element={<DictionaryScreen session={{}} />} /></Routes>
          </div>
        </div>
      </MemoryRouter>
    </LangProvider>
  )
  await settle()
}

describe('the grammar page on a wide desk (plan 128)', () => {
  it('sets the lesson in two columns, and reads a typical point whole', async () => {
    await mount()
    const dock = document.querySelector('.dict-dock')
    expect(dock.querySelector('.dict-plate__word').textContent).toBe('は')
    // The list at the side column's width, here where there is room.
    const side = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--desk-side-w'))
    expect(Math.round(document.querySelector('.desk-dict__main').getBoundingClientRect().width)).toBe(side)
    const body = dock.querySelector('.gl-body').getBoundingClientRect()
    const middle = body.left + body.width / 2
    const boxes = sel => [...dock.querySelectorAll(sel)].map(p => p.getBoundingClientRect())
    const [steps, sentences, rivals] = ['.gl-step', '.dict-ex', '.gl-door'].map(boxes)
    expect(steps.length * sentences.length * rivals.length).toBeGreaterThan(0)
    expect(steps.every(p => p.right <= middle + 1)).toBe(true)
    expect([...sentences, ...rivals].every(p => p.left >= middle - 1)).toBe(true)
    // Each column opens under the stripe, the rivals under the sentences.
    const [left, right] = ['.gl-block--steps', '.gl-block--examples'].map(s => dock.querySelector(s).getBoundingClientRect())
    expect(Math.round(left.top)).toBe(Math.round(body.top))
    expect(Math.abs(right.top - body.top)).toBeLessThanOrEqual(1)
    expect(Math.min(...rivals.map(p => p.top))).toBeGreaterThan(Math.max(...sentences.map(p => p.bottom)))
    // The hairline between them runs the body's height.
    expect(getComputedStyle(dock.querySelector('.gl-block--steps')).borderInlineEndWidth).toBe('1px')
    expect(Math.round(left.bottom)).toBe(Math.round(body.bottom))
    expect(dock.scrollHeight).toBeLessThanOrEqual(dock.clientHeight)
    expect(dock.getBoundingClientRect().bottom).toBeLessThanOrEqual(innerHeight)
  })
})

// ── plan 128 — the kana charts on a laptop's width ──
// At 1440 the three columns stand in one row and the whole of either
// syllabary -- katakana's twelve rows a column the tallest -- ends above
// the window's foot, every cell one width, no kana (a pair like きゃ or
// ファ) wider than its cell.
describe('the kana charts on a wide desk (plan 128)', () => {
  it.each(['hiragana', 'katakana'])('stands the whole of %s in the window', async category => {
    await mount(category)
    const cols = [...document.querySelectorAll('.syllabary-col')].map(c => c.getBoundingClientRect())
    expect(cols).toHaveLength(3)
    expect(new Set(cols.map(c => Math.round(c.top))).size).toBe(1)
    expect(Math.max(...cols.map(c => c.bottom))).toBeLessThanOrEqual(innerHeight)
    const cells = [...document.querySelectorAll('.syllabary-cell--kana')]
    const widths = cells.map(c => c.getBoundingClientRect().width)
    expect(Math.max(...widths) - Math.min(...widths)).toBeLessThan(1.5)
    expect(cells.filter(c => c.querySelector('.syllabary-cell__char').scrollWidth > c.clientWidth)).toEqual([])
  })
})
