import { describe, it, expect, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { LangProvider } from '../LangContext'
import '../index.css'

// ── 実践 — the gate's four platforms, at 390px ────────────────
// Each title carried the section's own Japanese name after it — 読書
// 理解 翻訳 模試 — a second name for a thing the line above already
// named. At phone width the pair ran past the card and 理解 broke
// between its two characters, one to a line. The Japanese lives on the
// roundel of every station these cards open and on the gate the
// departure passes through; this row was the one place it was a
// caption.

vi.mock('../lib/api', () => ({
  apiFetch: vi.fn(async () => ({ ok: true, status: 200, json: async () => ({}) })),
  apiJson: vi.fn(async () => ({})),
  apiJsonWithTimeout: vi.fn(async () => ({})),
  apiUpload: vi.fn(),
  ApiError: class extends Error {},
}))
vi.mock('../lib/audio', async o => ({
  ...(await o()), playUi: vi.fn(), playAnnouncement: vi.fn(), playClick: vi.fn(),
}))
// The door is the run's, not this screen's: here it just has to let
// the commit through so the destination is a location, not an
// animation (the pattern the analyzer's tests use).
vi.mock('../stores/boarding', () => ({ board: commit => commit() }))
vi.mock('../stores/profileSummary', () => ({ useProfileSummary: () => ({ jlptLevel: 'N4' }) }))

const { default: PracticeScreen } = await import('./PracticeScreen')
const { getSections } = await import('../config/tabs')

// Long enough for the shared `arrive` to land: it starts the card
// 10px low, and everything below measures against the page's foot.
const settle = (ms = 620) => new Promise(r => setTimeout(r, ms))

const here = { path: null }
function Probe() {
  const loc = useLocation()
  here.path = loc.pathname + loc.search
  return null
}

async function gate() {
  const screen = await render(
    <LangProvider>
      <MemoryRouter initialEntries={['/practice']}>
        <div className="phone">
          <div className="phone__content"><PracticeScreen /></div>
        </div>
        <Probe />
      </MemoryRouter>
    </LangProvider>
  )
  await settle()
  return screen
}

describe('the practice gate at phone width', () => {
  it('names each platform once, in one language and on one line', async () => {
    const screen = await render(
      <LangProvider>
        <MemoryRouter initialEntries={['/practice']}>
          <PracticeScreen />
        </MemoryRouter>
      </LangProvider>
    )
    await settle()

    const grid = screen.container.querySelector('.platform-grid')
    // Not one Japanese caption left on the row — and the sections still
    // carry their Japanese, for the roundel and the gate.
    expect(grid.querySelector('[lang="ja"]')).toBeNull()
    expect(getSections('practice', {}).every(s => s.icon)).toBe(true)

    const titles = [...grid.querySelectorAll('.platform-card__title')]
    expect(titles).toHaveLength(4)
    for (const title of titles) {
      // The title is the title: nothing appended, nothing nested.
      expect(title.children).toHaveLength(0)
      expect(title.textContent.trim().length).toBeGreaterThan(0)
      // One line of its own type — 理解 used to make a second one.
      const line = parseFloat(getComputedStyle(title).lineHeight)
      expect(title.getBoundingClientRect().height).toBeLessThan(line * 1.6)
    }
  })

  // ── The gate takes the gate ──
  // Four cards of a title and a line of description filled 528px of a
  // 746px screen and left 218 under them; the owner's word for the
  // screen was bland. The platforms take the room and share it.
  it('gives the four platforms the whole gate, one share each', async () => {
    const screen = await gate()
    const content = screen.container.querySelector('.phone__content').getBoundingClientRect()
    const grid = screen.container.querySelector('.platform-grid').getBoundingClientRect()
    expect(content.bottom - grid.bottom).toBeLessThanOrEqual(24)
    const cards = [...screen.container.querySelectorAll('.platform-card')].map(el => el.getBoundingClientRect())
    expect(cards).toHaveLength(4)
    for (const box of cards) {
      expect(box.height).toBeCloseTo(cards[0].height, 0)
      expect(box.height).toBeGreaterThan(130)
    }
  })

  // ── Where the trains go ──
  it('carries the five grades on every platform, and marks the learner\'s own', async () => {
    const screen = await gate()
    const rows = [...screen.container.querySelectorAll('.platform-sign__dests')]
    expect(rows).toHaveLength(4)
    for (const row of rows) {
      const chips = [...row.querySelectorAll('.chip')]
      expect(chips.map(c => c.textContent)).toEqual(['N5', 'N4', 'N3', 'N2', 'N1'])
      // A destination is not a filter: nothing here is pressed.
      for (const chip of chips) expect(chip.getAttribute('aria-pressed')).toBeNull()
      // The learner's own grade, marked the way a route stop marks it.
      const mine = chips.filter(c => c.classList.contains('chip--here'))
      expect(mine).toHaveLength(1)
      expect(mine[0].textContent).toBe('N4')
      expect(mine[0].getAttribute('aria-current')).toBe('location')
      // A thumb's worth of chip, five to a row, filling the card.
      for (const chip of chips) expect(chip.getBoundingClientRect().height).toBeGreaterThanOrEqual(36)
      const first = chips[0].getBoundingClientRect()
      const last = chips[4].getBoundingClientRect()
      expect(last.width).toBeCloseTo(first.width, 0)
      expect(last.right - first.left).toBeGreaterThan(row.getBoundingClientRect().width * 0.9)
    }
  })

  it('boards that platform\'s train from the grade itself', async () => {
    const screen = await gate()
    const rows = [...screen.container.querySelectorAll('.platform-sign__dests')]
    const chipAt = (row, level) => [...rows[row].querySelectorAll('.chip')].find(c => c.textContent === level)

    // 読書 — the run at that grade, three taps saved.
    chipAt(0, 'N3').click()
    await settle(60)
    expect(here.path).toBe('/practice/reading/level/N3')

    // 理解 — one axis, so its grades ARE the run.
    chipAt(1, 'N5').click()
    await settle(60)
    expect(here.path).toBe('/practice/comprehension/N5')

    // 翻訳 — the same shape as 読書.
    chipAt(2, 'N1').click()
    await settle(60)
    expect(here.path).toBe('/practice/translation/level/N1')

    // 模試 — not a run: that grade's papers (ExamScreen reads ?level=).
    chipAt(3, 'N2').click()
    await settle(60)
    expect(here.path).toBe('/practice/exam?level=N2')
  })
})
