import { describe, it, expect, vi, afterAll } from 'vitest'
import { render } from 'vitest-browser-react'

// ── The reading pace's store (stores/readingPace.js) ─────────────
// The run's chip is pressed to see the clock change, so a choice shows
// the moment it is made rather than once the save and the profile's
// refetch come back; and three quick presses reach the server in the
// order they were made, one save at a time.

const apiJson = vi.fn()
vi.mock('../lib/api', () => ({
  api: p => p,
  apiFetch: vi.fn(async () => ({ ok: false, status: 500, json: async () => ({}) })),
  apiJson: (...a) => apiJson(...a),
  apiJsonWithTimeout: vi.fn(),
  apiUpload: vi.fn(),
  ApiError: class ApiError extends Error {},
}))

window.localStorage.removeItem('jl.readingPace')
const { useReadingPace, setReadingPace } = await import('./readingPace')
// The mirror is this browser's, shared with every later file in the lane.
afterAll(() => { window.localStorage.removeItem('jl.readingPace') })

const settle = (ms = 20) => new Promise(r => setTimeout(r, ms))

/** A promise this test holds the far end of. */
function deferred() {
  let resolve, reject
  const promise = new Promise((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}

function Probe() {
  return <span data-pace={useReadingPace()} />
}
const shown = root => root.querySelector('[data-pace]').dataset.pace
const sent = () => apiJson.mock.calls.map(c => JSON.parse(c[2].body).readingPace)

describe('stores/readingPace', () => {
  it('shows a choice at once, and saves the presses one at a time, in order', async () => {
    const saves = [deferred(), deferred()]
    apiJson.mockImplementation(() => saves[apiJson.mock.calls.length - 1].promise)
    const { container } = await render(<Probe />)
    expect(shown(container)).toBe('standard')

    const first = setReadingPace('relaxed', null)
    await settle()
    expect(shown(container)).toBe('relaxed')
    const second = setReadingPace('slow', null)
    await settle()
    expect(shown(container)).toBe('slow')
    // The second waits for the first.
    expect(sent()).toEqual(['relaxed'])

    saves[0].resolve({})
    await first
    await settle()
    expect(sent()).toEqual(['relaxed', 'slow'])
    // The first coming back does not take the second off the screen.
    expect(shown(container)).toBe('slow')

    saves[1].resolve({})
    await second
    expect(shown(container)).toBe('slow')
  })

  it('lets the next save go after one fails', async () => {
    apiJson.mockReset()
    apiJson.mockImplementationOnce(() => Promise.reject(new Error('503')))
    apiJson.mockImplementationOnce(async () => ({}))
    await expect(setReadingPace('untimed', null)).rejects.toThrow('503')
    await setReadingPace('standard', null)
    expect(sent()).toEqual(['untimed', 'standard'])
  })
})
