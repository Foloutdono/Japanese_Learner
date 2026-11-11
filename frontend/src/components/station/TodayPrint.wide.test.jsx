import { describe, it, expect, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import '../../index.css'
import { TodayPrint } from './TodayPrint'
import { printVars } from './print/usePrint'

// ── The print behind the gate, lifted once it has come (plan 208) ──
// TodayPrint draws each layer as the print has it, measures it and
// swaps in the lifted stack (print/liftPrint.js, whose own test holds
// the picture): what the gate stands on is the stack, with nothing left
// moving inside an SVG for the browser to lay out and draw every frame,
// and no CSS loop left to wake the main thread each time it turns.

describe('the print behind the gate', () => {
  it('lifts the sky, what lies behind and what stands in front, and keeps the train as it is', async () => {
    const box = { print: 'phone', u: 1, x: 0, y: 0 }
    const screen = await render(
      <div className="tdy--print" style={{ ...printVars('autumn-dusk', 'phone', box), position: 'relative', width: 390, height: 746 }}>
        <TodayPrint look="autumn-dusk" device="phone" />
      </div>,
    )
    const el = screen.container
    await vi.waitFor(() => expect(el.querySelectorAll('.tpr__layer > .tpr-lift__root')).toHaveLength(3), { timeout: 10_000 })
    expect(el.querySelectorAll('.tpr__layer > svg')).toHaveLength(0)
    expect(el.querySelectorAll('.tpr-lift__root svg [class*="tpr-"]')).toHaveLength(0)
    expect(el.querySelectorAll('.tpr-lift.tpr-gust').length).toBeGreaterThan(0)
    expect(el.querySelector('.tpr__train')).not.toBeNull()
    // Every loop handed to the Web Animations API (plan 207): none fires
    // an iteration event for React's root listener to wake the page for.
    const loops = el.querySelector('.tpr__art').getAnimations({ subtree: true }).filter(a => a.effect.target.closest('.tpr-lift__root'))
    expect(loops.length).toBeGreaterThan(100)
    expect(loops.filter(a => a instanceof CSSAnimation)).toHaveLength(0)
  })

  // 予熱 (plan 292): Today opened again takes its layers back as they
  // stood, rather than rebuilding them and handing every loop over again
  // (most of a second on a phone). Out of the page they are paused, so
  // no other screen pays for them; back, they play, and no CSS loop is
  // made afresh beside them.
  it('keeps its layers between visits, paused while away', async () => {
    const box = { print: 'phone', u: 1, x: 0, y: 0 }
    const frame = () => (
      <div className="tdy--print" style={{ ...printVars('autumn-dusk', 'phone', box), position: 'relative', width: 390, height: 746 }}>
        <TodayPrint look="autumn-dusk" device="phone" />
      </div>
    )
    const first = await render(frame())
    await vi.waitFor(() => expect(first.container.querySelectorAll('.tpr__layer > .tpr-lift__root')).toHaveLength(3), { timeout: 10_000 })
    const roots = [...first.container.querySelectorAll('.tpr-lift__root')]
    const loops = roots.flatMap(r => r.getAnimations({ subtree: true }))
    expect(loops.length).toBeGreaterThan(100)
    await first.unmount()
    expect(loops.every(a => a.playState === 'paused')).toBe(true)

    const again = await render(frame())
    await vi.waitFor(() => expect(again.container.querySelectorAll('.tpr__layer > .tpr-lift__root')).toHaveLength(3), { timeout: 10_000 })
    const back = [...again.container.querySelectorAll('.tpr-lift__root')]
    expect(back).toEqual(roots)
    expect(loops.every(a => a.playState === 'running')).toBe(true)
    const now = back.flatMap(r => r.getAnimations({ subtree: true }))
    expect(now).toHaveLength(loops.length)
    expect(now.filter(a => a instanceof CSSAnimation)).toHaveLength(0)
  })
})
