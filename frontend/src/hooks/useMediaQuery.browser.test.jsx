import { describe, it, expect, afterEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { useMediaQuery } from './useMediaQuery'

// This hook decides whether the analyser's route diagram stands up
// beside the stage or lies down as a strip, so "does it react when the
// query flips" is load-bearing -- and it is exactly the thing a
// DevTools-emulated viewport CANNOT exercise: CDP applies new metrics
// without dispatching `resize` or a MediaQueryList `change`, so the CSS
// updates while JS never hears about it (observed 2026-08-27). A real
// browser window resize does fire both.
//
// So the flip is pinned here instead, against a controllable fake.

const real = window.matchMedia
let listeners = []

function installFake(initial) {
  let matches = initial
  listeners = []
  window.matchMedia = query => ({
    media: query,
    get matches() { return matches },
    addEventListener: (_, cb) => listeners.push(cb),
    removeEventListener: (_, cb) => { listeners = listeners.filter(l => l !== cb) },
  })
  return next => { matches = next; listeners.forEach(cb => cb({ matches: next })) }
}

afterEach(() => { window.matchMedia = real })

function Probe() {
  const wide = useMediaQuery('(min-width: 1100px)')
  return <span data-testid="v">{wide ? 'wide' : 'narrow'}</span>
}

describe('useMediaQuery', () => {
  it('reports the query state on the FIRST render, without an effect pass', async () => {
    installFake(true)
    const screen = await render(<Probe />)
    // Not "renders narrow then corrects to wide": an effect-based hook
    // would paint the wrong orientation once, which on the analyser is
    // a visible flash of the route diagram lying down.
    expect(screen.container.textContent).toBe('wide')
  })

  it('re-renders when the query flips', async () => {
    const flip = installFake(false)
    const screen = await render(<Probe />)
    expect(screen.container.textContent).toBe('narrow')

    flip(true)
    await new Promise(r => setTimeout(r, 30))
    expect(screen.container.textContent).toBe('wide')

    flip(false)
    await new Promise(r => setTimeout(r, 30))
    expect(screen.container.textContent).toBe('narrow')
  })

  it('unsubscribes on unmount', async () => {
    installFake(false)
    const screen = await render(<Probe />)
    expect(listeners.length).toBe(1)
    screen.unmount()
    expect(listeners.length).toBe(0)
  })
})
