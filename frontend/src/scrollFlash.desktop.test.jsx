import { describe, it, expect, afterEach } from 'vitest'
import { render } from 'vitest-browser-react'
import './index.css'

// ── 机 — no scrollbar while a screen arrives ─────────────────────────
// A pointer draws a classic scrollbar on any box with anything to
// scroll, for as long as it has it -- a few hundred milliseconds is
// enough to see. Two boxes had something to scroll only while a
// screen was still arriving, measured frame by frame on the running
// app at 1440 and 1100:
//   - the page, by 10px, on every change of screen: a screen arrives
//     rising 10px (@keyframes arrive), and on the desk nothing is
//     docked under it, so a screen that fits ends on the page's floor
//     and stood 10px past it until it landed. .phone clips it.
//   - a boarding step's body, by the rise of its last answer (6px; the
//     pass, 40px), at every step: on the desk the body is sized to what
//     it holds. It keeps the room inside and gives it back outside.
// Each is caught at its arrival's first frame, every animation paused
// where it starts. The phone draws the same screens with the tab bar's
// room under them, and passed the same measure untouched.

const cssPx = name => parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name))
// Every animation held at its first frame: still low, not yet risen.
// Only the ones in time: the boarding body's scrim (plan 164) runs on
// the body's own scroll, has no first frame in milliseconds, and moves
// nothing -- it is a mask's depth.
const timed = () => document.getAnimations().filter(a => a.timeline === document.timeline)
function firstFrame() {
  for (const a of timed()) { a.pause(); a.currentTime = 0 }
}
function landed() {
  for (const a of timed()) a.finish()
}
const overflowY = el => el.scrollHeight - el.clientHeight

afterEach(() => {
  landed()
  delete document.documentElement.dataset.chrome
  window.scrollTo(0, 0)
})

describe('the page', () => {
  function Screen({ tall = false }) {
    return (
      <div className="phone phone--desk">
        <div className="phone__content">
          <main className="learn">
            {tall && <div className="probe-sticky" style={{ position: 'sticky', top: 0, height: 20 }} />}
            <div className="plate" style={{ height: tall ? 3000 : 120 }}>a screen</div>
          </main>
        </div>
      </div>
    )
  }

  it('prints no scrollbar while a screen that fits arrives', async () => {
    document.documentElement.dataset.chrome = 'shell'
    await render(<Screen />)
    firstFrame()
    expect(getComputedStyle(document.querySelector('main')).transform).not.toBe('none')
    expect(overflowY(document.scrollingElement)).toBeLessThanOrEqual(0)
  })

  it('still scrolls the whole of a screen that does not fit, sticky and all', async () => {
    document.documentElement.dataset.chrome = 'shell'
    await render(<Screen tall />)
    landed()
    const end = document.querySelector('main').getBoundingClientRect().bottom + window.scrollY
    expect(document.scrollingElement.scrollHeight).toBeGreaterThanOrEqual(Math.floor(end))
    // A clip, not a scroller: what sticks to the page still sticks.
    window.scrollTo(0, 1500)
    await new Promise(r => setTimeout(r, 50))
    expect(Math.round(document.querySelector('.probe-sticky').getBoundingClientRect().top)).toBe(0)
  })
})

describe('a boarding step on the desk', () => {
  // A step as BoardingFlow draws it while the step before it pulls out.
  function Step({ step = 'why', children }) {
    return (
      <main className="brd desk-brd" data-step={step}>
        <div className="brd__cars">
          <div className="brd__car brd__car--in" data-dir="forward">
            {children}
            <div className="brd__foot"><button type="button" className="btn-depart">Continuer</button></div>
          </div>
        </div>
      </main>
    )
  }
  const answers = (
    <div className="brd__body">
      <h1 className="brd__q">Pourquoi ?</h1>
      <div className="brd__air" />
      <div className="brd__stage">
        <div className="brd__opts">
          {['Anime', 'Voyage', 'Travail', 'Famille', 'Culture', 'Autre'].map(a => (
            <button type="button" className="brd-opt" key={a}><span className="brd-opt__names">{a}</span></button>
          ))}
        </div>
      </div>
    </div>
  )
  const body = () => document.querySelector('.brd__car > .brd__body')

  it('prints no scrollbar while its answers arrive', async () => {
    await render(<Step>{answers}</Step>)
    firstFrame()
    expect(getComputedStyle(document.querySelector('.brd-opt:last-child')).transform).not.toBe('none')
    expect(overflowY(body())).toBeLessThanOrEqual(0)
  })

  it('prints none while the pass rises into the last step', async () => {
    await render(
      <Step step="pass">
        <div className="brd__body">
          <div className="brd-offer"><h1 className="brd__q">Ta carte est prête.</h1></div>
          <div className="brd__air" />
          <div className="brd__stage"><div className="brd-issue"><div style={{ height: 220 }}>pass</div></div></div>
        </div>
      </Step>
    )
    firstFrame()
    expect(getComputedStyle(document.querySelector('.brd-issue')).transform).not.toBe('none')
    expect(overflowY(body())).toBeLessThanOrEqual(0)
  })

  it('stands Continue on the paper\'s floor, the answers held above it', async () => {
    // Plan 163: the floor is the bottom-right corner, a rung over the
    // frame's own edge, and the answers stand in the paper above it.
    await render(<Step>{answers}</Step>)
    landed()
    const main = document.querySelector('main').getBoundingClientRect()
    const last = document.querySelector('.brd-opt:last-child').getBoundingClientRect()
    const foot = document.querySelector('.brd__foot').getBoundingClientRect()
    expect(Math.round(main.bottom - foot.bottom)).toBe(cssPx('--sp-7'))
    expect(last.bottom).toBeLessThan(foot.top)
  })

  it('leaves Continue on top where the room reaches under it', async () => {
    // A frame under 740px narrows the car's gap a rung, and the room
    // under the body then reaches 4px into the foot: Continue must
    // still be what a pointer there presses.
    await render(<Step>{answers}</Step>)
    document.querySelector('main').style.height = '600px'
    landed()
    const go = document.querySelector('.btn-depart').getBoundingClientRect()
    expect(document.elementFromPoint(go.left + go.width / 2, go.top + 1)?.closest('.btn-depart')).not.toBeNull()
  })
})
