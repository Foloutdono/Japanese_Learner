import { apiFetch } from './api'

// ── One entry, looked up by what the caller holds ──────────────
// The fetch behind DictionaryDetail's useDictionaryLookup, kept apart
// so a screen can ask for an entry before it is shown: the analyser
// docks the word in focus beside the video, and walking a sentence's
// words used to wait on a round trip per word (a second or two each)
// before the entry appeared. Its words are asked for when the sentence
// comes into focus (prefetchLookup), and an entry already in hand is
// drawn on the first frame (cachedLookup), with no loading line.
//
// A response is kept for TTL_MS, under the learner and the URL: the
// entry carries the learner's own record (status, the ＋'s card), so a
// long-lived copy would print a stale one after a review. Only answers
// are kept; a failure is asked again next time.

const TTL_MS = 5 * 60 * 1000
const MAX = 300
const cache = new Map()

// `one` (routes/dictionary's parameter): a word held by its reading is
// answered with its exact entry alone when there is one, rather than a
// page of ten built around it and thrown away.
export function lookupUrl({ term, kana, category, id, lang }) {
  const params = new URLSearchParams({ q: term ?? '', page: 0, limit: 10, lang: lang ?? '', category })
  if (kana) {
    params.set('kana', kana)
    params.set('one', 'true')
  }
  if (id) params.set('id', id)
  return `/api/dictionary?${params.toString()}`
}

function keyOf(session, url) {
  return `${session?.user?.id ?? ''} ${url}`
}

function fresh(hit) {
  return hit && Date.now() - hit.at < TTL_MS
}

// The response already in hand for these params, or undefined.
export function cachedLookup(session, params) {
  const hit = cache.get(keyOf(session, lookupUrl(params)))
  return fresh(hit) && hit.data ? hit.data : undefined
}

// The response for these params: the one in hand, the one on its way,
// or a new request.
export function fetchLookup(session, params) {
  const key = keyOf(session, lookupUrl(params))
  const hit = cache.get(key)
  if (fresh(hit)) return hit.promise
  const entry = { at: Date.now(), data: null, promise: null }
  entry.promise = apiFetch(lookupUrl(params), session)
    .then(r => {
      if (r.ok === false) throw new Error(`dictionary ${r.status}`)
      return r.json()
    })
    .then(data => { entry.data = data; return data })
    .catch(err => {
      if (cache.get(key) === entry) cache.delete(key)
      throw err
    })
  cache.set(key, entry)
  if (cache.size > MAX) cache.delete(cache.keys().next().value)
  return entry.promise
}

// Ask ahead for entries that are about to be shown; failures are left
// for the real lookup to meet.
export function prefetchLookup(session, params) {
  if (!params?.category || (!params.term && !params.id)) return
  fetchLookup(session, params).catch(() => {})
}

// The entry a response names for the caller -- see useDictionaryLookup.
export function pickEntry(data, { term, kana, id, exact }) {
  const results = data?.results || []
  if (id) return results.find(e => e.raw_id === id) ?? null
  // The server answered `one` with the exact (kanji, kana) entry, which
  // a spelling folded into another card (美味しい → おいしい) would fail
  // the surface compares below on.
  if (data?.exact && results[0]) return results[0]
  return (kana && results.find(e => e.kanji === term && e.kana === kana))
    ?? results.find(e => e.kanji === term || e.kana === term)
    ?? (exact ? null : results[0] ?? null)
}

// Tests start each case from an empty cache.
export function clearLookupCache() {
  cache.clear()
}
