import { describe, it, expect } from 'vitest'
import { ARRIVAL_KEY, REFERRAL_KEY, SOURCES, arrivalSource, classify, noteArrival, noteReferral, referralSuggestion } from './arrival'
import { arrivalScript, ARRIVAL_KEY as LANDING_KEY, REFERRAL_KEY as LANDING_REFERRAL_KEY } from '../../landing/page.mjs'

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

  it('keeps the username of a referral link for the app to suggest, and nothing else (plan 332)', () => {
    expect(LANDING_REFERRAL_KEY).toBe(REFERRAL_KEY)
    const storage = run({ search: '?src=referral&ref=Mei_2' })
    expect(referralSuggestion({ storage })).toBe('Mei_2')
    expect(arrivalSource({ storage })).toBe('referral')
    expect(run({ search: '?src=referral&ref=<b>x</b>' }).getItem(REFERRAL_KEY)).toBeNull()
    expect(run({ search: '?src=tiktok&ref=Mei' }).getItem(REFERRAL_KEY)).toBeNull()
  })
})

describe('noteReferral', () => {
  const memory2 = () => { const m = new Map(); return { getItem: k => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)) } }

  it('notes the username of the first link only, and only a username', () => {
    const storage = memory2()
    noteReferral({ search: '?src=referral&ref=Aiko', storage })
    noteReferral({ search: '?src=referral&ref=Kenji', storage })
    expect(referralSuggestion({ storage })).toBe('Aiko')
    const other = memory2()
    noteReferral({ search: '?src=referral&ref=a', storage: other })
    noteReferral({ search: '?ref=Aiko', storage: other })
    expect(referralSuggestion({ storage: other })).toBeNull()
  })

  it('reads the referral as an arrival of its own', () => {
    expect(SOURCES).toContain('referral')
    expect(classify({ src: 'referral' })).toBe('referral')
  })
})
