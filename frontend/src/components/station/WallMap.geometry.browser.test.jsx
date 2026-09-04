import { describe, it, expect, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { LangProvider } from '../../LangContext'
import { MemoryRouter } from 'react-router-dom'
import '../../index.css'

// ── The train and the stations are on one scale ─────────────────
// They were on two. Stops were spaced over (n-1) gaps while the train
// ran over n legs of work, so the two only agreed at the ends: finish
// three of five levels and the marker sat at 59% while the dot it had
// just filled was at 72.5%. A route map whose train lags the stations
// it has passed is worse than no map.
//
// Measured off the DOM's own `left` values rather than recomputed from
// the formula, which would only prove the test can do arithmetic.

vi.mock('../../lib/audio', async (o) => ({ ...(await o()), playUi: vi.fn(), playClick: vi.fn() }))
globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })
const { WallMap } = await import('./WallMap')

const SECTIONS = [
  { path: '/kanji', title: 'Kanji', icon: '漢字', color: 'var(--accent)' },
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
          name="日本語駅"
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

function geometry(container) {
  return {
    stops: [...container.querySelectorAll('.wmap-track__stop:not(.wmap-track__stop--end)')].map(pctOf),
    end: pctOf(container.querySelector('.wmap-track__stop--end')),
    train: pctOf(container.querySelector('.wmap-track__train')),
    past: [...container.querySelectorAll('.wmap-track__stop')].map(s => s.className.includes('--past')),
  }
}

describe('WallMap — the train and the stations', () => {
  it('parks the train exactly on a station for every whole level finished', async () => {
    // The heart of it: n levels done puts the marker on station n, to
    // the pixel, at every point along the line — not just at the ends.
    const screen = await mapWith([0, 0, 0, 0, 0])
    for (let done = 0; done <= 5; done++) {
      await screen.rerender(tree(Array.from({ length: 5 }, (_, i) => (i < done ? 1 : 0))))
      const g = geometry(screen.container)
      const target = done === 5 ? g.end : g.stops[done]
      expect(g.train, `${done} level(s) done should sit on station ${done}`).toBeCloseTo(target, 5)
    }
  })

  it('puts a part-finished level between its station and the next', async () => {
    const screen = await mapWith([1, 0.5, 0, 0, 0])
    const g = geometry(screen.container)
    expect(g.train).toBeGreaterThan(g.stops[1])
    expect(g.train).toBeLessThan(g.stops[2])
    // Halfway through the leg, so halfway between the two stations.
    expect(g.train).toBeCloseTo((g.stops[1] + g.stops[2]) / 2, 5)
  })

  it('fills a dot when the train has passed it, and not before', async () => {
    // The old rule filled a dot at score >= 0.5, independently of where
    // the train was — so a half-done level showed as visited while the
    // marker was still short of it.
    const screen = await mapWith([1, 0.9, 0, 0, 0])
    const { past } = geometry(screen.container)
    // N5 done -> the train is on N4's platform, so N5 is behind it.
    expect(past.slice(0, 5)).toEqual([true, false, false, false, false])
  })

  it('draws a terminus past the last level, and only fills it when the line is done', async () => {
    // The stations sit one leg apart now, so the last leg's rail runs
    // past N1; without an end mark the track just frays.
    const screen = await mapWith([1, 1, 1, 1, 0.5])
    const g1 = geometry(screen.container)
    expect(g1.end).toBeGreaterThan(g1.stops[4])
    expect(g1.past[5]).toBe(false)

    await screen.rerender(tree([1, 1, 1, 1, 1]))
    const g2 = geometry(screen.container)
    expect(g2.past[5]).toBe(true)
    expect(g2.train).toBeCloseTo(g2.end, 5)
  })

  it('keeps every mark inside the rail', async () => {
    const screen = await mapWith([1, 1, 1, 1, 1])
    const g = geometry(screen.container)
    for (const p of [...g.stops, g.end, g.train]) {
      expect(p).toBeGreaterThanOrEqual(0)
      expect(p).toBeLessThanOrEqual(100)
    }
  })
})
