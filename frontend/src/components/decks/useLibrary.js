import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { apiJson } from '../../lib/api'
import { useLang } from '../../LangContext'
import { playUi } from '../../lib/audio'
import { track } from '../../lib/track'
import { deckTypes } from './deckTypes'

// ── The library's paged shelf, and everything that narrows it ──
// The state behind components/decks/LibraryCatalogue's console and
// results: the phone's library, its desk split and the Bibliothèque's
// page (plan 269) each hold one.
//
// ── The console ──
//   the band — HOW THE WHOLE SHELF IS ARRANGED: newest, or most
//           followed. Edge to edge at the head, over everything it
//           orders. One control and not two chips, per DESIGN.md —
//           anything that picks one of two views of the SAME data is
//           segmented — and a band because it applies to the full
//           width of what is under it.
//   row 1 — WHAT YOU ARE LOOKING AT: the structures the library holds,
//           as chips. No chips, no row: the band and the field close
//           up over it.
//   row 2 — HOW YOU ARE ASKING: the search field, with the tally
//           pinned right where every other console keeps its count.
//
// The chips are drawn from `types` — the structures actually published,
// which the endpoint reports before either narrowing is applied, so the
// row does not change shape as it is used. Fewer than two and there is
// no chip row at all: "All" beside a lone "Vocabulary" is a choice
// between everything and everything.
//
// ── Why the narrowing is the server's ──
// 教材's shelf filters in the browser because it holds the whole shelf
// in one request. This one is paged, 24 at a time, over a list with no
// end, so the same trick would search whichever page happened to be
// loaded and print the whole library's tally beside the answer. The
// term therefore travels (debounced, like the dictionary's) and page 0
// is asked for again.

export const SORTS = ['new', 'followed']
const DEBOUNCE_MS = 300

/** The library's paged shelf and everything that narrows it. */
export function useLibrary(session) {
  const { t } = useLang()
  const [decks, setDecks]     = useState([])
  const [total, setTotal]     = useState(0)
  const [types, setTypes]     = useState([])
  const [hasMore, setHasMore] = useState(false)
  const [page, setPage]       = useState(0)
  const [sort, setSort]       = useState('new')
  // What is typed, and what has actually been asked for. They differ
  // for the length of the debounce, and it is the second one the
  // request is keyed on — a fetch per keystroke is what the wait is for.
  // The gate's search field lands here with its term in the URL (plan
  // 132): the shelf opens already asked.
  const [searchParams] = useSearchParams()
  const [query, setQuery]     = useState(() => searchParams.get('q') ?? '')
  const [term, setTerm]       = useState(() => (searchParams.get('q') ?? '').trim())
  const [structure, setStructure] = useState('all')
  const [loading, setLoading] = useState(true)
  const [failed, setFailed]   = useState(false)

  const debounceRef = useRef(null)
  const searchRef   = useRef(null)

  useEffect(() => () => clearTimeout(debounceRef.current), [])

  // Whether anything is narrowing the shelf — which decides the empty
  // state's words, and is the one thing the trail is told about the
  // console.
  const narrowed = term !== '' || structure !== 'all'

  useEffect(() => {
    let live = true
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the shelf's own load, not a state reset: sort, page and the narrowing ARE the request.
    setLoading(true)
    // Only what narrows is spelled out: an unfiltered library asks the
    // same question it always asked.
    const params = new URLSearchParams({ sort, page })
    if (term) params.set('q', term)
    if (structure !== 'all') params.set('type', structure)
    apiJson(`/api/decks/library?${params}`, session)
      .then(data => {
        if (!live) return
        // Paging appends: the shelf grows downward rather than
        // replacing itself, so the card you were reading stays put.
        const results = data.results ?? []
        setDecks(prev => (page === 0 ? results : [...prev, ...results]))
        setTotal(data.total ?? results.length)
        setHasMore(Boolean(data.has_more))
        if (Array.isArray(data.types)) setTypes(data.types)
        setLoading(false)
        setFailed(false)
        // `filtered` and not the term: what was typed is a learner's
        // own words, and the trail never carries those (core/events.py).
        if (page === 0) track('library_view', { sort, results: data.total ?? results.length, filtered: narrowed })
      })
      .catch(() => { if (live) { setLoading(false); setFailed(true) } })
    return () => { live = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `narrowed` is these two.
  }, [session, sort, page, term, structure])

  // Only the structures the library actually holds, in the app's own
  // order: deckTypes.js declares the order (and the glyph and the
  // pigment), the endpoint declares the set.
  const typeChips = useMemo(
    () => deckTypes(t).filter(dt => types.includes(dt.value)),
    [types, t]
  )

  function chooseSort(next) {
    playUi('click-mode-selection')
    setPage(0)
    setSort(next)
  }

  function chooseStructure(next) {
    if (next === structure) return
    playUi('click-mode-selection')
    setPage(0)
    setStructure(next)
  }

  // The field answers at once; the library answers after the pause.
  // The page falls back to 0 with the term and not with the keystroke:
  // done in this handler it would spend a request on the OLD term
  // before the new one had even been asked for.
  function onSearch(e) {
    const q = e.target.value
    setQuery(q)
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => { setPage(0); setTerm(q.trim()) }, DEBOUNCE_MS)
  }

  function clearQuery() {
    clearTimeout(debounceRef.current)
    setQuery('')
    setTerm('')
    setPage(0)
    searchRef.current?.focus()
  }

  function clearFilters() {
    playUi('click-mode-selection')
    clearQuery()
    setStructure('all')
  }

  function nextPage() {
    playUi('click-mode-selection')
    setPage(p => p + 1)
  }

  return {
    decks, total, hasMore, page, sort, query, structure, loading, failed, narrowed, typeChips, searchRef,
    // `settled`, not just `decks.length`: re-sorting reloads page 0, and
    // drawing the previous ordering under the waiting dots showed two
    // answers at once. Paging (page > 0) keeps its rows, because there
    // the old ones are still the right answer.
    settled: !(loading && page === 0),
    chooseSort, chooseStructure, onSearch, clearQuery, clearFilters, nextPage,
  }
}
