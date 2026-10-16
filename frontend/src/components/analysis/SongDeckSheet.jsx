import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Sheet } from '../chrome/Sheet'
import { deckTypeOf } from '../decks/deckTypes'
import { CheckIcon, ChevronIcon } from '../ui/Icons'
import { Dots } from '../ui/Loading'
import { apiJson } from '../../lib/api'
import { track } from '../../lib/track'
import { composing } from '../../lib/keyGuards'
import { songWords, songLines, songDeckName } from './songDeck'

// ── 歌 — make the song yours (plan 215) ──────────────────────────
// The result's second door beside 保存: where keeping takes ONE line
// into the bank, this takes the whole song -- a video's track, or lyrics
// pasted or photographed -- into one of the learner's decks: its words,
// to understand it, and its lines with their readings, to read it aloud
// in time (songDeck.js says what each holds).
//
// One deck, of the mixed type (routes/decks.py), which holds app cards
// beside written ones and studies each in its own modes: the words as
// vocab, the lines as front/back pairs. Nothing here is a new endpoint.
// The deck is made the way the analyser's ＋ makes one (useMining's
// ensureDeck, which reuses a deck of the same name rather than minting a
// clone), the words go in as one batch of app cards, and the lines in
// the import dialog's slices. Pressed a second time for the same song,
// it tops the deck up: a word already there conflicts and counts nothing
// on the server, and a line already there is not written again.

// The written-card batch's ceiling (routes/decks.py's MAX_BATCH).
const BATCH = 25

export function SongDeckSheet({ session, mining, sentences, title, t, onClose }) {
  const words = useMemo(() => songWords(sentences), [sentences])
  const lines = useMemo(() => songLines(sentences), [sentences])
  const [name, setName] = useState(() => songDeckName(title, sentences))
  const [pick, setPick] = useState({ words: true, lines: true })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  // The deck made, once it is: the sheet turns into the door to it.
  const [made, setMade] = useState(null)

  const takes = {
    words: pick.words && words.length > 0,
    lines: pick.lines && lines.length > 0,
  }
  const ready = Boolean(name.trim()) && (takes.words || takes.lines) && !busy

  async function addWords(deck) {
    await apiJson(`/api/decks/${deck.id}/cards/app`, session, {
      method: 'POST',
      body: JSON.stringify({ cards: words }),
    })
  }

  // Returns whether the free tier's card ceiling stopped a slice: the
  // batch reports a refused row by its index rather than failing whole.
  async function addLines(deck) {
    const held = await apiJson(`/api/decks/${deck.id}/cards`, session)
    const have = new Set((held?.cards ?? []).filter(c => c.origin === 'custom').map(c => c.front))
    const fresh = lines.filter(line => !have.has(line.front))
    let refused = false
    for (let i = 0; i < fresh.length && !refused; i += BATCH) {
      const result = await apiJson(`/api/decks/${deck.id}/cards/batch`, session, {
        method: 'POST',
        body: JSON.stringify({ cards: fresh.slice(i, i + BATCH) }),
      })
      refused = (result?.errors ?? []).some(e => e.limit)
    }
    return refused
  }

  async function create(e) {
    e.preventDefault()
    if (!ready) return
    setBusy(true)
    setError(null)
    let deck = null
    try {
      deck = await mining.ensureDeck('mixed', name.trim(), { remember: false })
      if (takes.words) await addWords(deck)
      if (takes.lines && await addLines(deck)) setError(t.songDeckLimit)
      // Counts only: the song's name is the learner's own words.
      track('song_deck', { words: takes.words ? words.length : 0, lines: takes.lines ? lines.length : 0 })
      setMade(deck)
    } catch (err) {
      // A deck already made stays reachable when what goes in it fails.
      if (deck) setMade(deck)
      setError(err?.code === 'limit_reached' ? t.songDeckLimit : t.songDeckFailed)
    } finally {
      setBusy(false)
    }
  }

  const wordsType = deckTypeOf('vocab', t)
  const linesType = deckTypeOf('standard', t)
  const deckType = deckTypeOf('mixed', t)
  const count = (takes.words ? words.length : 0) + (takes.lines ? lines.length : 0)

  return (
    <Sheet open onClose={onClose} jp={t.songDeckTitle} label={t.songDeckTitle} className="anl-song-sheet" dismiss>
      {made ? (
        <div className="surface picker anl-song__made">
          <Link to={`/learn/decks/${made.id}`} className="picker-row anl-song__deck">
            <span
              className="wmap-roundel picker-row__roundel"
              style={{ '--line-color': deckType.color }}
              lang="ja"
              aria-hidden="true"
            >
              {deckType.glyph}
            </span>
            <span className="picker-row__name">{made.name}</span>
            <span className="picker-row__count">{t.cardsUnit(count)}</span>
            <ChevronIcon direction="right" size={16} />
          </Link>
          {error && <p className="anl-song__error" role="alert">{error}</p>}
        </div>
      ) : (
        <form className="anl-song" onSubmit={create} noValidate>
          {/* S1 (plan 220, the owner's pick of two drawn): the two halves
              as two cards to tick, each saying what it is for, where they
              were two chips whose being a choice nothing said. */}
          <fieldset className="anl-song__halves">
            <legend className="sr-only">{t.songDeckHolds}</legend>
            {[
              ['words', wordsType, t.songDeckWords, words.length, t.songDeckWordsDesc],
              ['lines', linesType, t.songDeckLines, lines.length, t.songDeckLinesDesc],
            ].map(([key, type, title, n, desc]) => (
              <label
                key={key}
                className={`anl-song__half${takes[key] ? ' anl-song__half--on' : ''}${n === 0 ? ' anl-song__half--none' : ''}`}
                style={{ '--line-color': type.color }}
              >
                <input
                  type="checkbox"
                  className="anl-song__check"
                  checked={takes[key]}
                  disabled={n === 0}
                  onChange={() => setPick(p => ({ ...p, [key]: !p[key] }))}
                />
                <span className="wmap-roundel anl-song__roundel" lang="ja" aria-hidden="true">{type.glyph}</span>
                <span className="anl-song__text">
                  <span className="anl-song__title">{title} <span className="anl-song__n">· {n}</span></span>
                  <span className="anl-song__desc">{desc}</span>
                </span>
                <span className="anl-song__box" aria-hidden="true">{takes[key] && <CheckIcon size={14} />}</span>
              </label>
            ))}
          </fieldset>
          {/* After the halves, not before: a phone's sheet focuses its first
              control, and a field there would open the keyboard over a
              name the sheet already proposes. */}
          <label className="anl-song__name">
            <span className="anl-song__label">{t.songDeckName}</span>
            <input
              className="field"
              value={name}
              onChange={e => setName(e.target.value)}
              // The Enter that commits a conversion is the input method's,
              // not the form's: a song named in Japanese is typed through one.
              onKeyDown={e => { if (e.key === 'Enter' && composing(e)) e.preventDefault() }}
              maxLength={120}
            />
          </label>
          {error && <p className="anl-song__error" role="alert">{error}</p>}
          <button type="submit" className="btn-primary" disabled={!ready}>
            {busy ? <>{t.songDeckMaking}<Dots /></> : t.songDeckCreate(count)}
          </button>
        </form>
      )}
    </Sheet>
  )
}
