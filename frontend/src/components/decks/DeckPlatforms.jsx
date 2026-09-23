import { useNavigate } from 'react-router-dom'
import { useLang } from '../../LangContext'
import { board } from '../../stores/boarding'
import { useDeckModes } from '../../hooks/useDeckModes'
import ModeSelector from '../selection/ModeSelector'
import { Loading } from '../ui/Loading'
import Empty from '../ui/Empty'

// ── 机 — a deck's platforms, beside its cards (plan 113) ────────────
// On a phone a deck's page ends in ▶ Study, which opens a second screen
// of platforms (screens/StudyScreen.jsx). On the desk the platforms
// stand in the page's second column from the start, and a platform
// boards its run directly: one screen, one click from the cards to the
// train. The modes are the same hook's (hooks/useDeckModes), refetched
// when the deck stops (or starts) being empty — adding its first card
// is what opens its modes. Rendered only on the desk, so a phone never fetches
// for it.
export function DeckPlatforms({ deckId, deck, session, cardCount }) {
  const { t } = useLang()
  const navigate = useNavigate()
  // Its emptiness, not its count: a deck's modes turn on whether it has
  // a card (routes/decks.py's get_deck_modes), so the tenth card asks
  // nothing the first did not.
  const modes = useDeckModes(deckId, session, cardCount > 0)
  return (
    <section className="desk-deck__study" aria-labelledby="desk-deck-study">
      <h2 id="desk-deck-study" className="desk-deck__cap">{t.study}</h2>
      {!modes && <Loading />}
      {/* An empty deck says so once, in the page beside this (plan 114). */}
      {modes && modes.length === 0 && cardCount > 0 && <Empty message={t.noCards} />}
      {modes && modes.length > 0 && (
        <ModeSelector
          modes={modes}
          onSelect={m => board(() => navigate(`/learn/decks/${deckId}/study/${m}`, { state: { deck } }))}
        />
      )}
    </section>
  )
}
