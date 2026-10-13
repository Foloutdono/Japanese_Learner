import { describe, it, expect, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import '../../index.css'
import { TodayPrint } from './TodayPrint'
import { printVars } from './print/usePrint'

// ── The print behind the gate, lifted once it has come (plan 206) ──
// TodayPrint draws each layer as the print has it, measures it and
// swaps in the lifted stack (print/liftPrint.js, whose own test holds
// the picture): what the gate stands on is the stack, with nothing left
// moving inside an SVG for the browser to lay out and draw every frame,
// and no CSS loop left to wake the main thread each time it turns.

describe('the print behind the gate', () => {
  it('lifts the sky, what lies behind and what stands in front, and keeps the train as it is', async () => {
    const box = { print: 'phone', u: 1, x: 0, y: 0 }
    const screen = await render(
      <div className="tdy--print" style={{ ...printVars('dusk', 'phone', box), position: 'relative', width: 390, height: 746 }}>
        <TodayPrint hour="dusk" device="phone" />
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
})
