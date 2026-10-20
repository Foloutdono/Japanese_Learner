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
  // `kana` joined the rest with plan 089, when the dictionary's panel
  // grew a ＋ on every kind of entry and a kana was the one with
  // nowhere to put it (backend/routes/decks.py's SOURCE_FOR_TYPE).
  kana: 'kana',
  vocab: 'vocab',
  kanji: 'kanji',
  grammar: 'grammar',
  cloze: 'standard',
  mixed: 'mixed',
  // The song sheet's own deck (plan 262; a mixed one before it), which
  // holds both halves.
  lyrics: 'lyrics',
}
// A mixed deck (plan 215) takes every kind above: an app card of any
// source, and a written front/back pair -- so it is offered beside the
// decks of the kind's own type, wherever something can be added. A
// lyrics deck (plan 262) holds the same, and is offered the same: a
// word met in a song goes in the song's deck.
const TAKES_EVERY_KIND = new Set(['mixed', 'lyrics'])

const STORAGE_PREFIX = 'jp-mine-target'
const BLANK = '＿＿＿'
// The deck creates on their way, by learner, type and name (ensureDeck).
const creating = new Map()

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
// analysis surface (TokenCard, the words' rows, GrammarChips). One instance
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

  const decksTaking = useCallback(
    type => decks.filter(d => d.type === type || TAKES_EVERY_KIND.has(d.type)),
    [decks]
  )

  // The remembered deck for `kind`, or null when none is remembered OR
  // the remembered id no longer matches a deck that takes it (e.g. it
  // was deleted, or its type changed).
  const targetFor = useCallback(kind => {
    const type = DECK_TYPE_FOR_KIND[kind]
    const storedId = readStoredTarget(kind)
    if (!storedId) return null
    return decksTaking(type).find(d => String(d.id) === storedId) ?? null
  }, [decksTaking])

  const decksFor = useCallback(kind => decksTaking(DECK_TYPE_FOR_KIND[kind]), [decksTaking])

  function rememberTarget(kind, deckId) {
    writeStoredTarget(kind, deckId)
  }

  // Reuse before create: typing an existing deck's name into the
  // picker used to POST unconditionally and mint a clone every time —
  // eleven identical « Mots du boulot » decks in one real account. A
  // same-type deck whose name matches (trimmed, case-insensitively) IS
  // the deck the learner meant -- one of their own: a deck followed from
  // the library shares the shelf (GET /api/decks) but takes no cards
  // from anyone but its author.
  //
  // `remember: false` makes a deck without making it where the next ＋
  // goes: the song sheet (plan 215) makes a song's decks in one press,
  // and a word mined afterwards should still land where the learner
  // last sent one.
  async function ensureDeck(kind, name, { remember = true } = {}) {
    const type = DECK_TYPE_FOR_KIND[kind]
    const wanted = name.trim().toLowerCase()
    const existing = decksTaking(type).find(d => (d.role ?? 'owner') === 'owner'
      && (d.name ?? '').trim().toLowerCase() === wanted)
    if (existing) {
      if (remember) rememberTarget(kind, existing.id)
      return existing
    }
    // A create already on its way under this name is the same deck
    // (plan 211): Enter held in the picker, or two words mined into a
    // new deck at once, each posted one before the shelf knew of it.
    const key = `${session?.user?.id ?? ''} ${type} ${wanted}`
    let pending = creating.get(key)
    if (!pending) {
      pending = apiJson('/api/decks', session, {
        method: 'POST',
        body: JSON.stringify({ name, type }),
      }).finally(() => creating.delete(key))
      creating.set(key, pending)
    }
    const deck = await pending
    setDecks(prev => (prev.some(d => d.id === deck.id) ? prev : [deck, ...prev]))
    if (remember) rememberTarget(kind, deck.id)
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
