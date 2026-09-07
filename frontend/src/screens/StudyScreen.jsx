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
import { modeLabel, modeDesc } from '../domain/studyModes'

// ── 教材 — a deck's platforms (plan 071) ──────────────────────
// /learn/decks/:deck_id/study lists the deck's modes as platforms;
// picking one boards the train into /learn/decks/:deck_id/study/:mode
// on the stage frame (screens/StudyRun.jsx). ‹ Deck is the way back
// to the deck's own page.
//
// A deck's available modes come from its STRUCTURE (see decks.py's
// get_deck_modes): every graded key that structure's source offers,
// provided the deck actually has a card — rendered with the
// registry's own labels, so a mode's text is never out of sync with
// what it looks like once you're inside it.
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

  const [modes, setModes] = useState(null)
  useEffect(() => {
    if (!deck_id) return undefined
    let live = true
    apiFetch(`/api/decks/${deck_id}/modes`, session)
      .then(r => r.json())
      .then(data => {
        if (!live) return
        const keys = data.modes?.length ? data.modes : []
        setModes(keys.map(key => ({ key, label: modeLabel(t, key), desc: modeDesc(t, key) })))
      })
      .catch(() => { if (live) setModes([]) })
    return () => { live = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deck_id, session])

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
