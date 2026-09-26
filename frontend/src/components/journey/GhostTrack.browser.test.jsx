import { describe, it, expect } from 'vitest'
import { render } from 'vitest-browser-react'
// The geometry under test is the stylesheet's; component tests do not
// import the sheet themselves (main.jsx does) — same explicit import
// every style-asserting browser test carries.
import '../../index.css'
import { GhostTrack } from './GhostTrack'

// ── The one-rail track's geometry contract (区間・新幹線 round) ──
// The 進捗が主役 round pinned containment, a rail running stop-centre
// to stop-centre, a train that reaches the rail and never hides a stop,
// and hatching that spans exactly what is owed. All of those survive,
// restated for the new parts: the train stands ON the line with its
// nose at your x, and the rail is legs cut at every stop. New with the
// round: the cut is where a stop is, the run behind you fills leg by
// leg and ends at the nose, and the train waits on a siding before 発.

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
const q = (screen, sel) => screen.container.querySelector(sel)
const qa = (screen, sel) => [...screen.container.querySelectorAll(sel)]
// Where a percentage of the line falls, in the page's px.
const at = (screen, pct) => {
  const span = rect(q(screen, '.jour-track__span'))
  return span.left + (span.width * pct) / 100
}

describe('GhostTrack marks', () => {
  it('puts the train\'s nose exactly at your position', async () => {
    for (const youF of [0, 43.5, 100]) {
      const screen = await renderTrack({ youF })
      expect.soft(Math.abs(rect(q(screen, '.jour-track__you')).right - at(screen, youF)), `at ${youF}%`)
        .toBeLessThan(0.5)
    }
  })

  it('parks the train and the promise at the same x without collision', async () => {
    const screen = await renderTrack({ youF: 50, planF: 50 })
    const plan = rect(q(screen, '.jour-track__plan'))
    // The promise is a line, not a box: nothing to keep apart from.
    expect(plan.width).toBeLessThan(3)
    expect(Math.abs((plan.left + plan.right) / 2 - rect(q(screen, '.jour-track__you')).right)).toBeLessThan(2)
  })

  it('stands the train on the line', async () => {
    const screen = await renderTrack({ youF: 30 })
    const you = rect(q(screen, '.jour-track__you'))
    for (const leg of qa(screen, '.jour-track__leg')) {
      expect.soft(Math.abs(you.bottom - rect(leg).top)).toBeLessThan(0.5)
    }
  })

  it('never hides a stop under the train, at any width', async () => {
    // 46 is a stop; 43.5 is where the learner stands. The rule is
    // stated VERTICALLY on purpose: how close the two come horizontally
    // depends on the width the sheet is read at, so "they never share a
    // pixel of height" is the only form of this rule that travels. The
    // cut itself is on the line, under the train's wheels, never behind
    // its body.
    const screen = await renderTrack({ youF: 43.5 })
    const you = rect(q(screen, '.jour-track__you'))
    for (const name of qa(screen, '.jour-track__station-name')) {
      expect.soft(you.bottom, 'the train reaches into the names\' lane').toBeLessThanOrEqual(rect(name).top + 0.5)
    }
    for (const leg of qa(screen, '.jour-track__leg')) {
      expect.soft(you.bottom).toBeLessThanOrEqual(rect(leg).top + 0.5)
    }
  })
})

describe('GhostTrack the line', () => {
  it('cuts the line at every stop between two legs', async () => {
    const screen = await renderTrack({})
    const legs = qa(screen, '.jour-track__leg').map(rect)
    expect(legs).toHaveLength(STATIONS.length - 1)
    for (const [i, pos] of [[1, 21], [2, 46]]) {
      const x = at(screen, pos)
      expect.soft(legs[i - 1].right, `the leg before ${pos}%`).toBeLessThan(x - 1)
      expect.soft(legs[i].left, `the leg after ${pos}%`).toBeGreaterThan(x + 1)
      expect.soft(legs[i].left - legs[i - 1].right).toBeLessThan(6)
    }
  })

  it('names each stop under its own cut', async () => {
    const screen = await renderTrack({})
    const names = qa(screen, '.jour-track__station-name')
    expect(names.map(n => n.textContent)).toEqual(['発', 'N5', 'N4', 'N3'])
    for (const [i, st] of STATIONS.entries()) {
      const r = rect(names[i])
      expect.soft(Math.abs((r.left + r.right) / 2 - at(screen, st.pos)), st.label).toBeLessThan(1)
    }
  })

  it('fills the legs behind the train and ends the run at its nose', async () => {
    const screen = await renderTrack({ youF: 30 })
    const legs = qa(screen, '.jour-track__leg').map(rect)
    const done = qa(screen, '.jour-track__done').map(rect)
    // The first leg is run in full, the second up to the nose, the
    // third not at all.
    expect(done).toHaveLength(2)
    expect(Math.abs(done[0].width - legs[0].width)).toBeLessThan(0.5)
    expect(Math.abs(done[1].left - legs[1].left)).toBeLessThan(0.5)
    expect(Math.abs(done[1].right - rect(q(screen, '.jour-track__you')).right)).toBeLessThan(0.5)
  })

  it('marks the stops passed and the one ahead', async () => {
    const screen = await renderTrack({ youF: 30 })
    const states = qa(screen, '.jour-track__station').map(el =>
      el.classList.contains('jour-track__station--passed') ? 'passed'
        : el.classList.contains('jour-track__station--next') ? 'next' : 'ahead')
    expect(states).toEqual(['passed', 'passed', 'next', 'ahead'])
    // The leg being ridden is the second one, and only it.
    expect(qa(screen, '.jour-track__leg').map(el => el.classList.contains('jour-track__leg--now')))
      .toEqual([false, true, false])
  })

  it('draws one leg for a line with no destination yet', async () => {
    const screen = await renderTrack({ stations: [{ label: '発', jp: true, pos: 0 }], youF: 0 })
    expect(qa(screen, '.jour-track__leg')).toHaveLength(1)
  })

  it('keeps the train on its siding before 発 until the journey starts', async () => {
    const screen = await renderTrack({ youF: 0 })
    const you = rect(q(screen, '.jour-track__you'))
    const siding = rect(q(screen, '.jour-track__siding'))
    const origin = at(screen, 0)
    expect(you.right).toBeLessThanOrEqual(origin + 0.5)
    expect(siding.right).toBeLessThan(origin - 1)
    // The siding holds the whole train.
    expect(siding.left).toBeLessThanOrEqual(you.left + 2.5)
  })
})

describe('GhostTrack the stretch owed', () => {
  it('hatches exactly the run between the train and the promise', async () => {
    const screen = await renderTrack({ youF: 30, planF: 55 })
    const owed = rect(q(screen, '.jour-track__owed'))
    const you = rect(q(screen, '.jour-track__you'))
    const plan = rect(q(screen, '.jour-track__plan'))
    expect(Math.abs(owed.left - you.right)).toBeLessThan(2)
    expect(Math.abs(owed.right - (plan.left + plan.right) / 2)).toBeLessThan(2)
  })

  it('hatches the other way round when the train is ahead of the promise', async () => {
    const screen = await renderTrack({ youF: 55, planF: 30 })
    const owed = rect(q(screen, '.jour-track__owed'))
    const plan = rect(q(screen, '.jour-track__plan'))
    expect(Math.abs(owed.left - (plan.left + plan.right) / 2)).toBeLessThan(2)
    expect(Math.abs(owed.right - rect(q(screen, '.jour-track__you')).right)).toBeLessThan(2)
  })

  it('draws no promise and no hatching on a goal-less pass', async () => {
    const screen = await renderTrack({ planF: null })
    expect(q(screen, '.jour-track__plan')).toBeNull()
    expect(q(screen, '.jour-track__owed')).toBeNull()
  })

  it('measures nothing under a percent of the line', async () => {
    const screen = await renderTrack({ youF: 40, planF: 40.5 })
    expect(q(screen, '.jour-track__owed')).toBeNull()
  })
})

describe('GhostTrack containment', () => {
  it('keeps every stop, leg and mark inside the track panel', async () => {
    for (const [youF, planF] of [[0, 100], [100, 0]]) {
      const screen = await renderTrack({ youF, planF })
      const track = rect(q(screen, '.jour-track'))
      const parts = qa(screen,
        '.jour-track__station-name, .jour-track__siding, .jour-track__leg, ' +
        '.jour-track__done, .jour-track__you, .jour-track__plan')
      expect(parts.length).toBeGreaterThan(8)
      for (const el of parts) {
        expect.soft(within(rect(el), track), `${el.className} at ${youF}%`).toBe(true)
      }
      expect.soft(rect(q(screen, '.jour-track__you')).top).toBeGreaterThanOrEqual(track.top)
      for (const name of qa(screen, '.jour-track__station-name')) {
        expect.soft(rect(name).bottom).toBeLessThanOrEqual(track.bottom + 0.5)
      }
    }
  })

  it('runs the line stop-centre to stop-centre, inside the inner span', async () => {
    const screen = await renderTrack({})
    const track = rect(q(screen, '.jour-track'))
    const legs = qa(screen, '.jour-track__leg').map(rect)
    // The last leg runs to the terminus itself; the first starts at the
    // cut after 発.
    expect(Math.abs(legs.at(-1).right - at(screen, 100))).toBeLessThan(0.5)
    expect(legs[0].left).toBeGreaterThan(at(screen, 0))
    expect(legs[0].left - at(screen, 0)).toBeLessThan(3)
    expect(legs.at(-1).right).toBeLessThan(track.right - 8)
  })
})
