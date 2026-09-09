import { describe, it, expect, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import './index.css'

// ── The console's chips fill the row they wrap onto ──────────
// Shrink-wrapped, a wrapped row of chips left a ragged hundred pixels
// at its end — KANJI · VOCABULARY, then nothing, then HIRAGANA ·
// KATAKANA · RADICAL, then nothing — and read as a sentence that had
// run out rather than as a set of choices. They grow into their line
// now, with the label centred in each. Owner's call.
//
// Growing is per LINE, not per set: flex wraps on the natural widths
// first and stretches what landed on each line, so the set keeps the
// shape it wraps into.

vi.mock('./lib/audio', async o => ({ ...(await o()), playUi: vi.fn() }))
const { Console, ConsoleTop, Chips, Chip, ConsoleIndex } = await import('./components/chrome/Console')

const LABELS = ['Kanji', 'Vocabulaire', 'Hiragana', 'Katakana', 'Radical']

async function console_(labels = LABELS) {
  return render(
    <main className="dictionary" style={{ '--line-color': 'var(--line-jisho)' }}>
      <Console>
        <ConsoleTop>
          <Chips label="Collections">
            {labels.map((l, i) => <Chip key={l} on={i === 0}>{l}</Chip>)}
          </Chips>
        </ConsoleTop>
        <ConsoleIndex value="" onChange={() => {}} placeholder="Chercher" count="0" />
      </Console>
    </main>
  )
}

/** The chips grouped by the line they wrapped onto. */
function lines(screen) {
  const rows = new Map()
  for (const chip of screen.container.querySelectorAll('.chip')) {
    const top = Math.round(chip.getBoundingClientRect().top)
    if (!rows.has(top)) rows.set(top, [])
    rows.get(top).push(chip.getBoundingClientRect())
  }
  return [...rows.values()]
}

describe('the console at phone width', () => {
  it('fills every line it wraps onto, and centres each label', async () => {
    const screen = await console_()
    const row = screen.container.querySelector('.console__chips').getBoundingClientRect()
    const rows = lines(screen)
    expect(rows.length).toBeGreaterThan(1)
    for (const chips of rows) {
      // Flush at both ends: the first chip starts the row and the last
      // one finishes it, whatever landed between them.
      expect(chips[0].left).toBeCloseTo(row.left, 0)
      expect(chips.at(-1).right).toBeCloseTo(row.right, 0)
    }
    // Centred, not left-aligned: the label sits the same distance from
    // each end of its own pill.
    for (const chip of screen.container.querySelectorAll('.chip')) {
      expect(getComputedStyle(chip).justifyContent).toBe('center')
    }
  })

  it('leaves a lone chip its own width — one is not a set', async () => {
    const screen = await console_(['Tous'])
    const chip = screen.container.querySelector('.chip').getBoundingClientRect()
    const row = screen.container.querySelector('.console__chips').getBoundingClientRect()
    expect(chip.width).toBeLessThan(row.width / 2)
  })

  it('never sets a label wider than the pill that carries it', async () => {
    const screen = await console_()
    for (const chip of screen.container.querySelectorAll('.chip')) {
      expect(chip.scrollWidth).toBeLessThanOrEqual(Math.ceil(chip.getBoundingClientRect().width))
    }
  })
})
