import { describe, it, expect, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import '../../index.css'
import { LangProvider } from '../../LangContext'
import { RetentionLine } from './RetentionLine'
import { weeklyRetention } from '../../domain/statsModel'

// ── The line leaves from the left, every stop can be asked ──
// (plan 085, the owner's second look). The axis runs from the first
// ridden week to this week, so the first stop stands at the left edge
// of the drawing whatever the calendar says; a sweep along the line
// picks the nearest week; a single ridden week is one stop and the
// rail ahead.

const TODAY = new Date(2026, 8, 16, 12)

function draw(days, props = {}) {
  const r = weeklyRetention(days, { today: TODAY })
  return render(
    <LangProvider>
      <div style={{ width: '326px' }}>
        <RetentionLine weeks={r.weeks} currentIndex={r.currentIndex} firstIndex={r.firstIndex} {...props} />
      </div>
    </LangProvider>
  )
}

describe('the retention line', () => {
  it('starts at the left edge when the first ridden week is recent', async () => {
    const screen = await draw([
      { date: '2026-09-01', reviews: 10, good: 8 },   // three weeks ago
      { date: '2026-09-15', reviews: 10, good: 9 },   // this week
    ])
    const svg = screen.container.querySelector('.rep-line__svg').getBoundingClientRect()
    const stops = [...screen.container.querySelectorAll('.rep-line__stop, .rep-line__now')].map(c => c.getBoundingClientRect())
    expect(stops).toHaveLength(2)
    expect(stops[0].left - svg.left).toBeLessThan(12)
    expect(svg.right - stops[1].right).toBeLessThan(12)
    // Two ridden weeks with one empty between: a dashed bridge, no solid path.
    expect(screen.container.querySelector('.rep-line__bridge')).not.toBeNull()
    expect(screen.container.querySelector('.rep-line__path')).toBeNull()
  })

  it('one ridden week is one stop at the left and the rail ahead', async () => {
    const screen = await draw([{ date: '2026-09-15', reviews: 4, good: 4 }])
    const svg = screen.container.querySelector('.rep-line__svg').getBoundingClientRect()
    const now = screen.container.querySelector('.rep-line__now').getBoundingClientRect()
    expect(now.left - svg.left).toBeLessThan(12)
    expect(screen.container.querySelector('.rep-line__ahead')).not.toBeNull()
    expect(screen.container.querySelector('.rep-axis').textContent).not.toMatch(/ago|il y a/)
  })

  it('a press near a stop selects that week', async () => {
    const onSelect = vi.fn()
    const screen = await draw([
      { date: '2026-09-01', reviews: 10, good: 8 },
      { date: '2026-09-08', reviews: 10, good: 5 },
      { date: '2026-09-15', reviews: 10, good: 9 },
    ], { onSelect })
    const svg = screen.container.querySelector('.rep-line__svg')
    const box = svg.getBoundingClientRect()
    svg.dispatchEvent(new PointerEvent('pointerdown', { clientX: box.left + box.width / 2, bubbles: true, pointerId: 1 }))
    expect(onSelect).toHaveBeenCalledWith(10)   // the middle week, index 10 of 12
    svg.dispatchEvent(new PointerEvent('pointerdown', { clientX: box.left + 2, bubbles: true, pointerId: 1 }))
    expect(onSelect).toHaveBeenLastCalledWith(9)
  })

  it('the selected week wears the ring; by default that is this week', async () => {
    const screen = await draw([
      { date: '2026-09-08', reviews: 10, good: 5 },
      { date: '2026-09-15', reviews: 10, good: 9 },
    ], { selected: 10 })
    const ring = screen.container.querySelector('.rep-line__sel').getBoundingClientRect()
    const stops = [...screen.container.querySelectorAll('.rep-line__stop, .rep-line__now')].map(c => c.getBoundingClientRect())
    const cx = r => r.left + r.width / 2
    expect(Math.abs(cx(ring) - cx(stops[0]))).toBeLessThan(1)
  })

  it('the ring on a stop at 100% at the right end is drawn whole inside the svg', async () => {
    const screen = await draw([
      { date: '2026-09-08', reviews: 10, good: 5 },
      { date: '2026-09-15', reviews: 10, good: 10 },
    ])
    const svg = screen.container.querySelector('.rep-line__svg').getBoundingClientRect()
    const ring = screen.container.querySelector('.rep-line__sel').getBoundingClientRect()
    expect(ring.right).toBeLessThanOrEqual(svg.right + 0.5)
    expect(ring.top).toBeGreaterThanOrEqual(svg.top - 0.5)
  })
})
