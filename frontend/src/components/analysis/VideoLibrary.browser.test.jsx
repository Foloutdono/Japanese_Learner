import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { page } from 'vitest/browser'
import { VideoLibrary } from './VideoLibrary'
import { LangProvider } from '../../LangContext'
import { forgetCachedJson } from '../../lib/cachedJson'
import '../../index.css'

// ── 図書館 — the public library of analysed videos (plan 322) ──
// Under the desk it is a row of chips (all, mine, the kinds the library
// holds) and an order, over a row per video; opening one hands the video
// back. The server's answer is mocked: what is held here is what the
// learner reads of it, and the request each chip makes.
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
  vlibHint: 'Every video learners analysed.',
  vlibOrder: 'Order',
  vlibOrderNew: 'Newest',
  vlibOrderPopular: 'Most studied',
  vlibMine: 'Mine',
  vlibKinds: { music: 'Music', podcast: 'Podcast', other: 'Other' },
  vlibLearners: n => `${n} ${n === 1 ? 'learner' : 'learners'}`,
  vlibEmpty: 'No video yet.',
  vlibEmptyMine: 'You have not opened one.',
  vlibError: 'The library did not load.',
  vlibMore: 'Show more',
  shelfAll: 'All',
  shelfFilter: 'Show',
  sourceVideo: 'Video',
  retry: 'Try again',
  sessionSentenceCount: n => `${n} ${n === 1 ? 'sentence' : 'sentences'}`,
  dateToday: 'today',
  dateYesterday: 'yesterday',
  dateDaysAgo: n => `${n} days ago`,
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

beforeEach(async () => {
  await page.viewport(414, 900)
  apiJson.mockReset()
  forgetCachedJson()
})

describe('VideoLibrary', () => {
  it('lists the videos with their kind, their lines and their learners', async () => {
    apiJson.mockResolvedValue(answer([video('aaaaaaaaaaa'), video('bbbbbbbbbbb', { category: 'podcast', learners: 1 })]))
    const screen = await library()
    await settle()
    const rows = screen.container.querySelectorAll('.anl-row')
    expect(rows).toHaveLength(2)
    expect(rows[0].textContent).toContain('aaaaaaaaaaa の歌')
    expect(rows[0].textContent).toContain('Music')
    expect(rows[0].textContent).toContain('12 sentences')
    expect(rows[1].textContent).toContain('1 learner')
    expect(paths()[0]).toBe('/api/video/library?limit=24&offset=0&sort=new')
  })

  it('shows a chip per kind the library holds, and asks for the kind pressed', async () => {
    apiJson.mockResolvedValue(answer([video('aaaaaaaaaaa')]))
    const screen = await library()
    await settle()
    const names = [...screen.container.querySelectorAll('.chip')].map(c => c.textContent)
    // "Other" holds none, so it has no chip; "Mine" has one.
    expect(names.join('|')).toMatch(/All.*Mine.*Music.*Podcast.*Newest.*Most studied/)
    expect(names.join('|')).not.toContain('Other')
    ;[...screen.container.querySelectorAll('.chip')].find(c => c.textContent.startsWith('Podcast')).click()
    await settle()
    expect(paths().at(-1)).toBe('/api/video/library?limit=24&offset=0&sort=new&category=podcast')
    ;[...screen.container.querySelectorAll('.chip')].find(c => c.textContent.startsWith('Mine')).click()
    await settle()
    expect(paths().at(-1)).toBe('/api/video/library?limit=24&offset=0&sort=new&mine=true')
    ;[...screen.container.querySelectorAll('.chip')].find(c => c.textContent === 'Most studied').click()
    await settle()
    expect(paths().at(-1)).toBe('/api/video/library?limit=24&offset=0&sort=popular&mine=true')
  })

  it('hands the video to onOpen', async () => {
    apiJson.mockResolvedValue(answer([video('aaaaaaaaaaa')]))
    const onOpen = vi.fn()
    const screen = await library({ onOpen })
    await settle()
    screen.container.querySelector('.anl-row__open').click()
    expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ videoId: 'aaaaaaaaaaa' }))
  })

  it('shows more a page at a time, from where the list ends, never twice', async () => {
    const first = Array.from({ length: 24 }, (_, i) => video(`v${String(i).padStart(10, '0')}`))
    apiJson.mockImplementation(async path => (
      path.includes('offset=24')
        ? answer([first[23], video('lastvideo001')], { total: 26 })
        : answer(first, { total: 26 })
    ))
    const screen = await library()
    await settle()
    expect(screen.container.querySelectorAll('.anl-row')).toHaveLength(24)
    screen.container.querySelector('.anl-lib__more').click()
    await settle()
    expect(paths().at(-1)).toContain('offset=24')
    // 24 + 1 new: the repeated one is not listed twice, and nothing is left to show.
    expect(screen.container.querySelectorAll('.anl-row')).toHaveLength(25)
  })

  it('says so when the library is empty', async () => {
    apiJson.mockResolvedValue(answer([], { counts: { all: 0, mine: 0, music: 0, podcast: 0, other: 0 } }))
    const screen = await library()
    await settle()
    expect(screen.container.textContent).toContain('No video yet.')
    expect(screen.container.querySelector('.chip')).toBeNull()
  })

  it('says so, and offers a retry, when it did not load', async () => {
    apiJson.mockRejectedValueOnce(new Error('down'))
    const screen = await library()
    await settle()
    expect(screen.container.querySelector('[role="alert"]').textContent).toContain('The library did not load.')
    apiJson.mockResolvedValue(answer([video('aaaaaaaaaaa')]))
    screen.container.querySelector('[role="alert"] button').click()
    await settle()
    expect(screen.container.querySelectorAll('.anl-row')).toHaveLength(1)
  })
})
