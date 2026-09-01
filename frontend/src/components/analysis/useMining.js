import { useState, useEffect, useCallback } from 'react'
import { apiJson } from '../../lib/api'

// Which deck TYPE a mined item of this kind must land in. A deck holds
// exactly one structure (backend/routes/decks.py's
// REGISTRY_SOURCE_FOR_TYPE), so offering a mismatched deck is worse
// than offering none: add_app_cards would silently skip it and the
// learner would see nothing happen. `cloze` has no app source of its
// own -- it's a hand-written card, so it targets a `standard` deck by
// convention (see plans/017's "no cloze structure" note).
const DECK_TYPE_FOR_KIND = {
  vocab: 'vocab',
  kanji: 'kanji',
  grammar: 'grammar',
  cloze: 'standard',
}

const STORAGE_PREFIX = 'jp-mine-target'
const BLANK = '＿＿＿'

// A cloze card built from ONE Token within a Sentence -- entirely
// client-side, from data the analysis already carries. Exported as a
// plain function (not part of the hook) so it can be unit-tested
// directly without rendering anything.
//
// `front` blanks the token's span using its start/end OFFSETS, not a
// string.replace on its surface text -- a word appearing twice in the
// same Sentence would otherwise have BOTH occurrences blanked, and the
// learner would have no idea which one the card is asking about.
export function buildCloze(sentenceText, token) {
  const front = sentenceText.slice(0, token.start) + BLANK + sentenceText.slice(token.end)
  const back =
    token.meaning
    || token.vocab_match?.entry?.meaning
    || `${token.surface}${token.reading ? ` (${token.reading})` : ''}`
  return { front, back, notes: sentenceText }
}

function readStoredTarget(kind) {
  try {
    return localStorage.getItem(`${STORAGE_PREFIX}:${kind}`)
  } catch {
    // Private window, blocked site data, etc. -- degrade to "ask each
    // time" rather than throw.
    return null
  }
}

function writeStoredTarget(kind, deckId) {
  try {
    localStorage.setItem(`${STORAGE_PREFIX}:${kind}`, String(deckId))
  } catch {
    // Same as above -- losing the remembered choice is fine, breaking
    // the mine action is not.
  }
}

// Owns "which deck does this go in" for every mining control on an
// analysis surface (TokenCard, WordDetail, GrammarChips). One instance
// per screen; every mine control reads from it.
export function useMining(session) {
  const [decks, setDecks] = useState([])
  const [loaded, setLoaded] = useState(false)
  // The last mine outcome across every control sharing this instance,
  // so the screen (not MineButton, which is rendered many times over)
  // can announce it through the one aria-live region it owns.
  const [lastOutcome, setLastOutcome] = useState(null)

  useEffect(() => {
    let cancelled = false
    apiJson('/api/decks', session)
      .then(data => { if (!cancelled) setDecks(data.decks ?? []) })
      .catch(() => { if (!cancelled) setDecks([]) })
      .finally(() => { if (!cancelled) setLoaded(true) })
    return () => { cancelled = true }
  }, [session])

  const decksOfType = useCallback(
    type => decks.filter(d => d.type === type),
    [decks]
  )

  // The remembered deck for `kind`, or null when none is remembered OR
  // the remembered id no longer matches a deck of the right type (e.g.
  // it was deleted, or its type changed).
  const targetFor = useCallback(kind => {
    const type = DECK_TYPE_FOR_KIND[kind]
    const storedId = readStoredTarget(kind)
    if (!storedId) return null
    return decksOfType(type).find(d => String(d.id) === storedId) ?? null
  }, [decksOfType])

  const decksFor = useCallback(kind => decksOfType(DECK_TYPE_FOR_KIND[kind]), [decksOfType])

  function rememberTarget(kind, deckId) {
    writeStoredTarget(kind, deckId)
  }

  // Reuse before create: typing an existing deck's name into the
  // picker used to POST unconditionally and mint a clone every time —
  // eleven identical « Mots du boulot » decks in one real account. A
  // same-type deck whose name matches (trimmed, case-insensitively) IS
  // the deck the learner meant.
  async function ensureDeck(kind, name) {
    const type = DECK_TYPE_FOR_KIND[kind]
    const wanted = name.trim().toLowerCase()
    const existing = decksOfType(type).find(d => (d.name ?? '').trim().toLowerCase() === wanted)
    if (existing) {
      rememberTarget(kind, existing.id)
      return existing
    }
    const deck = await apiJson('/api/decks', session, {
      method: 'POST',
      body: JSON.stringify({ name, type }),
    })
    setDecks(prev => [deck, ...prev])
    rememberTarget(kind, deck.id)
    return deck
  }

  // Posts a SINGLE-element batch -- add_app_cards is a batch endpoint,
  // but every mine action here is one card at a time. Returns the
  // server's `added` count, which callers must read: 0 is a real,
  // distinct outcome ("already in this deck" or a stale raw_id), not a
  // failure and not silently the same as 1.
  async function mineApp({ deckId, source, level, rawId, kind }) {
    try {
      const result = await apiJson(`/api/decks/${deckId}/cards/app`, session, {
        method: 'POST',
        body: JSON.stringify({ cards: [{ source, level, raw_id: rawId }] }),
      })
      if (kind) rememberTarget(kind, deckId)
      const added = result.added ?? 0
      setLastOutcome({ kind, count: added })
      return added
    } catch (e) {
      setLastOutcome({ kind, error: true })
      throw e
    }
  }

  async function mineCloze({ deckId, front, back, notes }) {
    // add_card's `standard` structure requires both front and back
    // non-empty (study/structures.py's missing_required) -- rejecting
    // here gives a clear, local error instead of an opaque 400 from
    // the server.
    if (!front?.trim() || !back?.trim()) {
      throw new Error('Cloze card needs both a front and a back')
    }
    try {
      const card = await apiJson(`/api/decks/${deckId}/cards`, session, {
        method: 'POST',
        body: JSON.stringify({ front, back, notes }),
      })
      rememberTarget('cloze', deckId)
      setLastOutcome({ kind: 'cloze', count: 1 })
      return card
    } catch (e) {
      setLastOutcome({ kind: 'cloze', error: true })
      throw e
    }
  }

  return { loaded, decksFor, targetFor, ensureDeck, mineApp, mineCloze, rememberTarget, lastOutcome }
}
