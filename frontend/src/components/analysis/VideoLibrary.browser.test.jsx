import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { page } from 'vitest/browser'
import { VideoLibrary } from './VideoLibrary'
import { LangProvider } from '../../LangContext'
import { forgetCachedJson } from '../../lib/cachedJson'
import '../../index.css'

// ── 図書館 — the public library of analysed videos (plan 322) ──
// The owner's pick B, "just the pictures": a title with one picker beside
// it, then a grid of stills, each with its first line and nothing else.
// The server's answer is mocked: what is held here is what the learner
// reads of it, and the request each pick makes.
const apiJson = vi.fn()
vi.mock('../../lib/api', () => ({
  api: p => p,
  apiJson: (...a) => apiJson(...a),
  apiFetch: vi.fn(),
  apiJsonWithTimeout: vi.fn(),
  ApiError: class ApiError extends Error {},
}))

const T = {
  vlibTitle: 'Video library',
  vlibAllKinds: 'All kinds',
  vlibKind: 'Kind of video',
  vlibMine: 'My videos',
  vlibKinds: { music: 'Music', podcast: 'Podcast', other: 'Other' },
  vlibEmpty: 'No video yet.',
  vlibEmptyMine: 'You have not opened one.',
  vlibError: 'The library did not load.',
  vlibMore: 'Show more',
  retry: 'Try again',
}

globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })

const video = (id, over = {}) => ({
  videoId: id, category: 'music', lineCount: 12, firstLine: `${id} の歌`, truncated: 0,
  addedAt: new Date().toISOString(), learners: 3, mine: false, ...over,
})
const answer = (videos, over = {}) => ({
  videos, total: videos.length, categories: ['music', 'podcast', 'other'],
  counts: { all: 4, mine: 1, music: 2, podcast: 1, other: 0 }, ...over,
})
const SESSION = { user: { id: 'u1' } }

async function library(props = {}) {
  return render(
    <LangProvider>
      <VideoLibrary t={T} session={SESSION} onOpen={() => {}} {...props} />
    </LangProvider>
  )
}
const paths = () => apiJson.mock.calls.map(c => c[0])
const settle = () => new Promise(r => setTimeout(r, 30))
function pick(select, value) {
  const proto = Object.getPrototypeOf(select)
  Object.getOwnPropertyDescriptor(proto, 'value').set.call(select, value)
  select.dispatchEvent(new Event('change', { bubbles: true }))
}

beforeEach(async () => {
  await page.viewport(414, 900)
  apiJson.mockReset()
  forgetCachedJson()
})

describe('VideoLibrary', () => {
  it('shows each video as its still and its first line, and nothing else', async () => {
    apiJson.mockResolvedValue(answer([video('aaaaaaaaaaa'), video('bbbbbbbbbbb', { category: 'podcast', learners: 1 })]))
    const screen = await library()
    await settle()
    const items = screen.container.querySelectorAll('.anl-lib__item')
    expect(items).toHaveLength(2)
    expect(items[0].querySelector('.anl-lib__still')).not.toBeNull()
    // The line is the whole of what a video says: no kind, count, learners or date.
    expect(items[0].textContent).toBe('aaaaaaaaaaa の歌')
    expect(paths()[0]).toBe('/api/video/library?limit=24&offset=0')
  })

  it('lays two stills a row on a phone, four on the desk', async () => {
    apiJson.mockResolvedValue(answer(Array.from({ length: 8 }, (_, i) => video(`v${String(i).padStart(10, '0')}`))))
    const screen = await library()
    await settle()
    const columns = () => getComputedStyle(screen.container.querySelector('.anl-lib__grid')).gridTemplateColumns.split(' ').length
    expect(columns()).toBe(2)
    await page.viewport(1280, 900)
    await settle()
    expect(columns()).toBe(4)
  })

  it('offers all kinds, the learner\'s own and each kind the library holds, and asks for the one picked', async () => {
    apiJson.mockResolvedValue(answer([video('aaaaaaaaaaa')]))
    const screen = await library()
    await settle()
    const select = screen.container.querySelector('.anl-lib__kind select')
    expect(select.labels[0].textContent).toContain('Kind of video')
    // "Other" holds none, so it is not offered.
    expect([...select.options].map(o => o.textContent)).toEqual(['All kinds', 'My videos', 'Music', 'Podcast'])
    pick(select, 'podcast')
    await settle()
    expect(paths().at(-1)).toBe('/api/video/library?limit=24&offset=0&category=podcast')
    pick(select, 'mine')
    await settle()
    expect(paths().at(-1)).toBe('/api/video/library?limit=24&offset=0&mine=true')
  })

  it('hands the video to onOpen', async () => {
    apiJson.mockResolvedValue(answer([video('aaaaaaaaaaa')]))
    const onOpen = vi.fn()
    const screen = await library({ onOpen })
    await settle()
    screen.container.querySelector('.anl-lib__item').click()
    expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ videoId: 'aaaaaaaaaaa' }))
  })

  it('shows more a page at a time, from where the grid ends, never twice', async () => {
    const first = Array.from({ length: 24 }, (_, i) => video(`v${String(i).padStart(10, '0')}`))
    apiJson.mockImplementation(async path => (
      path.includes('offset=24')
        ? answer([first[23], video('lastvideo001')], { total: 26 })
        : answer(first, { total: 26 })
    ))
    const screen = await library()
    await settle()
    expect(screen.container.querySelectorAll('.anl-lib__item')).toHaveLength(24)
    screen.container.querySelector('.anl-lib__more').click()
    await settle()
    expect(paths().at(-1)).toContain('offset=24')
    // 24 + 1 new: the repeated one is not listed twice.
    expect(screen.container.querySelectorAll('.anl-lib__item')).toHaveLength(25)
  })

  it('says so when the library is empty, with no picker', async () => {
    apiJson.mockResolvedValue(answer([], { counts: { all: 0, mine: 0, music: 0, podcast: 0, other: 0 } }))
    const screen = await library()
    await settle()
    expect(screen.container.textContent).toContain('No video yet.')
    expect(screen.container.querySelector('select')).toBeNull()
  })

  it('says so, and offers a retry, when it did not load', async () => {
    apiJson.mockRejectedValueOnce(new Error('down'))
    const screen = await library()
    await settle()
    expect(screen.container.querySelector('[role="alert"]').textContent).toContain('The library did not load.')
    apiJson.mockResolvedValue(answer([video('aaaaaaaaaaa')]))
    screen.container.querySelector('[role="alert"] button').click()
    await settle()
    expect(screen.container.querySelectorAll('.anl-lib__item')).toHaveLength(1)
  })
})
