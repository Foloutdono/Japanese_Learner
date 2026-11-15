import { describe, it, expect, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { MemoryRouter } from 'react-router-dom'
import { LangProvider } from './LangContext'

// ── The library's More after a page that failed ──
// A page past the first that failed left the counter on it, and More
// stepped to the next: the failed page's decks never reached the shelf.
// More now asks for the same page again. And a first page that failed
// keeps no shelf: the last ordering's decks are not its answer.

vi.mock('./lib/audio', async o => ({ ...(await o()), playUi: vi.fn() }))
vi.mock('./lib/track', () => ({ track: vi.fn() }))
const apiJson = vi.hoisted(() => vi.fn())
vi.mock('./lib/api', () => ({ apiJson }))

const { useLibrary } = await import('./components/decks/useLibrary')

const deck = id => ({ id })
const pageOf = url => Number(new URL(url, 'http://x').searchParams.get('page'))
const sortOf = url => new URL(url, 'http://x').searchParams.get('sort')

let lib
function Harness() {
  lib = useLibrary(null)
  return null
}
const mount = () => render(
  <MemoryRouter><LangProvider><Harness /></LangProvider></MemoryRouter>
)
const until = async test => {
  for (let i = 0; i < 100 && !test(); i++) await new Promise(r => setTimeout(r, 10))
  expect(test()).toBe(true)
}

describe('useLibrary', () => {
  it('asks for a page that failed again, rather than stepping past it', async () => {
    let failOnce = true
    apiJson.mockImplementation(async url => {
      const page = pageOf(url)
      if (page === 1 && failOnce) { failOnce = false; throw new Error('down') }
      return { results: [deck(`p${page}`)], total: 3, has_more: page < 2, types: [] }
    })
    await mount()
    await until(() => lib.decks.length === 1 && !lib.loading)

    lib.nextPage()
    await until(() => lib.failed && !lib.loading)
    expect(lib.page).toBe(1)
    expect(lib.hasMore).toBe(true)

    lib.nextPage()
    await until(() => !lib.failed && !lib.loading && lib.decks.length === 2)
    expect(lib.page).toBe(1)
    expect(lib.decks.map(d => d.id)).toEqual(['p0', 'p1'])
    expect(apiJson.mock.calls.map(([u]) => pageOf(u))).toEqual([0, 1, 1])
  })

  it('keeps no shelf when a first page fails', async () => {
    apiJson.mockReset()
    apiJson.mockImplementation(async url => {
      if (sortOf(url) === 'followed') throw new Error('down')
      return { results: [deck('a'), deck('b')], total: 2, has_more: true, types: [] }
    })
    await mount()
    await until(() => lib.decks.length === 2 && !lib.loading)

    lib.chooseSort('followed')
    await until(() => lib.failed && !lib.loading)
    expect(lib.decks).toEqual([])
    expect(lib.hasMore).toBe(false)
  })

  it('keeps the pages read when the current sort is picked again', async () => {
    apiJson.mockReset()
    apiJson.mockImplementation(async url => (
      { results: [deck(`p${pageOf(url)}`)], total: 2, has_more: pageOf(url) < 1, types: [] }
    ))
    await mount()
    await until(() => !lib.loading && lib.decks.length === 1)
    lib.nextPage()
    await until(() => !lib.loading && lib.decks.length === 2)
    const asked = apiJson.mock.calls.length
    lib.chooseSort(lib.sort)
    await new Promise(r => setTimeout(r, 50))
    expect(apiJson.mock.calls.length).toBe(asked)
    expect(lib.decks.map(d => d.id)).toEqual(['p0', 'p1'])
  })
})
