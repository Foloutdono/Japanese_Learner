import { describe, it, expect } from 'vitest'
import { render } from 'vitest-browser-react'
import { LangProvider } from '../../LangContext'
import { LineLedger } from './LineLedger'
import '../../index.css'

// ── One row, one answer ─────────────────────────────────────────
// The figure and the rail beside it used to be two different sums: the
// figure counted (card, mode) drills while the rail averaged the wall
// map's stop scores. Finish N5 vocab and nothing else and the row read
// "1,838 / 24,118" — 7.6% — next to a rail filled to 20%.
//
// They are one number now, and this measures the DRAWN width against
// the printed figure rather than recomputing either, because the bug
// was precisely that two correct computations were shown as one.

const t = { mastered: 'learned' }

function ledger(items) {
  return render(
    <LangProvider>
      <div style={{ width: 600 }}>
        <LineLedger stats={{ items }} t={t} navigate={() => {}} />
      </div>
    </LangProvider>
  )
}

/** The rail's filled fraction, read off the rendered boxes. */
function railFraction(row) {
  const track = row.querySelector('.pf-line__track').getBoundingClientRect()
  const done = row.querySelector('.pf-line__done').getBoundingClientRect()
  return done.width / track.width
}

function figures(row) {
  const fig = row.querySelector('.pf-line__fig')
  const of = fig.querySelector('.pf-line__of')
  return {
    learned: Number(fig.textContent.replace(of.textContent, '').replace(/[^0-9]/g, '')),
    total: Number(of.textContent.replace(/[^0-9]/g, '')),
  }
}

describe('LineLedger — the figure and the rail are one number', () => {
  it('fills the rail to exactly the fraction it prints', async () => {
    // N5 vocab finished, nothing else: 665 of 8,403 cards.
    const screen = await ledger({
      vocab: {
        N5: { total: 665, learned: 665, score: 1 },
        N4: { total: 634, learned: 0, score: 0 },
        N3: { total: 1832, learned: 0, score: 0 },
        N2: { total: 1796, learned: 0, score: 0 },
        N1: { total: 3476, learned: 0, score: 0 },
      },
    })
    const row = [...screen.container.querySelectorAll('.pf-line')]
      .find(r => r.textContent.includes('665'))
    expect(row, 'the vocab row should print its learned count').toBeTruthy()

    const { learned, total } = figures(row)
    expect({ learned, total }).toEqual({ learned: 665, total: 8403 })
    // The rail agrees with the figure to within a rounding step (the
    // width is a whole percent).
    expect(railFraction(row)).toBeCloseTo(learned / total, 2)
  })

  it('draws an empty rail and a zero figure for a line never touched', async () => {
    const screen = await ledger({ kanji: { N5: { total: 103, learned: 0, score: 0 } } })
    const row = [...screen.container.querySelectorAll('.pf-line')]
      .find(r => r.textContent.includes('103'))
    expect(figures(row)).toEqual({ learned: 0, total: 103 })
    expect(railFraction(row)).toBe(0)
  })

  it('fills the rail completely when every card on the line is learned', async () => {
    const screen = await ledger({ grammar: { N5: { total: 71, learned: 71, score: 1 } } })
    const row = [...screen.container.querySelectorAll('.pf-line')]
      .find(r => r.textContent.includes('71'))
    expect(railFraction(row)).toBeCloseTo(1, 2)
  })
})
