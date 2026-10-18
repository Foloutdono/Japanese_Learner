import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from 'vitest-browser-react'

const apiJson = vi.hoisted(() => vi.fn())
vi.mock('./api', () => ({ apiJson: (...a) => apiJson(...a) }))
const { useCachedJson, forgetCachedJson } = await import('./cachedJson')

// ── The hook over the shared answers (plan 211) ─────────────────
// undefined while the CURRENT path's answer is on its way -- never the
// answer to the path just left -- null when it failed, else the body;
// a path walked back to is drawn on its first frame.

const session = { user: { id: 'u1' } }
const settle = (ms = 30) => new Promise(r => setTimeout(r, ms))
const later = () => {
  let resolve
  let reject
  const promise = new Promise((ok, no) => { resolve = ok; reject = no })
  return { promise, resolve, reject }
}

const seen = []
function Probe({ path }) {
  const body = useCachedJson(path, session)
  seen.push(body === undefined ? 'wait' : body === null ? 'failed' : body.n)
  return <p className="probe">{body === undefined ? 'wait' : body === null ? 'failed' : body.n}</p>
}
const shown = screen => screen.container.querySelector('.probe').textContent

beforeEach(() => {
  forgetCachedJson()
  apiJson.mockReset()
  seen.length = 0
})

describe('useCachedJson', () => {
  it('waits for the path on show, never drawing the one just left', async () => {
    const first = later()
    const second = later()
    apiJson.mockImplementation(path => (path === '/a' ? first.promise : second.promise))
    const screen = await render(<Probe path="/a" />)
    expect(shown(screen)).toBe('wait')
    first.resolve({ n: 'A' })
    await expect.poll(() => shown(screen)).toBe('A')

    await screen.rerender(<Probe path="/b" />)
    expect(shown(screen)).toBe('wait')
    second.resolve({ n: 'B' })
    await expect.poll(() => shown(screen)).toBe('B')

    // Back to /a: drawn at once, and asked no more.
    seen.length = 0
    await screen.rerender(<Probe path="/a" />)
    expect(seen[0]).toBe('A')
    expect(apiJson).toHaveBeenCalledTimes(2)
  })

  it('shares one request between two consumers', async () => {
    const answer = later()
    apiJson.mockReturnValue(answer.promise)
    const screen = await render(<><Probe path="/a" /><Probe path="/a" /></>)
    answer.resolve({ n: 'A' })
    await expect.poll(() => [...screen.container.querySelectorAll('.probe')].map(p => p.textContent)).toEqual(['A', 'A'])
    expect(apiJson).toHaveBeenCalledTimes(1)
  })

  it('says a failure, and asks again on the next mount', async () => {
    apiJson.mockRejectedValueOnce(new Error('503'))
    const screen = await render(<Probe path="/a" />)
    await expect.poll(() => shown(screen)).toBe('failed')
    await screen.unmount()
    apiJson.mockResolvedValueOnce({ n: 'A' })
    const again = await render(<Probe path="/a" />)
    await expect.poll(() => shown(again)).toBe('A')
    expect(apiJson).toHaveBeenCalledTimes(2)
  })

  it('asks nothing without a path', async () => {
    const screen = await render(<Probe path={null} />)
    await settle()
    expect(shown(screen)).toBe('wait')
    expect(apiJson).not.toHaveBeenCalled()
  })
})
