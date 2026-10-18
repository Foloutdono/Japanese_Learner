import { describe, it, expect, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { useState } from 'react'

// ── 戻る — the guard entry (hooks/useBackGuard.js) ────────────────
// One entry stands in the history while `on`. Back pops it and asks the
// screen, unless a sheet is open, which that Back closes instead; a new
// step stands it again. release() takes it out before the screen
// leaves, and resolves once its pop has landed -- or after a while, if
// no pop comes. Every test leaves the history as it found it.

const { useBackGuard } = await import('./useBackGuard')

const settle = (ms = 80) => new Promise(r => setTimeout(r, ms))
const guarded = () => window.history.state?.guard === true

function Probe({ on = true, onBack = () => {}, step = null, onRelease = () => {} }) {
  const release = useBackGuard(on, onBack, step)
  return <button type="button" className="probe-leave" onClick={() => release().then(onRelease)}>leave</button>
}

/** A screen of steps: Back goes one back, as the introduction's does. */
function Steps() {
  const [step, setStep] = useState(3)
  return (
    <>
      <p className="probe-step">{step}</p>
      <Probe on={step > 1} step={step} onBack={() => setStep(s => s - 1)} />
    </>
  )
}

describe('the guard entry', () => {
  it('stands one entry while on, and Back asks the screen', async () => {
    const onBack = vi.fn()
    await render(<Probe onBack={onBack} />)
    await settle()
    expect(guarded()).toBe(true)
    window.history.back()
    await settle()
    expect(onBack).toHaveBeenCalledTimes(1)
    // Nothing asked for it again: it stays out.
    expect(guarded()).toBe(false)
  })

  it('stands again on a new step, until none is behind', async () => {
    const screen = await render(<Steps />)
    await settle()
    const step = () => screen.container.querySelector('.probe-step').textContent
    expect(guarded()).toBe(true)
    window.history.back()
    await settle()
    expect(step()).toBe('2')
    expect(guarded()).toBe(true)
    window.history.back()
    await settle()
    // Nothing behind the first step: no guard, Back is the browser's.
    expect(step()).toBe('1')
    expect(guarded()).toBe(false)
  })

  it('closes an open sheet on Back instead, and stands again', async () => {
    const onBack = vi.fn()
    const onRelease = vi.fn()
    const sheet = document.createElement('div')
    sheet.setAttribute('aria-modal', 'true')
    document.body.append(sheet)
    const onKey = e => { if (e.key === 'Escape') sheet.remove() }
    window.addEventListener('keydown', onKey)
    try {
      const screen = await render(<Probe onBack={onBack} onRelease={onRelease} />)
      await settle()
      window.history.back()
      await settle()
      expect(sheet.isConnected).toBe(false)
      expect(onBack).not.toHaveBeenCalled()
      expect(guarded()).toBe(true)
      screen.container.querySelector('.probe-leave').click()
      await vi.waitFor(() => expect(onRelease).toHaveBeenCalledTimes(1))
      expect(guarded()).toBe(false)
    } finally {
      window.removeEventListener('keydown', onKey)
      sheet.remove()
    }
  })

  it('release takes it out before the screen leaves, and it never stands again', async () => {
    const onRelease = vi.fn()
    const screen = await render(<Probe onRelease={onRelease} step={1} />)
    await settle()
    expect(guarded()).toBe(true)
    screen.container.querySelector('.probe-leave').click()
    expect(onRelease).not.toHaveBeenCalled()
    await vi.waitFor(() => expect(onRelease).toHaveBeenCalledTimes(1))
    expect(guarded()).toBe(false)
    await screen.rerender(<Probe onRelease={onRelease} step={2} />)
    await settle()
    expect(guarded()).toBe(false)
  })

  it('a pop that does not come holds no door: release resolves after a while', async () => {
    const onRelease = vi.fn()
    const screen = await render(<Probe onRelease={onRelease} />)
    await settle()
    const back = vi.spyOn(window.history, 'back').mockImplementation(() => {})
    try {
      screen.container.querySelector('.probe-leave').click()
      await settle(300)
      expect(onRelease).not.toHaveBeenCalled()
      await vi.waitFor(() => expect(onRelease).toHaveBeenCalledTimes(1), { timeout: 3000 })
    } finally {
      back.mockRestore()
    }
    // The entry it could not take out, taken out here: its late pop is
    // ignored, not read as a Back.
    window.history.back()
    await settle()
    expect(guarded()).toBe(false)
  })
})
