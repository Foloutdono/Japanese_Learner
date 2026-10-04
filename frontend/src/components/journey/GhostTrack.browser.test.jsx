import { describe, it, expect } from 'vitest'
import { render } from 'vitest-browser-react'
// The geometry under test is the stylesheet's; component tests do not
// import the sheet themselves (main.jsx does) — same explicit import
// every style-asserting browser test carries.
import '../../index.css'
import { LangProvider } from '../../LangContext'
import { GhostTrack } from './GhostTrack'

// ── The ghost train's line, the geometry contract ──
// One drawing on the card's back and the desk's journey body
// (GhostTrack.jsx's JourneyLine), measured here on the desk's ground.
// The rules every round kept: containment; the train's nose exactly at
// your x; the two trains and the names never sharing a pixel of height;
// the line cut at every stop; the run behind you filling leg by leg to
// the nose -- and, before 発, the siding the train waits on, filled with
// the run once it has left; the stretch owed hatched between your nose
// and the promise's.

const STATIONS = [
  { label: '発', jp: true, pos: 0 },
  { label: 'N5', pos: 21 },
  { label: 'N4', pos: 46 },
  { label: 'N3', pos: 100 },
]

function Track(props) {
  return (
    <LangProvider>
      <div style={{ width: '640px' }}>
        <GhostTrack stations={STATIONS} youF={20} {...props} />
      </div>
    </LangProvider>
  )
}
const renderTrack = props => render(<Track {...props} />)

const rect = el => el.getBoundingClientRect()
const within = (inner, outer, eps = 0.5) =>
  inner.left >= outer.left - eps && inner.right <= outer.right + eps
const q = (screen, sel) => screen.container.querySelector(sel)
const qa = (screen, sel) => [...screen.container.querySelectorAll(sel)]
// Where a percentage of the line falls, in the page's px.
const at = (screen, pct) => {
  const span = rect(q(screen, '.jline__span'))
  return span.left + (span.width * pct) / 100
}
const you = screen => rect(q(screen, '.jline__car--you svg'))
const ghost = screen => rect(q(screen, '.jline__car--ghost svg'))

describe('GhostTrack the trains', () => {
  it('puts the train\'s nose exactly at your position', async () => {
    for (const youF of [0, 43.5, 100]) {
      const screen = await renderTrack({ youF })
      expect.soft(Math.abs(you(screen).right - at(screen, youF)), `at ${youF}%`).toBeLessThan(0.5)
    }
  })

  it('puts the promise\'s ghost nose at the promise, above your train', async () => {
    const screen = await renderTrack({ youF: 50, planF: 50 })
    expect(Math.abs(ghost(screen).right - at(screen, 50))).toBeLessThan(0.5)
    // Two trains at one x never collide: the ghost rides a lane above.
    expect(ghost(screen).bottom).toBeLessThanOrEqual(you(screen).top + 0.5)
  })

  it('stands the train on the line', async () => {
    const screen = await renderTrack({ youF: 30 })
    for (const leg of qa(screen, '.jline__leg')) {
      expect.soft(Math.abs(you(screen).bottom - rect(leg).top)).toBeLessThan(1.5)
    }
  })

  it('never hides a stop under the train, at any width', async () => {
    const screen = await renderTrack({ youF: 43.5, planF: 46 })
    for (const name of qa(screen, '.jline__stop b')) {
      expect.soft(you(screen).bottom, 'the train reaches into the names\' lane').toBeLessThanOrEqual(rect(name).top + 0.5)
      expect.soft(ghost(screen).bottom).toBeLessThanOrEqual(rect(name).top + 0.5)
    }
  })

  it('carries no word on the promise', async () => {
    const screen = await renderTrack({ youF: 30, planF: 55 })
    expect(q(screen, '.jline__car--ghost').textContent).toBe('')
  })
})

describe('GhostTrack the line', () => {
  it('cuts the line at every stop between two legs', async () => {
    const screen = await renderTrack({})
    const legs = qa(screen, '.jline__leg').map(rect)
    expect(legs).toHaveLength(STATIONS.length - 1)
    for (const [i, pos] of [[1, 21], [2, 46]]) {
      const x = at(screen, pos)
      expect.soft(legs[i - 1].right, `the leg before ${pos}%`).toBeLessThan(x - 1)
      expect.soft(legs[i].left, `the leg after ${pos}%`).toBeGreaterThan(x + 1)
      expect.soft(legs[i].left - legs[i - 1].right).toBeLessThan(6)
    }
  })

  it('names each stop under its own cut, the ends inside the line', async () => {
    const screen = await renderTrack({})
    const names = qa(screen, '.jline__stop b')
    expect(names.map(n => n.textContent)).toEqual(['発', 'N5', 'N4', 'N3'])
    for (const i of [1, 2]) {
      const r = rect(names[i])
      expect.soft(Math.abs((r.left + r.right) / 2 - at(screen, STATIONS[i].pos)), STATIONS[i].label).toBeLessThan(1)
    }
    expect(Math.abs(rect(names[0]).left - at(screen, 0))).toBeLessThan(1)
    expect(Math.abs(rect(names[3]).right - at(screen, 100))).toBeLessThan(1)
  })

  it('fills the legs behind the train and ends the run at its nose', async () => {
    const screen = await renderTrack({ youF: 30 })
    const legs = qa(screen, '.jline__leg').map(rect)
    const done = qa(screen, '.jline__done').map(rect)
    expect(done).toHaveLength(2)
    expect(Math.abs(done[0].width - legs[0].width)).toBeLessThan(0.5)
    expect(Math.abs(done[1].left - legs[1].left)).toBeLessThan(0.5)
    expect(Math.abs(done[1].right - you(screen).right)).toBeLessThan(0.5)
  })

  it('marks the stops passed and the one ahead', async () => {
    const screen = await renderTrack({ youF: 30 })
    const states = qa(screen, '.jline__stop').map(el =>
      el.classList.contains('jline__stop--passed') ? 'passed'
        : el.classList.contains('jline__stop--next') ? 'next' : 'ahead')
    expect(states).toEqual(['passed', 'passed', 'next', 'ahead'])
  })

  it('draws one leg for a line with no destination yet', async () => {
    const screen = await renderTrack({ stations: [{ label: '発', jp: true, pos: 0 }], youF: 0 })
    expect(qa(screen, '.jline__leg')).toHaveLength(1)
  })

  it('keeps the train on its siding before 発 until the journey starts', async () => {
    const screen = await renderTrack({ youF: 0 })
    const siding = rect(q(screen, '.jline__siding'))
    const origin = at(screen, 0)
    expect(you(screen).right).toBeLessThanOrEqual(origin + 0.5)
    expect(siding.right).toBeLessThan(origin - 1)
    // The siding holds the whole train.
    expect(siding.left).toBeLessThanOrEqual(you(screen).left + 2.5)
  })

  it('fills the siding with the run once the train has left 発', async () => {
    const screen = await renderTrack({ youF: 0 })
    const siding = () => getComputedStyle(q(screen, '.jline__siding')).backgroundColor
    expect(siding()).toBe(getComputedStyle(q(screen, '.jline__leg')).backgroundColor)
    await screen.rerender(<Track youF={5} />)
    expect(siding()).toBe(getComputedStyle(q(screen, '.jline__done')).backgroundColor)
  })
})

describe('GhostTrack the stretch owed', () => {
  it('hatches exactly the run between the train and the promise', async () => {
    const screen = await renderTrack({ youF: 30, planF: 55 })
    const gap = rect(q(screen, '.jline__gap'))
    expect(Math.abs(gap.left - you(screen).right)).toBeLessThan(1)
    expect(Math.abs(gap.right - ghost(screen).right)).toBeLessThan(1)
  })

  it('hatches the other way round when the train is ahead of the promise', async () => {
    const screen = await renderTrack({ youF: 55, planF: 30 })
    const gap = rect(q(screen, '.jline__gap'))
    expect(Math.abs(gap.left - ghost(screen).right)).toBeLessThan(1)
    expect(Math.abs(gap.right - you(screen).right)).toBeLessThan(1)
  })

  it('draws no promise and no hatching on a goal-less pass', async () => {
    const screen = await renderTrack({ planF: null })
    expect(q(screen, '.jline__car--ghost')).toBeNull()
    expect(q(screen, '.jline__gap')).toBeNull()
  })

  it('measures nothing under a percent of the line', async () => {
    const screen = await renderTrack({ youF: 40, planF: 40.5 })
    expect(q(screen, '.jline__gap')).toBeNull()
  })
})

describe('GhostTrack containment', () => {
  it('keeps every stop, leg and train inside the drawing', async () => {
    for (const [youF, planF] of [[0, 100], [100, 0]]) {
      const screen = await renderTrack({ youF, planF })
      const track = rect(q(screen, '.jour-track'))
      const parts = qa(screen,
        '.jline__stop b, .jline__siding, .jline__leg, .jline__done, .jline__car svg')
      expect(parts.length).toBeGreaterThan(8)
      for (const el of parts) {
        const r = rect(el)
        expect.soft(within(r, track), `${el.className.baseVal ?? el.className} at ${youF}%`).toBe(true)
        expect.soft(r.top).toBeGreaterThanOrEqual(track.top - 0.5)
        expect.soft(r.bottom).toBeLessThanOrEqual(track.bottom + 0.5)
      }
    }
  })
})
