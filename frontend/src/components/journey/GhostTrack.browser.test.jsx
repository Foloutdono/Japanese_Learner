import { describe, it, expect } from 'vitest'
import { render } from 'vitest-browser-react'
// The geometry under test is the stylesheet's; component tests do not
// import the sheet themselves (main.jsx does) — same explicit import
// every style-asserting browser test carries.
import '../../index.css'
import { GhostTrack } from './GhostTrack'

// ── The one-rail track's geometry contract (進捗が主役 round) ──
// The two-lane drawing this replaces pinned four rules here: lanes
// that can never collide, a coordinate span nothing paints outside of,
// a rail running stop-centre to stop-centre, and a bracket label that
// picks the side with room. Two survive as written (containment, the
// rail), one is answered by construction instead of by geometry — a
// marker with no width cannot collide with the car — and the bracket
// is gone with the words it measured. In its place, the rules the new
// drawing lives or dies on: the train reaches the rail, it never hides
// a stop, and the hatching spans exactly what is owed.

const STATIONS = [
  { label: '発', jp: true, pos: 0 },
  { label: 'N5', pos: 21 },
  { label: 'N4', pos: 46 },
  { label: 'N3', pos: 100 },
]

function renderTrack(props) {
  return render(
    <div style={{ width: '640px' }}>
      <GhostTrack stations={STATIONS} youF={20} {...props} />
    </div>
  )
}

const rect = el => el.getBoundingClientRect()
const within = (inner, outer, eps = 0.5) =>
  inner.left >= outer.left - eps && inner.right <= outer.right + eps

describe('GhostTrack marks', () => {
  it('parks the train and the promise at the same x without collision', async () => {
    const screen = await renderTrack({ youF: 50, planF: 50 })
    const you = screen.container.querySelector('.jour-track__you')
    const plan = screen.container.querySelector('.jour-track__plan')
    expect(you).not.toBeNull()
    expect(plan).not.toBeNull()
    // The promise is a line, not a box: nothing to keep apart from.
    expect(rect(plan).width).toBeLessThan(3)
    expect(Math.abs((rect(plan).left + rect(plan).right) / 2
      - (rect(you).left + rect(you).right) / 2)).toBeLessThan(2)
  })

  it('reaches the rail on a stem, from above it', async () => {
    const screen = await renderTrack({ youF: 50 })
    const you = rect(screen.container.querySelector('.jour-track__you'))
    const rail = rect(screen.container.querySelector('.jour-track__rail'))
    // The car itself is clear of the rail...
    expect(you.bottom).toBeLessThanOrEqual(rail.top + 0.5)
    // ...and its stem closes the gap to it.
    const stem = getComputedStyle(
      screen.container.querySelector('.jour-track__you'), '::after'
    )
    expect(parseFloat(stem.height)).toBeGreaterThanOrEqual(rail.top - you.bottom)
  })

  it('never hides a stop under the train, at any width', async () => {
    // 46 is a stop; 43.5 is where the learner stands — the case the
    // floating car could not answer ("which side of N4 am I on?"). The
    // rule is stated VERTICALLY on purpose: how close the two come
    // horizontally depends on the width the sheet is read at (2.5% of
    // the line is 8px on a phone and 15px here), so "they never share a
    // pixel of height" is the only form of this rule that travels.
    const screen = await renderTrack({ youF: 43.5 })
    const you = rect(screen.container.querySelector('.jour-track__you'))
    for (const dot of screen.container.querySelectorAll('.jour-track__station i')) {
      expect.soft(you.bottom, 'the car reaches into the stops\' lane').toBeLessThanOrEqual(rect(dot).top + 0.5)
    }
  })
})

describe('GhostTrack the stretch owed', () => {
  it('hatches exactly the run between the train and the promise', async () => {
    const screen = await renderTrack({ youF: 30, planF: 55 })
    const owed = rect(screen.container.querySelector('.jour-track__owed'))
    const you = rect(screen.container.querySelector('.jour-track__you'))
    const plan = rect(screen.container.querySelector('.jour-track__plan'))
    expect(Math.abs(owed.left - (you.left + you.right) / 2)).toBeLessThan(2)
    expect(Math.abs(owed.right - (plan.left + plan.right) / 2)).toBeLessThan(2)
  })

  it('hatches the other way round when the train is ahead of the promise', async () => {
    const screen = await renderTrack({ youF: 55, planF: 30 })
    const owed = rect(screen.container.querySelector('.jour-track__owed'))
    const plan = rect(screen.container.querySelector('.jour-track__plan'))
    expect(Math.abs(owed.left - (plan.left + plan.right) / 2)).toBeLessThan(2)
    expect(owed.width).toBeGreaterThan(0)
  })

  it('draws no promise and no hatching on a goal-less pass', async () => {
    const screen = await renderTrack({ planF: null })
    expect(screen.container.querySelector('.jour-track__plan')).toBeNull()
    expect(screen.container.querySelector('.jour-track__owed')).toBeNull()
  })

  it('measures nothing under a percent of the line', async () => {
    const screen = await renderTrack({ youF: 40, planF: 40.5 })
    expect(screen.container.querySelector('.jour-track__owed')).toBeNull()
  })
})

describe('GhostTrack containment', () => {
  it('keeps every station and mark inside the track panel', async () => {
    const screen = await renderTrack({ youF: 0, planF: 100 })
    const track = rect(screen.container.querySelector('.jour-track'))
    const parts = screen.container.querySelectorAll(
      '.jour-track__station-name, .jour-track__station i, ' +
      '.jour-track__you, .jour-track__plan'
    )
    expect(parts.length).toBeGreaterThan(5)
    for (const el of parts) {
      expect.soft(within(rect(el), track), el.className || el.tagName).toBe(true)
    }
  })

  it('runs the rail inside the inner span, never edge to edge', async () => {
    const screen = await renderTrack({})
    const track = rect(screen.container.querySelector('.jour-track'))
    const rail = rect(screen.container.querySelector('.jour-track__rail'))
    expect(rail.left).toBeGreaterThan(track.left + 8)
    expect(rail.right).toBeLessThan(track.right - 8)
  })
})
