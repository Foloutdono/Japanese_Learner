import { describe, it, expect, beforeEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { LangProvider } from '../../LangContext'
import { RunFloor } from './RunConsole'
import { startTally, countReview } from '../../stores/runTally'
import { seedSummary } from '../../stores/profileSummary'
import '../../index.css'

// ── 上下 — the run's console on a phone (plan 174) ───────────────────
// The owner's pick "console C refined": the level on the floor with
// this run's XP. The meter that stood under the head is retired (plan
// 326). The frame's half (where StudyStage puts them, and
// what they replace) is held by deskfree.phone and stage.phone.

const settle = (ms = 60) => new Promise(r => setTimeout(r, ms))

beforeEach(() => { startTally('test') })

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
