import { useRef } from 'react'
import { Navigate, useLocation, useNavigate, useParams } from 'react-router-dom'
import { useLang } from '../LangContext'
import { Bar, Leave } from '../components/chrome/Bar'
import { LibraryCard } from '../components/decks/LibraryCard'
import { useDesk } from '../hooks/useDesk'
import { useListWalk, useFollowFocus, WALK_KEYS } from '../hooks/useListWalk'
import { StationSplit } from '../components/selection/StationSplit'
import { PublicDeckPane } from '../components/decks/PublicDeckPage'
import PublicDeckScreen from './PublicDeckScreen'
import { LibraryConsole, LibraryResults } from '../components/decks/LibraryCatalogue'
import { useLibrary } from '../components/decks/useLibrary'

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
// The console and the paged shelf it narrows are the catalogue's
// (components/decks/LibraryCatalogue): this screen is where they stand.

// ── 机 — the shelf beside a deck's page (plan 115) ──
// Both library routes land here (App.jsx). On a phone a deck is a
// screen of its own, as it always was. On the desk the shelf stays and
// the open deck's page stands beside it (PublicDeckPane): one route
// component for both paths is what keeps the shelf's search, its
// narrowing and its paging while the deck beside it changes.
//
// The bare library is not a screen of its own on the desk any more
// (plan 269): it is the page of the Bibliothèque, beside the learner's
// own shelf (screens/DecksScreen), so it goes there, carrying the term
// a search field sent it with.
export default function LibraryScreen({ session }) {
  const { deck_id } = useParams()
  const desk = useDesk()
  const { search } = useLocation()
  if (deck_id && !desk) return <PublicDeckScreen session={session} />
  if (desk && !deck_id) return <Navigate replace to={`/learn/decks${search}`} />
  return <LibraryShelf session={session} open={desk ? deck_id : null} />
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
  const lib = useLibrary(session)

  const chrome = (
    <>
      {/* The way back, as every nested screen under 教材 carries one
          (the deck page's is the same word). On the desk the rail's
          Bibliothèque is that door, and the Bar drops it. */}
      <Bar
        code="KZ"
        color="var(--line-decks)"
        title={t.library}
        aside={<Leave to={'/learn/decks'}>{t.leaveDecks}</Leave>}
      />
      <LibraryConsole lib={lib} />
    </>
  )

  if (desk) {
    // The shelf as a list, the open deck as the page beside it: another
    // deck swaps the page in place (a link replacing the URL, plan 117,
    // so a deck also opens in a tab of its own).
    const listed = lib.decks.find(d => String(d.id) === String(open)) ?? null
    return (
      <main id="main-content" className="learn" style={{ '--line-color': 'var(--line-decks)' }}>
        {chrome}
        <StationSplit
          className="desk-split--shelf"
          label={t.library}
          list={(
            <LibraryResults
              lib={lib}
              cards={decks => (
                <div className="platform-grid" ref={shelfRef} onKeyDown={onShelfWalk} aria-keyshortcuts={WALK_KEYS}>
                  {decks.map((deck, i) => (
                    <LibraryCard key={deck.id} deck={deck} t={t} open={String(deck.id) === String(open)}
                      to={`/learn/decks/library/${deck.id}`}
                      tabIndex={(listed ? String(deck.id) === String(open) : i === 0) ? 0 : -1} />
                  ))}
                </div>
              )}
            />
          )}
        >
          <PublicDeckPane key={open} deckId={open} listed={listed} session={session} />
        </StationSplit>
      </main>
    )
  }

  return (
    <main id="main-content" className="learn" style={{ '--line-color': 'var(--line-decks)' }}>
      {chrome}
      <LibraryResults
        lib={lib}
        cards={decks => (
          <div className="platform-grid">
            {decks.map(deck => (
              <LibraryCard key={deck.id} deck={deck} t={t}
                onOpen={d => navigate(`/learn/decks/library/${d.id}`)} />
            ))}
          </div>
        )}
      />
    </main>
  )
}
