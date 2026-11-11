import { apiJson } from '../../lib/api'

// ── What a song's cards are written with (plans 215, 263) ─────────
// The two halves songDeck.js reads off a Passage go into a deck the
// way the song sheet first wrote them, and the keep sheet writes them
// the same way: the words as one batch of app cards, the lines in the
// import dialog's slices. Nothing here is a new endpoint.

// The written-card batch's ceiling (routes/decks.py's MAX_BATCH).
const BATCH = 25

export async function addWords(session, deckId, words) {
  if (!words.length) return
  await apiJson(`/api/decks/${deckId}/cards/app`, session, {
    method: 'POST',
    body: JSON.stringify({ cards: words }),
  })
}

/** The fronts of the written cards a deck already holds: a line already
 *  there is not written again. */
export async function heldLines(session, deckId) {
  const held = await apiJson(`/api/decks/${deckId}/cards`, session)
  return new Set((held?.cards ?? []).filter(c => c.origin === 'custom').map(c => c.front))
}

/** Writes the lines the deck lacks. Returns whether the free tier's card
 *  ceiling stopped a slice: the batch reports a refused row by its index
 *  rather than failing whole. */
export async function addLines(session, deckId, lines) {
  const have = await heldLines(session, deckId)
  const fresh = lines.filter(line => !have.has(line.front))
  let refused = false
  for (let i = 0; i < fresh.length && !refused; i += BATCH) {
    const result = await apiJson(`/api/decks/${deckId}/cards/batch`, session, {
      method: 'POST',
      body: JSON.stringify({ cards: fresh.slice(i, i + BATCH) }),
    })
    refused = (result?.errors ?? []).some(e => e.limit)
  }
  return refused
}
