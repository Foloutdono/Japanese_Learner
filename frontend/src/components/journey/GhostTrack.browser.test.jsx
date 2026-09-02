import { describe, it, expect } from 'vitest'
import { render } from 'vitest-browser-react'
// The geometry under test is the stylesheet's; component tests do not
// import the sheet themselves (main.jsx does) — same explicit import
// every style-asserting browser test carries.
import '../../index.css'
import { GhostTrack } from './GhostTrack'

// ── The two-lane track's geometry contract (plan 063, round IV.1) ──
// Four rules, each pinned here because each was a shipped defect in an
// earlier mockup round: lanes that can never collide, a coordinate
// span nothing paints outside of, a rail that runs stop-centre to
// stop-centre, and a bracket label that picks the side with room.

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

describe('GhostTrack lanes', () => {
  it('parks YOU and PLAN at the same x without collision', async () => {
    const screen = await renderTrack({ youF: 50, planF: 50, gapDeltaDays: 0 })
    const you = screen.container.querySelector('.jour-track__you')
    const plan = screen.container.querySelector('.jour-track__plan')
    expect(you).not.toBeNull()
    expect(plan).not.toBeNull()
    expect(getComputedStyle(you).top).not.toBe(getComputedStyle(plan).top)
    const ry = rect(you)
    const rp = rect(plan)
    const overlapV = Math.min(ry.bottom, rp.bottom) - Math.max(ry.top, rp.top)
    expect(overlapV).toBeLessThanOrEqual(0)
  })

  it('draws no plan lane and no bracket on a goal-less pass', async () => {
    const screen = await renderTrack({ planF: null, gapDeltaDays: 40 })
    expect(screen.container.querySelector('.jour-track__plan')).toBeNull()
    expect(screen.container.querySelector('.jour-track__gap')).toBeNull()
  })
})

describe('GhostTrack containment', () => {
  it('keeps every station, car and bracket inside the track panel', async () => {
    const screen = await renderTrack({ youF: 0, planF: 100, gapDeltaDays: 200 })
    const track = rect(screen.container.querySelector('.jour-track'))
    const parts = screen.container.querySelectorAll(
      '.jour-track__station-name, .jour-track__station i, ' +
      '.jour-track__you, .jour-track__plan, .jour-track__gap b'
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

describe('GhostTrack bracket label placement', () => {
  it('centres the label inside a wide bracket', async () => {
    const screen = await renderTrack({ youF: 10, planF: 60, gapDeltaDays: 30, gapLabel: '+30 days' })
    const gap = screen.container.querySelector('.jour-track__gap')
    const label = gap.querySelector('b')
    expect(gap.className).not.toContain('--tight')
    const rg = rect(gap)
    const rl = rect(label)
    expect(Math.abs((rl.left + rl.right) / 2 - (rg.left + rg.right) / 2)).toBeLessThan(2)
  })

  it('hangs the label off the right end of a narrow bracket', async () => {
    const screen = await renderTrack({ youF: 10, planF: 16, gapDeltaDays: 10, gapLabel: '+10 days' })
    const gap = screen.container.querySelector('.jour-track__gap')
    expect(gap.className).toContain('--tight')
    expect(rect(gap.querySelector('b')).left).toBeGreaterThanOrEqual(rect(gap).right)
  })

  it('hangs the label off the LEFT end when the narrow bracket rides the right edge', async () => {
    const screen = await renderTrack({ youF: 80, planF: 86, gapDeltaDays: 10, gapLabel: '+10 days' })
    const gap = screen.container.querySelector('.jour-track__gap')
    expect(gap.className).toContain('--left')
    expect(rect(gap.querySelector('b')).right).toBeLessThanOrEqual(rect(gap).left)
  })

  it('measures nothing under three days or three percent', async () => {
    let screen = await renderTrack({ youF: 40, planF: 42, gapDeltaDays: 30 })
    expect(screen.container.querySelector('.jour-track__gap')).toBeNull()
    screen = await renderTrack({ youF: 40, planF: 60, gapDeltaDays: 2 })
    expect(screen.container.querySelector('.jour-track__gap')).toBeNull()
  })
})
