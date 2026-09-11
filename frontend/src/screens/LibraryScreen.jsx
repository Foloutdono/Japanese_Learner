import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiJson } from '../lib/api'
import { useLang } from '../LangContext'
import { playUi } from '../lib/audio'
import { track } from '../lib/track'
import { Bar } from '../components/chrome/Bar'
import { Seg } from '../components/chrome/Console'
import Empty from '../components/ui/Empty'
import { Loading } from '../components/ui/Loading'
import { LibraryCard } from '../components/decks/LibraryCard'
import { BooksIcon } from '../components/ui/Icons'

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
// The two orderings are a Seg and not two chips, per DESIGN.md:
// anything that picks one of two views of the SAME data is a segmented
// control, not a pair of buttons that both look pressable. There is no
// Console here either — a console's second row is a search field, and
// the library has nothing to search yet; half a console with a dead
// field in it would be worse than none.

const SORTS = ['new', 'followed']

export default function LibraryScreen({ session }) {
  const navigate = useNavigate()
  const { t } = useLang()

  const [decks, setDecks]     = useState([])
  const [total, setTotal]     = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [page, setPage]       = useState(0)
  const [sort, setSort]       = useState('new')
  const [loading, setLoading] = useState(true)
  const [failed, setFailed]   = useState(false)

  useEffect(() => {
    let live = true
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the shelf's own load, not a state reset: sort and page ARE the request.
    setLoading(true)
    apiJson(`/api/decks/library?sort=${sort}&page=${page}`, session)
      .then(data => {
        if (!live) return
        // Paging appends: the shelf grows downward rather than
        // replacing itself, so the card you were reading stays put.
        setDecks(prev => (page === 0 ? data.results : [...prev, ...data.results]))
        setTotal(data.total)
        setHasMore(data.has_more)
        setLoading(false)
        setFailed(false)
        if (page === 0) track('library_view', { sort, results: data.total })
      })
      .catch(() => { if (live) { setLoading(false); setFailed(true) } })
    return () => { live = false }
  }, [session, sort, page])

  function chooseSort(next) {
    playUi('click-mode-selection')
    setPage(0)
    setSort(next)
  }

  const countLabel = total === 1 ? t.decksCountOne : t.decksCount.replace('{n}', total)
  const settled = !(loading && page === 0)

  return (
    <main id="main-content" className="learn" style={{ '--line-color': 'var(--line-decks)' }}>
      <Bar code="KZ" color="var(--line-decks)" title={t.library} />

      <div className="lib-controls">
        <Seg
          label={t.librarySort}
          value={sort}
          onChange={chooseSort}
          options={SORTS.map(key => ({
            key,
            label: key === 'new' ? t.librarySortNew : t.librarySortFollowed,
          }))}
        />
        {settled && !failed && <span className="lib-controls__count">{countLabel}</span>}
      </div>

      {loading && page === 0 && <Loading />}

      {settled && failed && (
        <Empty icon={<BooksIcon size={40} />} message={t.libraryFailed} hint={t.libraryFailedHint} />
      )}

      {settled && !failed && decks.length === 0 && (
        <Empty icon={<BooksIcon size={40} />} message={t.libraryEmpty} hint={t.libraryEmptyHint} />
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

      {hasMore && (
        <button type="button" className="lib-shelf__more" disabled={loading}
          onClick={() => { playUi('click-mode-selection'); setPage(p => p + 1) }}>
          {t.libraryMore}
        </button>
      )}
    </main>
  )
}
