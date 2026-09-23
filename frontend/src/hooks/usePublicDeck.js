import { useCallback, useEffect, useState } from 'react'
import { apiJson, ApiError } from '../lib/api'

// ── A published deck, as the library serves it (plan 114) ──────────
// Shared by the phone's page for it (screens/PublicDeckScreen.jsx) and
// the desk's pane beside the shelf (components/decks/PublicDeckPage.jsx).
// `missing` is a 404 — a deck withdrawn or never published — which the
// page says rather than spinning; any other failure leaves the deck
// unset. Each answer is kept only while it is still the deck asked for.
export function usePublicDeck(deckId, session) {
  const [deck, setDeck]       = useState(null)
  const [loading, setLoading] = useState(true)
  const [missing, setMissing] = useState(false)

  const load = useCallback(() => {
    let live = true
    setLoading(true)
    setMissing(false)
    apiJson(`/api/decks/library/${deckId}`, session)
      .then(data => { if (live) { setDeck(data); setLoading(false) } })
      .catch(err => {
        if (!live) return
        setLoading(false)
        setMissing(err instanceof ApiError && err.status === 404)
      })
    return () => { live = false }
  }, [deckId, session])

  // eslint-disable-next-line react-hooks/set-state-in-effect -- load() is this page's initial fetch, not a state reset.
  useEffect(load, [load])

  return { deck, loading, missing, reload: load }
}
