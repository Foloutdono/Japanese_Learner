import { describe, it, expect } from 'vitest'
import { kindOf, lineOf, keptOf, shelfChips, shelfShows } from './passages'

// ── 帳 — what the shelf reads off a history entry (plan 136) ──
const text = { kind: 'passage', id: 1, label: '猫が好き', source: 'typed', kept: false }
const photo = { kind: 'passage', id: 2, label: '本日休業', source: 'image', kept: true }
const video = { kind: 'session', id: 3, label: 'dQw4w9WgXcQ.ja.vtt', firstLine: '駅の前で', videoId: 'dQw4w9WgXcQ' }

describe('the shelf\'s reading of an entry', () => {
  it('knows the platform, the line and the keep', () => {
    expect([text, photo, video].map(kindOf)).toEqual(['text', 'photo', 'video'])
    expect(lineOf(video)).toBe('駅の前で')
    expect(lineOf({ ...video, firstLine: null })).toBe('dQw4w9WgXcQ.ja.vtt')
    expect([text, photo, { ...video, kept: true }].map(keptOf)).toEqual([false, true, false])
  })

  it('draws the kinds only when two are held, and Kept only when one is', () => {
    expect(shelfChips([text]).map(c => c.key)).toEqual(['all'])
    expect(shelfChips([text, photo]).map(c => c.key)).toEqual(['all', 'text', 'photo', 'kept'])
    expect(shelfChips([text, photo, video])).toEqual([
      { key: 'all', n: 3 }, { key: 'video', n: 1 }, { key: 'text', n: 1 }, { key: 'photo', n: 1 }, { key: 'kept', n: 1 },
    ])
  })

  it('shows an entry under its chip and a search of its line or its label', () => {
    expect([text, photo, video].filter(h => shelfShows(h, 'kept')).map(h => h.id)).toEqual([2])
    expect([text, photo, video].filter(h => shelfShows(h, 'video')).map(h => h.id)).toEqual([3])
    expect([text, photo, video].filter(h => shelfShows(h, 'all', '駅')).map(h => h.id)).toEqual([3])
    expect([text, photo, video].filter(h => shelfShows(h, 'all', 'DQW4')).map(h => h.id)).toEqual([3])
    expect([text, photo, video].filter(h => shelfShows(h, 'all', '  ')).map(h => h.id)).toEqual([1, 2, 3])
  })
})
