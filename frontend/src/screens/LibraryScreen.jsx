import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams, Navigate } from 'react-router-dom'
import { apiJson } from '../lib/api'
import { useLang } from '../LangContext'
import { playUi } from '../lib/audio'
import { track } from '../lib/track'
import { Bar, Leave } from '../components/chrome/Bar'
import { Console, ConsoleBand, ConsoleTop, Chips, Chip, ConsoleIndex } from '../components/chrome/Console'
import Empty from '../components/ui/Empty'
import { Loading } from '../components/ui/Loading'
import { LibraryCard } from '../components/decks/LibraryCard'
import { deckTypes } from '../components/decks/deckTypes'
import { BooksIcon } from '../components/ui/Icons'
import { useDesk } from '../hooks/useDesk'
import { useListWalk, useFollowFocus } from '../hooks/useListWalk'
import { StationSplit } from '../components/selection/StationSplit'
import { PublicDeckPane } from '../components/decks/PublicDeckPage'
import PublicDeckScreen from './PublicDeckScreen'

// ── The library ───────────────────────────────────────────────
// Every deck other learners have published. A place under 教材 rather
// than a line of its own, so it inherits the deck station's roundel,
// its kana and its 蘇芳 pigment from config/stations.js's longest-prefix
// fallback with no registry edit at all.
//
// The heading is "Library" with no Japanese pair — owner's call, and
// the one place in the app that reads Latin-only by design rather than
// by omission. The pigment stays: that is the deck line's colour, not
// a name, and it is what keeps this looking like part of 教材.
//
// ── The console ──
// The screen's own row of controls (.lib-controls: the ordering, and
// the tally pushed to the other end) is gone, and the shared console
// holds all three things now — the same object 教材, 辞書 and the
// Today picker wear, which is what a screen that filters is supposed
// to reach for rather than a bar of its own. The row it replaces was
// half a console already: it drew a count, in a face nothing else on
// the screen used, on a surface that was not there.
//
//   the band — HOW THE WHOLE SHELF IS ARRANGED: newest, or most
//           followed. Edge to edge at the head, over everything it
//           orders. It is one control and not two chips, per DESIGN.md
//           — anything that picks one of two views of the SAME data is
//           segmented, not a pair of buttons that both look pressable
//           — and it is a band and not a pill because it applies to
//           the full width of what is under it. A pill on a row of its
//           own left that row two thirds empty and read as a third
//           filter.
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

const SORTS = ['new', 'followed']
const DEBOUNCE_MS = 300

// ── 机 — the shelf beside a deck's page (plan 115) ──
// Both library routes land here (App.jsx). On a phone a deck is a
// screen of its own, as it always was. On the desk the shelf stays and
// the open deck's page stands beside it (PublicDeckPane): one route
// component for both paths is what keeps the shelf's search, its
// narrowing and its paging while the deck beside it changes.
export default function LibraryScreen({ session }) {
  const { deck_id } = useParams()
  const desk = useDesk()
  if (deck_id && !desk) return <PublicDeckScreen session={session} />
  return <LibraryShelf session={session} open={desk ? deck_id ?? null : null} />
}

function LibraryShelf({ session, open }) {
  const navigate = useNavigate()
  const { t } = useLang()
  const desk = useDesk()
  // On the desk the shelf beside a deck is one tab stop, walked with
  // ↑/↓ (plan 123): 24 decks a page, more with More, were a tab stop each.
  const onShelfWalk = useListWalk(desk)
  const shelfRef = useRef(null)
  useFollowFocus(shelfRef, open, desk)

  const [decks, setDecks]     = useState([])
  const [total, setTotal]     = useState(0)
  const [types, setTypes]     = useState([])
  const [hasMore, setHasMore] = useState(false)
  const [page, setPage]       = useState(0)
  const [sort, setSort]       = useState('new')
  // What is typed, and what has actually been asked for. They differ
  // for the length of the debounce, and it is the second one the
  // request is keyed on — a fetch per keystroke is what the wait is for.
  const [query, setQuery]     = useState('')
  const [term, setTerm]       = useState('')
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
        setDecks(prev => (page === 0 ? data.results : [...prev, ...data.results]))
        setTotal(data.total)
        setHasMore(data.has_more)
        if (Array.isArray(data.types)) setTypes(data.types)
        setLoading(false)
        setFailed(false)
        // `filtered` and not the term: what was typed is a learner's
        // own words, and the trail never carries those (core/events.py).
        // Whether the console is used at all is a different question,
        // and one this can answer.
        if (page === 0) track('library_view', { sort, results: data.total, filtered: narrowed })
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

  const countLabel = total === 1 ? t.decksCountOne : t.decksCount.replace('{n}', total)
  const settled = !(loading && page === 0)

  const chrome = (
    <>
      {/* The way back, as every nested screen under 教材 carries one
          (the deck page's is the same word). It matters more now that
          the shelf's Browse door is how you get here: a trip out of
          your own decks wants the way back into them, and the tab
          under it only returns to the gate. */}
      <Bar
        code="KZ"
        color="var(--line-decks)"
        title={t.library}
        aside={<Leave to={'/learn/decks'}>{t.leaveDecks}</Leave>}
      />

      <Console>
        <ConsoleBand
          label={t.librarySort}
          value={sort}
          onChange={chooseSort}
          options={SORTS.map(key => ({
            key,
            label: key === 'new' ? t.librarySortNew : t.librarySortFollowed,
          }))}
        />
        {/* The row goes with the chips rather than standing empty: a
            console whose first row holds nothing is a hairline drawn
            for its own sake. */}
        {typeChips.length > 1 && (
          <ConsoleTop>
            <Chips label={t.libraryTypes}>
              <Chip on={structure === 'all'} color="var(--line-decks)"
                onClick={() => chooseStructure('all')}>
                {t.decksAllTypes}
              </Chip>
              {typeChips.map(dt => (
                <Chip key={dt.value} on={structure === dt.value} glyph={dt.glyph} color={dt.color}
                  onClick={() => chooseStructure(dt.value)}>
                  {dt.label}
                </Chip>
              ))}
            </Chips>
          </ConsoleTop>
        )}
        {/* The count slot holds a figure, not a wait: while the first
            page is in flight it says nothing rather than running a
            second loader beside the placeholder. The one wait for this
            moment is the <Loading /> under the console. */}
        <ConsoleIndex
          inputRef={searchRef}
          value={query}
          onChange={onSearch}
          onClear={clearQuery}
          placeholder={t.decksSearchPlaceholder}
          clearLabel={t.close}
          count={settled && !failed ? countLabel : undefined}
        />
      </Console>
    </>
  )

  const more = hasMore && (
    <button type="button" className="lib-shelf__more" disabled={loading}
      onClick={() => { playUi('click-mode-selection'); setPage(p => p + 1) }}>
      {t.libraryMore}
    </button>
  )

  if (desk) {
    // The shelf as a list, the open deck as the page beside it: another
    // deck swaps the page in place (a link replacing the URL, plan 117,
    // so a deck also opens in a tab of its own), and the bare library
    // opens on its first deck once the shelf has answered — never while
    // a narrowing is in flight, which would open a deck the narrowing is
    // about to take away.
    const listed = open ? decks.find(d => String(d.id) === String(open)) : null
    return (
      <main id="main-content" className="learn" style={{ '--line-color': 'var(--line-decks)' }}>
        {chrome}
        {!open && settled && !failed && decks.length > 0 && (
          <Navigate replace to={`/learn/decks/library/${decks[0].id}`} />
        )}
        <StationSplit
          className="desk-split--shelf"
          label={t.library}
          list={(
            <>
              {loading && page === 0 && <Loading />}
              {settled && failed && (
                <Empty icon={<BooksIcon size={40} />} message={t.libraryFailed} hint={t.libraryFailedHint} />
              )}
              {settled && !failed && decks.length === 0 && (
                narrowed ? (
                  <Empty
                    icon={<BooksIcon size={40} />}
                    message={t.decksNoMatch}
                    hint={t.decksNoMatchHint}
                    action={{ label: t.decksClearFilters, onClick: clearFilters }}
                  />
                ) : (
                  <Empty icon={<BooksIcon size={40} />} message={t.libraryEmpty} hint={t.libraryEmptyHint} />
                )
              )}
              {settled && decks.length > 0 && (
                <div className="platform-grid" ref={shelfRef} onKeyDown={onShelfWalk}>
                  {decks.map((deck, i) => (
                    <LibraryCard key={deck.id} deck={deck} t={t} open={String(deck.id) === String(open)}
                      to={`/learn/decks/library/${deck.id}`}
                      tabIndex={(listed ? String(deck.id) === String(open) : i === 0) ? 0 : -1} />
                  ))}
                </div>
              )}
              {more}
            </>
          )}
        >
          {open && <PublicDeckPane key={open} deckId={open} listed={listed} session={session} />}
        </StationSplit>
      </main>
    )
  }

  return (
    <main id="main-content" className="learn" style={{ '--line-color': 'var(--line-decks)' }}>
      {chrome}

      {loading && page === 0 && <Loading />}

      {settled && failed && (
        <Empty icon={<BooksIcon size={40} />} message={t.libraryFailed} hint={t.libraryFailedHint} />
      )}

      {/* An empty library and a search that found nothing are two
          different answers, and telling a learner nobody has published
          anything when what happened is that their word matched no deck
          sends them off the screen for good. */}
      {settled && !failed && decks.length === 0 && (
        narrowed ? (
          <Empty
            icon={<BooksIcon size={40} />}
            message={t.decksNoMatch}
            hint={t.decksNoMatchHint}
            action={{ label: t.decksClearFilters, onClick: clearFilters }}
          />
        ) : (
          <Empty icon={<BooksIcon size={40} />} message={t.libraryEmpty} hint={t.libraryEmptyHint} />
        )
      )}

      {/* `settled`, not just `decks.length`: re-sorting reloads page 0,
          and drawing the previous ordering under the waiting dots
          showed two answers at once. Paging (page > 0) keeps its rows,
          because there the old ones are still the right answer. */}
      {settled && decks.length > 0 && (
        <div className="platform-grid">
          {decks.map(deck => (
            <LibraryCard key={deck.id} deck={deck} t={t}
              onOpen={d => navigate(`/learn/decks/library/${d.id}`)} />
          ))}
        </div>
      )}

      {more}
    </main>
  )
}
