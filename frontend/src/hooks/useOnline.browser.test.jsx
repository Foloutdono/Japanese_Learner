import { describe, it, expect } from 'vitest'
import { render } from 'vitest-browser-react'
import { useOnline } from './useOnline'

function Probe() {
  const online = useOnline()
  return <span data-online={String(online)} />
}

// navigator.onLine cannot be flipped from a test, but the events that
// move the hook can: what is pinned is that the hook listens to both
// and answers from the browser, not from a stale first read.
describe('useOnline', () => {
  it('answers navigator.onLine on the first render and follows the events', async () => {
    const screen = await render(<Probe />)
    const probe = () => screen.container.querySelector('span').dataset.online
    expect(probe()).toBe(String(navigator.onLine))
    window.dispatchEvent(new Event('offline'))
    await new Promise(r => setTimeout(r, 20))
    expect(probe()).toBe(String(navigator.onLine))
    window.dispatchEvent(new Event('online'))
    await new Promise(r => setTimeout(r, 20))
    expect(probe()).toBe(String(navigator.onLine))
  })
})
