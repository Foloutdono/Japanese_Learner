import { describe, it, expect, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { LangProvider } from '../../LangContext'
import { Records, ProfileDoors } from './ProfileBlocks'
import '../../index.css'

// ── The records and the doors each divide their lattice ────────
// DESIGN.md, Surfaces: a lattice's column count must divide its
// content, because the seams are the background showing through and
// a short last row is a bare slab. Since plan 140 the records are
// three figures three across -- the reviews, the retention and the
// best perfect run -- and the two doors behind the pass (plan 074) a
// lattice of two of their own, so each block holds its cells whatever
// the profile has to say: a figure with nothing to count yet prints a
// dash rather than dropping out of the grid.

const t = {
  totalReviews: 'Reviews',
  retention: 'Retention',
  perfectRun: 'Best run',
  statistics: 'Statistics',
  statsDesc: 'Everything you have done, counted',
  settings: 'Settings',
}

const PROFILE = { totalReviews: 842, retention: 0.91, bestQualityStreak: 12 }

function mount(node) {
  return render(
    <LangProvider>
      <div style={{ width: 600 }}>{node}</div>
    </LangProvider>
  )
}

describe('Records — three figures, three across', () => {
  it('lays three cells out in one row', async () => {
    const screen = await mount(<Records profile={PROFILE} t={t} />)
    const cells = [...screen.container.querySelectorAll('.record')]
    expect(cells).toHaveLength(3)
    const [a, b, c] = cells.map(el => el.getBoundingClientRect())
    expect(b.top).toBeCloseTo(a.top, 0)
    expect(c.top).toBeCloseTo(a.top, 0)
    expect(b.left).toBeGreaterThan(a.right - 1)
    expect(c.left).toBeGreaterThan(b.right - 1)
    expect(b.width).toBeCloseTo(a.width, 0)
  })

  it('prints the figures with their units, the best perfect run among them', async () => {
    const screen = await mount(<Records profile={PROFILE} t={t} />)
    const values = [...screen.container.querySelectorAll('.record__value')].map(el => el.textContent)
    expect(values).toEqual(['842', '91%', '12'])
    expect(screen.container.textContent).toContain('Best run')
  })

  it('keeps three cells when a figure has nothing to count yet', async () => {
    const screen = await mount(<Records profile={{ totalReviews: 0, retention: null }} t={t} />)
    const cells = [...screen.container.querySelectorAll('.record')]
    expect(cells).toHaveLength(3)
    expect(cells[1].querySelector('.record__value').textContent).toBe('—')
    expect(cells[2].querySelector('.record__value').textContent).toBe('—')
  })

  it('opens no door: the doors are a lattice of their own', async () => {
    const screen = await mount(<Records profile={PROFILE} t={t} />)
    expect(screen.container.querySelector('.record--door')).toBeNull()
  })
})

describe('ProfileDoors — the statistics and the settings, two across', () => {
  it('is the door to the statistics and to the settings', async () => {
    const navigate = vi.fn()
    const screen = await mount(<ProfileDoors t={t} navigate={navigate} />)
    const doors = [...screen.container.querySelectorAll('.record--door')]
    expect(doors).toHaveLength(2)
    const [a, b] = doors.map(el => el.getBoundingClientRect())
    expect(b.top).toBeCloseTo(a.top, 0)
    expect(b.left).toBeGreaterThan(a.right - 1)
    // The statistics door wears the hall's station code; the settings
    // door the gear.
    expect(doors[0].querySelector('.pf-line__roundel').textContent).toBe('TO')
    expect(doors[0].textContent).toContain('Statistics')
    expect(doors[1].querySelector('.pf-line__roundel svg')).not.toBeNull()
    expect(doors[1].textContent).toContain('Settings')
    expect(doors[1].dataset.guide).toBe('profile.settings')
    doors[0].click()
    expect(navigate).toHaveBeenCalledWith('/profile/stats')
    doors[1].click()
    expect(navigate).toHaveBeenCalledWith('/profile/settings')
  })
})
