import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./api', () => ({ apiFetch: vi.fn() }))
import { apiFetch } from './api'
import { cachedLookup, clearLookupCache, fetchLookup, lookupUrl, pickEntry, prefetchLookup } from './dictionaryLookup'

// ── One entry, looked up ahead ──────────────────────────────────
// The analyser's right column used to wait a round trip per word it
// docked. A word is asked for once, by its exact pair, and whatever is
// in hand is drawn at once.

const session = { user: { id: 'u1' } }
const WORD = { category: 'vocab', term: '靴箱', kana: 'くつばこ', lang: 'en' }
const ROW = { kanji: '靴箱', kana: 'くつばこ', meaning: 'shoe box' }
const ok = body => Promise.resolve({ ok: true, json: () => Promise.resolve(body) })

beforeEach(() => {
  clearLookupCache()
  apiFetch.mockReset()
})

describe('dictionaryLookup', () => {
  it('asks for a word held by its reading as its exact entry alone', () => {
    const params = new URL(lookupUrl(WORD), 'http://x').searchParams
    expect(params.get('one')).toBe('true')
    expect(params.get('kana')).toBe('くつばこ')
    // A kanji has no second key, and gets the page.
    expect(new URL(lookupUrl({ category: 'kanji', term: '靴' }), 'http://x').searchParams.has('one')).toBe(false)
  })

  it('asks once, and holds the answer for the next frame', async () => {
    apiFetch.mockReturnValue(ok({ results: [ROW], exact: true }))
    prefetchLookup(session, WORD)
    expect(cachedLookup(session, WORD)).toBeUndefined()
    await fetchLookup(session, WORD)
    expect(apiFetch).toHaveBeenCalledTimes(1)
    expect(cachedLookup(session, WORD)?.results).toEqual([ROW])
    // Another learner is asked for again.
    expect(cachedLookup({ user: { id: 'u2' } }, WORD)).toBeUndefined()
  })

  it('keeps no failure', async () => {
    apiFetch.mockReturnValueOnce(Promise.resolve({ ok: false, status: 500 }))
    await expect(fetchLookup(session, WORD)).rejects.toThrow()
    apiFetch.mockReturnValueOnce(ok({ results: [ROW] }))
    await expect(fetchLookup(session, WORD)).resolves.toEqual({ results: [ROW] })
    expect(apiFetch).toHaveBeenCalledTimes(2)
  })

  it('takes the exact answer even under a folded spelling', () => {
    const folded = { kanji: '', kana: 'おいしい' }
    expect(pickEntry({ results: [folded], exact: true }, { term: '美味しい', kana: 'おいしい', exact: true })).toBe(folded)
    // A page is still matched on its surface, and an exact caller gets
    // nothing rather than an unrelated first row.
    expect(pickEntry({ results: [folded] }, { term: '美味しい', kana: 'おいしい', exact: true })).toBeNull()
    expect(pickEntry({ results: [ROW] }, { term: '靴箱', kana: 'くつばこ' })).toBe(ROW)
  })
})

describe('a lookup that keeps nothing', () => {
  it('asks every time and leaves the cache alone', async () => {
    apiFetch.mockImplementation(() => ok({ results: [ROW] }))
    await fetchLookup(session, WORD, { keep: false })
    await fetchLookup(session, WORD, { keep: false })
    expect(apiFetch).toHaveBeenCalledTimes(2)
    expect(cachedLookup(session, WORD)).toBeUndefined()
  })
})
