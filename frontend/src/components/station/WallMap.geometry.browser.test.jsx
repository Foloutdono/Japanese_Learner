import { describe, it, expect, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { LangProvider } from '../../LangContext'
import { MemoryRouter } from 'react-router-dom'
import '../../index.css'

// ── A station is the completion of the leg behind it ─────────────
// The stations used to sit at the START of their leg, so a learner who
// had answered no N5 card at all was drawn parked on N5's platform:
// the map handed you a level for boarding the train. Now the line
// opens at 初, the novice's stop, and N5's station is the point N5 is
// finished — the same promise the pass's ghost track makes.
//
// The train and the stations are on one scale, which is what lets that
// promise be exact. They were on two: stops were spaced over (n-1)
// gaps while the train ran over n legs of work, so the two only agreed
// at the ends.
//
// Measured off the DOM's own `left` values rather than recomputed from
// the formula, which would only prove the test can do arithmetic.

vi.mock('../../lib/audio', async (o) => ({ ...(await o()), playUi: vi.fn(), playClick: vi.fn() }))
globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })
const { WallMap } = await import('./WallMap')

const SECTIONS = [
  { path: '/learn/kanji', title: 'Kanji', icon: '漢字', color: 'var(--accent)' },
]

const LEVELS = ['N5', 'N4', 'N3', 'N2', 'N1']

function tree(scores) {
  const items = { kanji: {} }
  LEVELS.forEach((lvl, i) => { items.kanji[lvl] = { total: 100, learned: 0, score: scores[i] ?? 0 } })
  return (
    <LangProvider>
      <MemoryRouter>
        <WallMap
          sections={SECTIONS}
          station={{ code: 'KJ', kana: 'かんじ', latin: 'KANJI' }}
          name="辻駅"
          stats={{ items }}
          bySource={{}}
          onDepart={() => {}}
        />
      </MemoryRouter>
    </LangProvider>
  )
}

/** The map with `score` on each of the five kanji levels.
 *  One mount per test, re-rendered rather than re-mounted for each
 *  case: the third fresh render inside a single browser test never
 *  comes up. */
function mapWith(scores) {
  return render(tree(scores))
}

const pctOf = el => parseFloat(el.style.left)

/** The line as drawn: six stations — 初, then one per level — the
 *  train, and which stations are filled. `marks` is in line order, so
 *  `marks[k]` is the station reached at k levels done. */
function geometry(container) {
  const stops = [...container.querySelectorAll('.wmap-track__stop')]
  return {
    marks: stops.map(pctOf),
    end: pctOf(container.querySelector('.wmap-track__stop--end')),
    train: pctOf(container.querySelector('.wmap-track__train')),
    past: stops.map(s => s.className.includes('--past')),
    labels: [...container.querySelectorAll('.wmap-track__label')].map(l => l.textContent),
  }
}

describe('WallMap — the train and the stations', () => {
  it('opens the line at the novice’s stop and ends it on the last level', async () => {
    // Six stations for five levels: the one you stand on having done
    // nothing, then a station per level AT its completion. The last is
    // the terminus, because finishing N1 finishes the line — there is
    // no unnamed sixth mark past it any more.
    const screen = await mapWith([0, 0, 0, 0, 0])
    const g = geometry(screen.container)
    expect(g.labels).toEqual(['初', ...LEVELS])
    expect(g.marks).toHaveLength(6)
    expect(g.end).toBeCloseTo(g.marks[5], 5)
  })

  it('leaves the novice’s stop the moment a level is begun, and reaches no level’s station early', async () => {
    // The whole point of the round. Beginning N5 must not park the
    // train on N5.
    const screen = await mapWith([0, 0, 0, 0, 0])
    const idle = geometry(screen.container)
    expect(idle.train).toBeCloseTo(idle.marks[0], 5)

    await screen.rerender(tree([0.5, 0, 0, 0, 0]))
    const half = geometry(screen.container)
    expect(half.train).toBeGreaterThan(half.marks[0])
    expect(half.train).toBeLessThan(half.marks[1])
    expect(half.train).toBeCloseTo((half.marks[0] + half.marks[1]) / 2, 5)
  })

  it('parks the train exactly on a station for every whole level finished', async () => {
    // The heart of it: n levels done puts the marker on station n, to
    // the pixel, at every point along the line — not just at the ends.
    const screen = await mapWith([0, 0, 0, 0, 0])
    for (let done = 0; done <= 5; done++) {
      await screen.rerender(tree(Array.from({ length: 5 }, (_, i) => (i < done ? 1 : 0))))
      const g = geometry(screen.container)
      expect(g.train, `${done} level(s) done should sit on station ${done}`).toBeCloseTo(g.marks[done], 5)
    }
  })

  it('puts a part-finished level between its own station and the one before', async () => {
    const screen = await mapWith([1, 0.5, 0, 0, 0])
    const g = geometry(screen.container)
    // N5 done, N4 half: past N5's station, short of N4's.
    expect(g.train).toBeGreaterThan(g.marks[1])
    expect(g.train).toBeLessThan(g.marks[2])
    expect(g.train).toBeCloseTo((g.marks[1] + g.marks[2]) / 2, 5)
  })

  it('fills a station when the train has reached it, and not before', async () => {
    // The old rule filled a dot at score >= 0.5, independently of where
    // the train was — so a half-done level showed as visited while the
    // marker was still short of it.
    const screen = await mapWith([1, 0.9, 0, 0, 0])
    const { past } = geometry(screen.container)
    // 初 is behind everyone; N5 done, so its station is reached; N4 is
    // nine tenths done, which is not done.
    expect(past).toEqual([true, true, false, false, false, false])
  })

  it('only fills the terminus when the line is finished', async () => {
    const screen = await mapWith([1, 1, 1, 1, 0.5])
    const g1 = geometry(screen.container)
    expect(g1.end).toBeGreaterThan(g1.marks[4])
    expect(g1.past[5]).toBe(false)

    await screen.rerender(tree([1, 1, 1, 1, 1]))
    const g2 = geometry(screen.container)
    expect(g2.past[5]).toBe(true)
    expect(g2.train).toBeCloseTo(g2.end, 5)
  })

  it('keeps every mark inside the rail', async () => {
    const screen = await mapWith([1, 1, 1, 1, 1])
    const g = geometry(screen.container)
    for (const p of [...g.marks, g.train]) {
      expect(p).toBeGreaterThanOrEqual(0)
      expect(p).toBeLessThanOrEqual(100)
    }
  })
})
