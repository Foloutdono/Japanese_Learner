import { describe, it, expect, beforeEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { act } from 'react'
import { LangProvider } from '../../LangContext'
import { RunStreak } from './RunStreak'
import { startTally, countReview } from '../../stores/runTally'
import '../../index.css'

// ── 連 — the run's streak stamp (plan 177) ───────────────────────────
const settle = (ms = 60) => new Promise(r => setTimeout(r, ms))
const mark = root => root.querySelector('.run-streak')

beforeEach(() => { startTally('reading:level:N5') })

describe('the run\'s streak stamp', () => {
  it('shows nothing until two answers in a row', async () => {
    const screen = await render(<LangProvider><RunStreak /></LangProvider>)
    await settle()
    expect(mark(screen.container)).toBeNull()
    await act(async () => { countReview({ quality: 4 }) })
    await settle()
    expect(mark(screen.container)).toBeNull()
  })

  it('prints the count in the lacquer stamp, names it with the best, and goes when broken', async () => {
    const screen = await render(<LangProvider><RunStreak /></LangProvider>)
    await act(async () => { countReview({ quality: 4 }); countReview({ quality: 4 }); countReview({ quality: 3 }) })
    await settle()
    const stamp = mark(screen.container)
    expect(stamp.textContent).toBe('3')
    expect(stamp.getAttribute('aria-label')).toMatch(/3/)
    expect(stamp.getAttribute('aria-label')).toMatch(/best|record/i)
    expect(stamp.className).not.toContain('run-streak--hot')

    await act(async () => { countReview({ quality: 4 }); countReview({ quality: 4 }) })
    await settle()
    expect(mark(screen.container).className).toContain('run-streak--hot')

    await act(async () => { countReview({ quality: 1 }) })
    await settle()
    expect(mark(screen.container)).toBeNull()
  })
})
