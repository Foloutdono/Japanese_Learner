import { useEffect, useState } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { apiFetch } from '../lib/api'
import { useLang } from '../LangContext'
import { board } from '../stores/boarding'
import { Leave } from '../components/chrome/Bar'
import SelectionScreen from '../components/selection/SelectionScreen'
import ModeSelector from '../components/selection/ModeSelector'
import { Loading } from '../components/ui/Loading'
import Empty from '../components/ui/Empty'
import { useDeckModes } from '../hooks/useDeckModes'

// ── 教材 — a deck's platforms (plan 071) ──────────────────────
// /learn/decks/:deck_id/study lists the deck's modes as platforms;
// picking one boards the train into /learn/decks/:deck_id/study/:mode
// on the stage frame (screens/StudyRun.jsx). ‹ Deck is the way back
// to the deck's own page. The modes are hooks/useDeckModes', which the
// desk's deck page stands beside its cards (plan 113).
export default function StudyScreen({ session }) {
  const { t } = useLang()
  const navigate = useNavigate()
  const { deck_id } = useParams()
  const { state } = useLocation()

  // Falls back to fetching the deck when opened without router state
  // (a refresh, a direct link).
  const [deck, setDeck] = useState(state?.deck ?? null)
  useEffect(() => {
    if (deck) return
    apiFetch(`/api/decks/${deck_id}`, session)
      .then(r => r.json())
      .then(d => { if (!d?.error) setDeck(d) })
      .catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deck_id])

  const modes = useDeckModes(deck_id, session)

  return (
    <SelectionScreen
      title={deck?.name ?? t.deckFallbackTitle}
      sub={t.decksTitle}
      aside={<Leave onClick={() => navigate(`/learn/decks/${deck_id}`, { state: { deck } })}>{t.leaveDeck}</Leave>}
    >
      {!modes && <Loading />}
      {modes && modes.length === 0 && <Empty message={t.noCards} />}
      {modes && modes.length > 0 && (
        <ModeSelector
          modes={modes}
          onSelect={m => board(() => navigate(`/learn/decks/${deck_id}/study/${m}`, { state: { deck } }))}
        />
      )}
    </SelectionScreen>
  )
}
