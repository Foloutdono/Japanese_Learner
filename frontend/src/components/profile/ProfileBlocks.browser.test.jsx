import { describe, it, expect, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { LangProvider } from '../../LangContext'
import { Records } from './ProfileBlocks'
import '../../index.css'

// ── The records lattice always divides its content ────────────
// DESIGN.md, Surfaces: a lattice's column count must divide its
// content, because the seams are the background showing through and
// a short last row is a bare slab. The records are two by two — three
// figures and the door to 統計 — so the block holds four cells whatever
// the profile has to say: a figure with nothing to count yet prints a
// dash rather than dropping out of the grid.

const t = {
  totalReviews: 'Reviews',
  retention: 'Retention',
  perfectRun: 'Best perfect run',
  perfectRunUnit: 'in a row',
  statistics: 'Statistics',
  statsDesc: 'Everything you have done, counted',
}

const PROFILE = { totalReviews: 842, retention: 0.91, bestQualityStreak: 12 }

function records(profile, navigate = () => {}) {
  return render(
    <LangProvider>
      <div style={{ width: 600 }}>
        <Records profile={profile} t={t} navigate={navigate} />
      </div>
    </LangProvider>
  )
}

describe('Records — three figures and one door, in a lattice of four', () => {
  it('lays four cells out two by two', async () => {
    const screen = await records(PROFILE)
    const cells = [...screen.container.querySelectorAll('.record')]
    expect(cells).toHaveLength(4)

    const [a, b, c, door] = cells.map(el => el.getBoundingClientRect())
    // Two rows of two: the second cell sits beside the first, the third
    // under it, and the door closes the second row.
    expect(b.top).toBeCloseTo(a.top, 0)
    expect(b.left).toBeGreaterThan(a.right - 1)
    expect(c.top).toBeGreaterThan(a.bottom - 1)
    expect(door.top).toBeCloseTo(c.top, 0)
    expect(door.left).toBeCloseTo(b.left, 0)
  })

  it('prints the figures with their units', async () => {
    const screen = await records(PROFILE)
    const values = [...screen.container.querySelectorAll('.record__value')].map(el => el.textContent)
    expect(values).toEqual(['842', '91%', '12in a row'])
  })

  it('keeps four cells when a figure has nothing to count yet', async () => {
    const screen = await records({ totalReviews: 0, retention: null, bestQualityStreak: 0 })
    expect(screen.container.querySelectorAll('.record')).toHaveLength(4)
    const retention = [...screen.container.querySelectorAll('.record')]
      .find(el => el.textContent.includes('Retention'))
    expect(retention.querySelector('.record__value').textContent).toBe('—')
  })

  it('is the door to 統計, wearing the station code', async () => {
    const navigate = vi.fn()
    const screen = await records(PROFILE, navigate)
    const door = screen.container.querySelector('.record--door')
    expect(door.querySelector('.pf-line__roundel').textContent).toBe('TO')
    expect(door.textContent).toContain('統計')
    expect(door.textContent).toContain('Statistics')
    door.click()
    expect(navigate).toHaveBeenCalledWith('/stats')
  })
})
