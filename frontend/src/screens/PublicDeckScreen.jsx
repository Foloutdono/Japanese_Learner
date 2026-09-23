import { useNavigate, useParams } from 'react-router-dom'
import { useLang } from '../LangContext'
import { Bar, Leave } from '../components/chrome/Bar'
import Empty from '../components/ui/Empty'
import { Loading } from '../components/ui/Loading'
import { deckTypeOf } from '../components/decks/deckTypes'
import { PublicDeckBody } from '../components/decks/PublicDeckPage'
import { usePublicDeck } from '../hooks/usePublicDeck'
import { BooksIcon } from '../components/ui/Icons'

// ── One published deck, on a screen of its own ────────────────
// The phone's page for a deck in the library: the bar, then the deck's
// page (components/decks/PublicDeckPage.jsx, which says what the page
// is for). On the desk the same page stands beside the library's shelf
// instead (screens/LibraryScreen.jsx), and this screen is not drawn.

export default function PublicDeckScreen({ session }) {
  const { deck_id } = useParams()
  const navigate = useNavigate()
  const { t } = useLang()
  const { deck, loading, missing, reload } = usePublicDeck(deck_id, session)

  // The leave says `Retour` and not `Bibliothèque`, unlike every other
  // leave in the app, which names its destination: here the bar's own
  // title is already the library, and printing the word twice in one
  // header reads as a mistake rather than as a sign.
  if (loading) {
    return (
      <main id="main-content" className="learn" style={{ '--line-color': 'var(--line-decks)' }}>
        <Bar code="KZ" color="var(--line-decks)" title={t.library}
          aside={<Leave to={'/learn/decks/library'}>{t.back}</Leave>} />
        <Loading />
      </main>
    )
  }

  if (missing || !deck) {
    return (
      <main id="main-content" className="learn" style={{ '--line-color': 'var(--line-decks)' }}>
        <Bar code="KZ" color="var(--line-decks)" title={t.library}
          aside={<Leave to={'/learn/decks/library'}>{t.back}</Leave>} />
        <Empty icon={<BooksIcon size={40} />} message={t.libraryGone} hint={t.libraryGoneHint}
          action={{ label: t.librarySeeAll, onClick: () => navigate('/learn/decks/library') }} />
      </main>
    )
  }

  return (
    <main id="main-content" className="learn" style={{ '--line-color': deckTypeOf(deck.type, t).color }}>
      <Bar code="KZ" color="var(--line-decks)" title={t.library}
          aside={<Leave to={'/learn/decks/library'}>{t.back}</Leave>} />
      <PublicDeckBody deck={deck} deckId={deck_id} session={session} onReload={reload} />
    </main>
  )
}
