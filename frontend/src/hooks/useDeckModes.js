import { useEffect, useState } from 'react'
import { apiFetch } from '../lib/api'
import { useLang } from '../LangContext'
import { modeLabel, modeDesc } from '../domain/studyModes'

// ── A deck's platforms (plan 071; shared since plan 114) ───────────
// A deck's available modes come from its STRUCTURE (see decks.py's
// get_deck_modes): every graded key that structure's source offers,
// provided the deck actually has a card — rendered with the registry's
// own labels, so a mode's text is never out of sync with what it looks
// like once you're inside it.
//
// null while loading, [] when there is nothing to study. `refresh` is
// any value that says the answer may have changed — the desk's deck
// page passes whether the deck has a card, since its first card is what
// opens its modes.
export function useDeckModes(deckId, session, refresh) {
  const { t } = useLang()
  const [modes, setModes] = useState(null)
  useEffect(() => {
    if (!deckId) return undefined
    let live = true
    apiFetch(`/api/decks/${deckId}/modes`, session)
      .then(r => r.json())
      .then(data => {
        if (!live) return
        const keys = data.modes?.length ? data.modes : []
        setModes(keys.map(key => ({ key, label: modeLabel(t, key), desc: modeDesc(t, key) })))
      })
      .catch(() => { if (live) setModes([]) })
    return () => { live = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deckId, session, refresh])
  return modes
}
