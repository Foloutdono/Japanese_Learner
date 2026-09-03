import { describe, it, expect, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { page } from 'vitest/browser'
import { LangProvider } from '../../LangContext'
import '../../index.css'

vi.mock('../../lib/audio', async (o) => ({ ...(await o()), playUi: vi.fn() }))
const { default: ModeSelector } = await import('./ModeSelector')

// ── Cards in a row are one height ───────────────────────────────
// .platform-grid puts each card in a .platform-slot, and the grid
// stretches every slot in a row to the tallest one. The card inside
// did not follow: a column flex container sizes its children on the
// cross axis, not the main one, so a card whose description fits on
// one line stayed short inside a cell sized for a neighbour whose
// description wrapped — the six-mode kanji picker showed 'Radical' 44px
// shorter than 'Fast review' beside it, with the slack pooled under it.
//
// Two columns is the case that can go wrong; one column per row (the
// phone layout) has nothing to line up against.

const MODES = [
  { key: 'kanji_meaning', label: 'Kanji → meaning', desc: 'The kanji is shown. Recall what it means.' },
  { key: 'meaning_kanji', label: 'Meaning → kanji', desc: 'The meaning is shown. Recall the kanji.' },
  { key: 'kanji_radical', label: 'Radical', desc: 'Short.' },
  {
    key: 'fast_review',
    label: 'Fast review',
    desc: 'Flip through everything you have already studied, at your own pace, ' +
          'with nothing graded and no stamp at the end of it.',
  },
]

async function rows(width) {
  await page.viewport(width, 900)
  const screen = await render(
    <LangProvider>
      <ModeSelector modes={MODES} onSelect={() => {}} />
    </LangProvider>
  )
  const byTop = new Map()
  for (const slot of screen.container.querySelectorAll('.platform-slot')) {
    const top = Math.round(slot.getBoundingClientRect().top)
    if (!byTop.has(top)) byTop.set(top, [])
    byTop.get(top).push({
      label: slot.querySelector('.platform-card__title').textContent,
      slot: Math.round(slot.getBoundingClientRect().height),
      card: Math.round(slot.querySelector('.platform-card').getBoundingClientRect().height),
    })
  }
  return { screen, rows: [...byTop].sort((a, b) => a[0] - b[0]).map(([, r]) => r) }
}

describe('ModeSelector — the cards in a row are one height', () => {
  it('fills the cell the grid gave it, at every two-column width', async () => {
    for (const width of [1300, 1100, 980]) {
      const { screen, rows: got } = await rows(width)
      const twoUp = got.filter(r => r.length > 1)
      expect(twoUp.length, `${width}px should lay out in two columns`).toBeGreaterThan(0)
      for (const row of twoUp) {
        for (const c of row) {
          expect(c.card, `${c.label} is short in its cell at ${width}px`).toBe(c.slot)
        }
        const [first, ...rest] = row
        for (const c of rest) {
          expect(c.card, `${c.label} does not match ${first.label} at ${width}px`).toBe(first.card)
        }
      }
      // The row that actually differs — one card wraps, one does not —
      // is the one the bug lived in, so make sure the fixture still
      // produces it rather than passing on four identical cards.
      expect(
        got.some(r => r.length > 1 && r[0].slot > 120),
        `no row at ${width}px was made tall by a wrapped description`,
      ).toBe(true)
      screen.unmount()
    }
  }, 30000)

  it('does not grow a card because its neighbour has a secondary action', async () => {
    // The exam picker's mix: only a paper you have already sat offers
    // a 別の問題 link. That link is a row under the card, so a slot
    // carrying one is taller — and once the card fills its slot, the
    // card WITHOUT the link inherited that extra height and stood a
    // whole strip taller than the identical card beside it.
    await page.viewport(1300, 900)
    const screen = await render(
      <LangProvider>
        <ModeSelector
          modes={[
            { key: 'a', label: 'Paper 1', desc: 'A mock exam.', action: { label: '別の問題', onClick() {} } },
            { key: 'b', label: 'Paper 2', desc: 'A mock exam.' },
          ]}
          onSelect={() => {}}
        />
      </LangProvider>
    )
    const [withAction, without] = [...screen.container.querySelectorAll('.platform-card')]
      .map(c => Math.round(c.getBoundingClientRect().height))
    expect(without, 'the card without an action grew to swallow the action row').toBe(withAction)

    // And the reserved row is only ever reserved, never reachable.
    const ghost = screen.container.querySelector('.platform-slot__action--ghost')
    expect(ghost, 'the actionless slot should still reserve the row').not.toBeNull()
    expect(getComputedStyle(ghost).visibility).toBe('hidden')
    screen.unmount()
  }, 30000)
})
