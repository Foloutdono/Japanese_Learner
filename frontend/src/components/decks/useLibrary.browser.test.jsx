import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { MemoryRouter } from 'react-router-dom'
import { LangProvider } from '../../LangContext'

// ── The library's More, after a page that failed ────────────────
// The shelf pages 24 at a time. A page that failed used to leave More
// stepping on to the next one, so the failed page's decks were never
// shown: More after a failure asks for the same page again.

const asked = []
let fail = new Set()
vi.mock('../../lib/api', () => ({
  apiJson: url => {
    const page = Number(new URL(url, 'https://x.test').searchParams.get('page'))
    asked.push(page)
    if (fail.has(page)) { fail.delete(page); return Promise.reject(new Error('down')) }
    return Promise.resolve({
      results: [{ id: `d${page}` }], total: 3, has_more: page < 2, types: [],
    })
  },
}))
vi.mock('../../lib/audio', async o => ({ ...(await o()), playUi: vi.fn() }))
vi.mock('../../lib/track', () => ({ track: vi.fn() }))

const { useLibrary } = await import('./useLibrary')

const settle = (ms = 40) => new Promise(r => setTimeout(r, ms))

let lib
function Probe() {
  lib = useLibrary(null)
  return null
}

beforeEach(() => { asked.length = 0; fail = new Set() })

describe('useLibrary', () => {
  it('asks a failed page again rather than skipping it', async () => {
    fail = new Set([1])
    await render(<MemoryRouter><LangProvider><Probe /></LangProvider></MemoryRouter>)
    await settle()
    expect(lib.decks.map(d => d.id)).toEqual(['d0'])

    lib.nextPage()
    await settle()
    expect(lib.failed).toBe(true)

    lib.nextPage()
    await settle()
    expect(asked).toEqual([0, 1, 1])
    expect(lib.failed).toBe(false)
    expect(lib.decks.map(d => d.id)).toEqual(['d0', 'd1'])

    lib.nextPage()
    await settle()
    expect(asked).toEqual([0, 1, 1, 2])
    expect(lib.decks.map(d => d.id)).toEqual(['d0', 'd1', 'd2'])
  })
})
