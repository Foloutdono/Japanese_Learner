import { describe, it, expect, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { MemoryRouter } from 'react-router-dom'
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

const { default: PracticeScreen } = await import('./PracticeScreen')
const { getSections } = await import('../config/tabs')

const settle = (ms = 120) => new Promise(r => setTimeout(r, ms))

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
})
