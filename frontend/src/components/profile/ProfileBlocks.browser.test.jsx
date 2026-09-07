import { describe, it, expect, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { LangProvider } from '../../LangContext'
import { Records } from './ProfileBlocks'
import '../../index.css'

// ── The records lattice always divides its content ────────────
// DESIGN.md, Surfaces: a lattice's column count must divide its
// content, because the seams are the background showing through and
// a short last row is a bare slab. The records are two by two — two
// figures and the two doors behind the pass (plan 074) — so the block
// holds four cells whatever the profile has to say: a figure with
// nothing to count yet prints a dash rather than dropping out of the
// grid.

const t = {
  totalReviews: 'Reviews',
  retention: 'Retention',
  statistics: 'Statistics',
  statsDesc: 'Everything you have done, counted',
  settings: 'Settings',
}

const PROFILE = { totalReviews: 842, retention: 0.91 }

function records(profile, navigate = () => {}) {
  return render(
    <LangProvider>
      <div style={{ width: 600 }}>
        <Records profile={profile} t={t} navigate={navigate} />
      </div>
    </LangProvider>
  )
}

describe('Records — two figures and two doors, in a lattice of four', () => {
  it('lays four cells out two by two', async () => {
    const screen = await records(PROFILE)
    const cells = [...screen.container.querySelectorAll('.record')]
    expect(cells).toHaveLength(4)

    const [a, b, c, d] = cells.map(el => el.getBoundingClientRect())
    // Two rows of two: the second cell sits beside the first, the
    // doors close the second row.
    expect(b.top).toBeCloseTo(a.top, 0)
    expect(b.left).toBeGreaterThan(a.right - 1)
    expect(c.top).toBeGreaterThan(a.bottom - 1)
    expect(d.top).toBeCloseTo(c.top, 0)
    expect(d.left).toBeCloseTo(b.left, 0)
  })

  it('prints the figures with their units', async () => {
    const screen = await records(PROFILE)
    const values = [...screen.container.querySelectorAll('.record__value')].map(el => el.textContent)
    expect(values).toEqual(['842', '91%'])
  })

  it('keeps four cells when a figure has nothing to count yet', async () => {
    const screen = await records({ totalReviews: 0, retention: null })
    expect(screen.container.querySelectorAll('.record')).toHaveLength(4)
    const retention = [...screen.container.querySelectorAll('.record')]
      .find(el => el.textContent.includes('Retention'))
    expect(retention.querySelector('.record__value').textContent).toBe('—')
  })

  it('is the door to the statistics and to the settings', async () => {
    const navigate = vi.fn()
    const screen = await records(PROFILE, navigate)
    const doors = [...screen.container.querySelectorAll('.record--door')]
    expect(doors).toHaveLength(2)
    // The statistics door wears the hall's station code; the settings
    // door the gear.
    expect(doors[0].querySelector('.pf-line__roundel').textContent).toBe('TO')
    expect(doors[0].textContent).toContain('Statistics')
    expect(doors[1].querySelector('.pf-line__roundel svg')).not.toBeNull()
    expect(doors[1].textContent).toContain('Settings')
    doors[0].click()
    expect(navigate).toHaveBeenCalledWith('/profile/stats')
    doors[1].click()
    expect(navigate).toHaveBeenCalledWith('/profile/settings')
  })
})
