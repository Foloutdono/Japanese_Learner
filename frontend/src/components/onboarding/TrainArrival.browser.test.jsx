import { describe, it, expect, vi, afterEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { TrainArrival } from './TrainArrival'

// ── The arrival cutscene's two contracts ───────────────────────
// Same contracts its siblings (TicketGate/TrainDoor) live by: under
// reduced motion it never mounts and hands control back synchronously;
// under normal motion any input skips straight to the end, once.

const settle = ms => new Promise(r => setTimeout(r, ms))
const realMatchMedia = window.matchMedia

afterEach(() => { window.matchMedia = realMatchMedia })

describe('TrainArrival', () => {
  it('reduced motion: fires onDone synchronously and mounts nothing', async () => {
    window.matchMedia = vi.fn(q => ({
      matches: String(q).includes('prefers-reduced-motion'),
      addEventListener() {}, removeEventListener() {},
    }))
    const onDone = vi.fn()
    await render(<TrainArrival jp="案内" title="Tour" onDone={onDone} />)
    await settle(50)
    expect(onDone).toHaveBeenCalledTimes(1)
    expect(document.querySelector('.arrival')).toBeNull()
  })

  it('any input skips: the timeline clears and onDone fires exactly once', async () => {
    const onDone = vi.fn()
    await render(<TrainArrival jp="案内" title="Tour" onDone={onDone} />)
    await settle(50)
    expect(document.querySelector('.arrival')).not.toBeNull()
    expect(onDone).not.toHaveBeenCalled()

    window.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    await settle(50)
    expect(onDone).toHaveBeenCalledTimes(1)

    // The cleared timers must not fire a second onDone later.
    await settle(1300)
    expect(onDone).toHaveBeenCalledTimes(1)
  })

  it('left alone, the timeline reaches onDone on its own', async () => {
    const onDone = vi.fn()
    await render(<TrainArrival jp="案内" title="Tour" onDone={onDone} />)
    await settle(1300) // DONE_MS = 780 × 1.4 ≈ 1092ms
    expect(onDone).toHaveBeenCalledTimes(1)
  })
})
