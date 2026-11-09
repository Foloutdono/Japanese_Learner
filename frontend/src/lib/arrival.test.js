import { describe, it, expect } from 'vitest'
import { ARRIVAL_KEY, SOURCES, arrivalSource, classify, noteArrival } from './arrival'
import { arrivalScript, ARRIVAL_KEY as LANDING_KEY } from '../../landing/page.mjs'

// 入口 (plan 313): the door a learner came in by, as one closed class.

const memory = (seed = {}) => {
  const kept = new Map(Object.entries(seed))
  return {
    getItem: key => kept.get(key) ?? null,
    setItem: (key, value) => kept.set(key, String(value)),
    kept,
  }
}

describe('classify', () => {
  it('reads the posts’ own ?src= first', () => {
    expect(classify({ src: 'tiktok', ref: 'www.google.com' })).toBe('tiktok')
    expect(classify({ src: 'ig' })).toBe('instagram')
    expect(classify({ src: 'yt' })).toBe('youtube')
  })

  it('reads the class of the host that sent the visitor, never more', () => {
    expect(classify({ ref: 'www.tiktok.com' })).toBe('tiktok')
    expect(classify({ ref: 'l.instagram.com' })).toBe('instagram')
    expect(classify({ ref: 'm.youtube.com' })).toBe('youtube')
    expect(classify({ ref: 'www.reddit.com' })).toBe('reddit')
    expect(classify({ ref: 'www.google.fr' })).toBe('search')
    expect(classify({ ref: 'duckduckgo.com' })).toBe('search')
    expect(classify({ ref: 'www.qwant.com' })).toBe('search')
    expect(classify({ ref: 't.co' })).toBe('other')
  })

  it('names the store for the native app, and direct when nothing is known', () => {
    expect(classify(null, true)).toBe('store')
    expect(classify(null)).toBe('direct')
    expect(classify({ src: 'newsletter' })).toBe('other')
  })

  it('only ever answers a value the trail accepts', () => {
    const notes = [null, { src: 'tt' }, { ref: 'example.org' }, { src: 'x' }, { ref: 'www.bing.com' }]
    for (const note of notes) {
      expect(SOURCES).toContain(classify(note))
      expect(SOURCES).toContain(classify(note, true))
    }
  })
})

describe('noteArrival', () => {
  it('keeps the first arrival, not the last', () => {
    const storage = memory()
    noteArrival({ search: '?src=TikTok', referrer: 'https://www.tiktok.com/@tsuji', storage })
    noteArrival({ search: '', referrer: 'https://www.google.com/', storage })
    expect(JSON.parse(storage.getItem(ARRIVAL_KEY))).toEqual({ src: 'tiktok', ref: 'www.tiktok.com' })
    expect(arrivalSource({ storage })).toBe('tiktok')
  })

  it('keeps the host, never the page that sent the visitor', () => {
    const storage = memory()
    noteArrival({ referrer: 'https://www.reddit.com/r/LearnJapanese/comments/abc/my_post/', storage })
    expect(storage.getItem(ARRIVAL_KEY)).not.toContain('LearnJapanese')
    expect(arrivalSource({ storage })).toBe('reddit')
  })

  it('takes the app’s own pages for no arrival at all', () => {
    const storage = memory()
    noteArrival({ referrer: 'https://www.tsuji.app/', storage })
    expect(storage.getItem(ARRIVAL_KEY)).toBeNull()
    expect(arrivalSource({ storage })).toBe('direct')
  })

  it('drops a ?src= that is not a short word', () => {
    const storage = memory()
    noteArrival({ search: '?src=' + encodeURIComponent('<script>'), storage })
    expect(storage.getItem(ARRIVAL_KEY)).toBeNull()
  })
})

describe('the landing page’s note', () => {
  const run = ({ search = '', referrer = '', seed = {} } = {}) => {
    const storage = memory(seed)
    new Function('location', 'localStorage', 'document', arrivalScript())({ search }, storage, { referrer })
    return storage
  }

  it('writes the note the app reads, under the same key', () => {
    expect(LANDING_KEY).toBe(ARRIVAL_KEY)
    const storage = run({ search: '?src=ig', referrer: 'https://l.instagram.com/' })
    expect(arrivalSource({ storage })).toBe('instagram')
  })

  it('leaves a noted arrival alone, and notes nothing for the site itself', () => {
    const seed = { [ARRIVAL_KEY]: JSON.stringify({ src: 'tiktok', ref: null }) }
    expect(arrivalSource({ storage: run({ referrer: 'https://www.google.com/', seed }) })).toBe('tiktok')
    expect(run({ referrer: 'https://www.tsuji.app/en' }).getItem(ARRIVAL_KEY)).toBeNull()
  })
})
