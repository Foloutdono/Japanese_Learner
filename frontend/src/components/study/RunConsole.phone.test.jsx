import { describe, it, expect, beforeEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { LangProvider } from '../../LangContext'
import { RunMeter, RunFloor } from './RunConsole'
import { startTally, countReview } from '../../stores/runTally'
import { seedSummary } from '../../stores/profileSummary'
import '../../index.css'

// ── 上下 — the run's console on a phone (plan 174) ───────────────────
// The owner's pick "console C refined": the run under the head, a
// segment a rating in its verdict's ink, and the level on the floor
// with this run's XP. The frame's half (where StudyStage puts them, and
// what they replace) is held by deskfree.phone and stage.phone.

const settle = (ms = 60) => new Promise(r => setTimeout(r, ms))
const segs = root => [...root.querySelectorAll('.run-meter__s')]
const ink = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim()
const rgb = hex => `rgb(${hex.replace('#', '').match(/../g).map(h => parseInt(h, 16)).join(', ')})`

beforeEach(() => { startTally('test') })

describe('the run\'s meter', () => {
  it('draws a run with a length: the ratings in their inks, the card in hand, the rest unlit', async () => {
    countReview({ quality: 4 })
    countReview({ quality: 1 })
    countReview({ quality: 3 })
    const screen = await render(<LangProvider><RunMeter remaining={2} /></LangProvider>)
    await settle()
    const meter = screen.container.querySelector('.run-meter')
    const all = segs(meter)
    expect(all).toHaveLength(5)
    expect(all.filter(s => s.classList.contains('run-meter__s--done'))).toHaveLength(3)
    expect(all[3].classList.contains('run-meter__s--now')).toBe(true)
    // The verdicts' inks: the rating tiles' own.
    expect(getComputedStyle(all[0]).backgroundColor).toBe(rgb(ink('--teal')))
    expect(getComputedStyle(all[1]).backgroundColor).toBe(rgb(ink('--rating-wrong')))
    expect(getComputedStyle(all[2]).backgroundColor).toBe(rgb(ink('--warning')))
    expect(meter.querySelector('.run-meter__n').textContent).toBe('3/ 5')
    expect(meter.getAttribute('aria-label')).toBe('3 sur 5')
  })

  it('draws an open run as the ratings so far and the one in hand, at one width', async () => {
    countReview({ quality: 4 })
    countReview({ quality: 2 })
    const screen = await render(<LangProvider><RunMeter /></LangProvider>)
    await settle()
    const meter = screen.container.querySelector('.run-meter')
    expect(meter.classList.contains('run-meter--open')).toBe(true)
    const all = segs(meter)
    expect(all).toHaveLength(3)
    for (const s of all) expect(s.getBoundingClientRect().width).toBe(12)
    expect(meter.querySelector('.run-meter__n').textContent).toBe('2')
  })

  it('prints a practice run\'s score', async () => {
    countReview({ quality: 4 })
    const screen = await render(<LangProvider><RunMeter remaining="1 / 1" /></LangProvider>)
    await settle()
    expect(screen.container.querySelector('.run-meter__n').textContent).toBe('1 / 1')
  })

  it('closes the gaps past forty', async () => {
    const long = await render(<LangProvider><RunMeter remaining={60} /></LangProvider>)
    await settle()
    const meter = long.container.querySelector('.run-meter')
    expect(meter.classList.contains('run-meter--dense')).toBe(true)
    expect(getComputedStyle(meter.querySelector('.run-meter__segs')).columnGap).toBe('0px')
    expect(segs(meter)).toHaveLength(60)
  })
})

describe('the run\'s floor', () => {
  it('prints the level, the climb as a progressbar and this run\'s XP', async () => {
    seedSummary({ username: 'Aiko', level: 12, xp: 1658, xpPrevLevel: 1500, xpForNext: 2000 })
    countReview({ quality: 4, xp: 3 })
    countReview({ quality: 4, xp: 13 })
    const screen = await render(<LangProvider><RunFloor /></LangProvider>)
    await settle()
    const floor = screen.container.querySelector('.run-floor')
    expect(floor.classList.contains('run-floor--free')).toBe(true)
    expect(floor.querySelector('.run-floor__lv b').textContent).toBe('12')
    const track = floor.querySelector('.run-floor__track')
    expect(track.getAttribute('role')).toBe('progressbar')
    expect(track.getAttribute('aria-valuenow')).toBe('158')
    expect(track.getAttribute('aria-valuemax')).toBe('500')
    // This run's span is lit, ending where the climb ends.
    const fill = floor.querySelector('.run-floor__fill').getBoundingClientRect()
    const gain = floor.querySelector('.run-floor__gain').getBoundingClientRect()
    expect(Math.round(gain.right)).toBe(Math.round(fill.right))
    expect(floor.querySelector('.run-floor__trip').textContent).toContain('+16')
    expect(floor.querySelector('.run-floor__next')).toBeNull()
  })

  it('waits the next level at the track\'s end in the last tenth of a level', async () => {
    seedSummary({ username: 'Aiko', level: 12, xp: 1960, xpPrevLevel: 1500, xpForNext: 2000 })
    const screen = await render(<LangProvider><RunFloor /></LangProvider>)
    await settle()
    expect(screen.container.querySelector('.run-floor__next').textContent).toBe('13')
  })
})
