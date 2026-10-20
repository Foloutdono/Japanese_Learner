import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLang } from '../../LangContext'
import { Sheet } from '../chrome/Sheet'
import { deckTypeOf } from '../decks/deckTypes'
import { ChevronIcon, PlusIcon } from '../ui/Icons'
import { Dots } from '../ui/Loading'
import { track } from '../../lib/track'
import { composing } from '../../lib/keyGuards'
import { lineReading, songDeckName, songLines, songWordRows } from './songDeck'
import { addLines, addWords, heldLines } from './songDeckApi'

// ── 保存 — keeping a line puts it in a deck (plan 263) ────────────
// The owner's pick of the canvas "Analyser stage — reading options"
// (K3·a, redrawn): the phone's Garder no longer only pins the line to
// the learner's own list, it makes the line study. One sheet, three
// faces:
//
//   main   Garder dans: the deck (the song's own by default, Changer to
//          pick another), the line with its reading, and its words as
//          chips -- a word the SRS says is mastered offered unticked.
//          The one filled action counts the cards it writes; Garder
//          sans deck is the pin it always was.
//   deck   the learner's own decks that take a line or a word: a mixed
//          deck takes both, a vocab deck the words, a standard deck the
//          lines (useMining's DECK_TYPE_FOR_KIND); + Nouveau deck names
//          one. The song's deck comes first, made on the press if there
//          is none of its name yet.
//   lines  the whole Passage, a line a row, ticked to go in with the
//          line in hand: all of them, the ones kept already, the ones
//          with a word the learner does not know, none. A line the deck
//          already holds is shown and cannot be ticked again.
//
// Garder pins the line in hand to the learner's list as well, as the
// old button did. The other lines picked go to the deck alone: pinning
// a whole song is eighty-eight requests for a list nobody scrolls.
//
// The writes are the song sheet's (songDeckApi.js); a deck is made the
// way the analyser's ＋ makes one (useMining's ensureDeck, which reuses
// a deck of the same name rather than minting a clone).

const TAKES = {
  mixed: { words: true, lines: true },
  vocab: { words: true, lines: false },
  standard: { words: false, lines: true },
}
const NOTHING = new Set()
// Past this many, the words fold behind a "+n" chip.
const WORDS_SHOWN = 6

function readableLine(sentence) {
  return Boolean(sentence?.text?.trim()) && !sentence.foreign && sentence.available !== false
}

export function KeepSheet({ session, mining, sentences, focusIndex, kept, title, onPin, onUnpin, t, onClose }) {
  const songName = useMemo(() => songDeckName(title, sentences), [title, sentences])
  // The learner's own decks that take something from a line. A deck
  // followed from the library takes cards from nobody but its author.
  const decks = useMemo(() => {
    const seen = new Set()
    return [...(mining.decksFor?.('vocab') ?? []), ...(mining.decksFor?.('cloze') ?? [])]
      .filter(d => TAKES[d.type] && (d.role ?? 'owner') === 'owner' && !seen.has(d.id) && seen.add(d.id))
  }, [mining])
  const songDeck = useMemo(
    () => decks.find(d => d.type === 'mixed' && (d.name ?? '').trim().toLowerCase() === songName.trim().toLowerCase())
      ?? { id: null, name: songName, type: 'mixed' },
    [decks, songName],
  )

  const [view, setView] = useState('main')
  const [target, setTarget] = useState(null)
  const deck = target ?? songDeck
  const takes = TAKES[deck.type] ?? TAKES.mixed
  const [picked, setPicked] = useState(() => new Set([focusIndex]))
  const [lineOn, setLineOn] = useState(true)
  const [wordsOn, setWordsOn] = useState(true)
  // A word's tick where the learner changed it; untouched, a word is
  // ticked unless it is mastered.
  const [wordTick, setWordTick] = useState(() => new Map())
  const [allWords, setAllWords] = useState(false)
  const [heldIn, setHeldIn] = useState({ id: null, fronts: NOTHING })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [made, setMade] = useState(null)

  // What the deck holds already, so a line in it is neither counted nor
  // ticked twice. A deck not made yet holds nothing.
  useEffect(() => {
    if (!deck.id || !takes.lines) return undefined
    let cancelled = false
    heldLines(session, deck.id)
      .then(fronts => { if (!cancelled) setHeldIn({ id: deck.id, fronts }) })
      .catch(() => { /* none known: addLines reads the deck again before it writes */ })
    return () => { cancelled = true }
  }, [session, deck.id, takes.lines])
  const held = deck.id && takes.lines && heldIn.id === deck.id ? heldIn.fronts : NOTHING

  const chosen = useMemo(
    () => [...picked].sort((a, b) => a - b).map(i => sentences[i]).filter(Boolean),
    [picked, sentences],
  )
  const lines = useMemo(() => songLines(chosen).filter(line => !held.has(line.front)), [chosen, held])
  const words = useMemo(() => songWordRows(chosen), [chosen])
  const ticked = word => wordTick.get(word.ref.raw_id) ?? !word.known
  const takeLines = takes.lines && lineOn ? lines : []
  const takeWords = takes.words && wordsOn ? words.filter(ticked).map(w => w.ref) : []
  const count = takeLines.length + takeWords.length
  const focused = sentences[focusIndex]
  const pinned = Boolean(focused) && kept.has(focused.text)
  const several = sentences.length > 1

  // Each face lands on its first control, as the sheet's opening does.
  const bodyRef = useRef(null)
  const firstView = useRef(true)
  useEffect(() => {
    if (firstView.current) { firstView.current = false; return }
    bodyRef.current?.querySelector('button, input')?.focus()
  }, [view])

  async function keep() {
    if (!count || busy) return
    setBusy(true)
    setError(null)
    let into = deck.id ? deck : null
    try {
      if (!into) into = await mining.ensureDeck('mixed', deck.name, { remember: false })
      await addWords(session, into.id, takeWords)
      const refused = takeLines.length ? await addLines(session, into.id, takeLines) : false
      if (picked.has(focusIndex) && !pinned) onPin()
      // Counts only: a deck's name is the learner's own words.
      track('song_deck', { words: takeWords.length, lines: takeLines.length })
      setMade({ deck: into, count })
      if (refused) setError(t.songDeckLimit)
      setView('made')
    } catch (err) {
      // A deck already made stays reachable when what goes in it fails.
      if (into) {
        setMade({ deck: into, count })
        setView('made')
      }
      setError(err?.code === 'limit_reached' ? t.songDeckLimit : t.songDeckFailed)
    } finally {
      setBusy(false)
    }
  }

  function pinOnly() {
    if (pinned) onUnpin()
    else onPin()
    onClose()
  }

  return (
    <Sheet open onClose={onClose} label={t.keepTitle} className="anl-keepsheet" dismiss>
      <div ref={bodyRef} className="anl-keepsheet__body">
        {view === 'main' && (
          <KeepMain
            t={t}
            deck={deck}
            isNew={!deck.id}
            songDeck={several && deck === songDeck}
            takes={takes}
            onDeck={() => setView('deck')}
            chosen={chosen}
            several={several}
            total={sentences.filter(readableLine).length}
            onLines={() => setView('lines')}
            lineOn={lineOn}
            setLineOn={setLineOn}
            lineCount={lines.length}
            words={words}
            ticked={ticked}
            onTick={word => setWordTick(prev => new Map(prev).set(word.ref.raw_id, !ticked(word)))}
            wordsOn={wordsOn}
            setWordsOn={setWordsOn}
            allWords={allWords}
            onAllWords={() => setAllWords(true)}
            count={count}
            busy={busy}
            error={error}
            onKeep={keep}
            pinned={pinned}
            onPinOnly={pinOnly}
          />
        )}
        {view === 'deck' && (
          <KeepDeck
            t={t}
            decks={decks}
            songDeck={songDeck}
            several={several}
            current={deck}
            onBack={() => setView('main')}
            onPick={next => { setTarget(next); setView('main') }}
          />
        )}
        {view === 'lines' && (
          <KeepLines
            t={t}
            sentences={sentences}
            focusIndex={focusIndex}
            picked={picked}
            kept={kept}
            held={held}
            onBack={() => setView('main')}
            onDone={next => { setPicked(next); setView('main') }}
          />
        )}
        {view === 'made' && made && (
          <KeepMade t={t} made={made} error={error} onClose={onClose} />
        )}
      </div>
    </Sheet>
  )
}

function DeckRoundel({ type, t }) {
  const kind = deckTypeOf(type, t)
  return (
    <span className="wmap-roundel picker-row__roundel" style={{ '--line-color': kind.color }} lang="ja" aria-hidden="true">
      {kind.glyph}
    </span>
  )
}

function takesCaption(type, t) {
  if (type === 'vocab') return t.keepTakesWords
  if (type === 'standard') return t.keepTakesLines
  return t.keepTakesBoth
}

function KeepMain({
  t, deck, isNew, songDeck, takes, onDeck, chosen, several, total, onLines, lineOn, setLineOn, lineCount,
  words, ticked, onTick, wordsOn, setWordsOn, allWords, onAllWords, count, busy, error, onKeep, pinned, onPinOnly,
}) {
  const { lang } = useLang()
  const shown = allWords || words.length <= WORDS_SHOWN ? words : words.slice(0, WORDS_SHOWN - 1)
  const many = chosen.length > 1
  // A line the deck holds already, or one in kana throughout, is no card.
  const linesIn = takes.lines && lineOn && lineCount > 0
  return (
    <>
      <p className="anl-keepsheet__cap">{t.keepIn}</p>
      <button type="button" className="anl-keepsheet__deck" onClick={onDeck} aria-label={t.keepDeckChange(deck.name)}>
        <DeckRoundel type={deck.type} t={t} />
        <span className="anl-keepsheet__deckname">
          <b>{deck.name}</b>
          <small>
            {isNew ? (songDeck ? t.keepNewSongDeck : t.keepNewDeck) : t.cardsUnit(deck.card_count ?? 0)}
          </small>
        </span>
        <span className="anl-keepsheet__change" aria-hidden="true">{t.keepChange}<ChevronIcon direction="right" size={16} /></span>
      </button>

      <div className={`anl-keepsheet__item${linesIn ? ' anl-keepsheet__item--on' : ''}`}>
        <label className="anl-keepsheet__tick">
          <input
            className="anl-keepsheet__check"
            type="checkbox"
            checked={linesIn}
            disabled={!takes.lines || !lineCount}
            onChange={() => setLineOn(v => !v)}
          />
          <span>{many ? t.keepLines(chosen.length) : t.keepLine}</span>
        </label>
        {!takes.lines && <p className="anl-keepsheet__note">{t.keepDeckWordsOnly}</p>}
        {many ? (
          <ul className="anl-keepsheet__lines" lang="ja">
            {chosen.slice(0, 2).map(s => <li key={s.text}>{s.text}</li>)}
            {chosen.length > 2 && <li className="anl-keepsheet__rest" lang={lang}>{t.keepAndOthers(chosen.length - 2)}</li>}
          </ul>
        ) : chosen[0] && (
          <p className="anl-keepsheet__line" lang="ja">
            <span>{chosen[0].text}</span>
            <span className="anl-keepsheet__reading">{lineReading(chosen[0])}</span>
          </p>
        )}
        {several && (
          <button type="button" className="anl-keepsheet__more" onClick={onLines}>
            <span>{many ? t.keepEditLines : t.keepMoreLines(total)}</span>
            <ChevronIcon direction="right" size={16} />
          </button>
        )}
      </div>

      {words.length > 0 && (
        <div className={`anl-keepsheet__item${takes.words && wordsOn ? ' anl-keepsheet__item--on' : ''}`}>
          <label className="anl-keepsheet__tick">
            <input
              className="anl-keepsheet__check"
              type="checkbox"
              checked={takes.words && wordsOn}
              disabled={!takes.words}
              onChange={() => setWordsOn(v => !v)}
            />
            <span>{many ? t.keepTheirWords(words.length) : t.keepItsWords(words.length)}</span>
          </label>
          {!takes.words && <p className="anl-keepsheet__note">{t.keepDeckLinesOnly}</p>}
          <div className="anl-keepsheet__chips" lang="ja">
            {shown.map(word => {
              const on = ticked(word)
              return (
                <button
                  key={word.ref.raw_id}
                  type="button"
                  className={`anl-keepsheet__chip${on ? ' anl-keepsheet__chip--on' : ''}`}
                  aria-pressed={on}
                  disabled={!takes.words || !wordsOn}
                  onClick={() => onTick(word)}
                >
                  <b>{word.name}</b>
                  {word.known && !on
                    ? <small lang={lang}>{t.keepKnown}</small>
                    : word.reading && <small>{word.reading}</small>}
                </button>
              )
            })}
            {shown.length < words.length && (
              <button type="button" className="anl-keepsheet__chip anl-keepsheet__chip--more" lang={lang}
                aria-label={t.keepMoreWords(words.length - shown.length)} onClick={onAllWords}>
                +{words.length - shown.length}
              </button>
            )}
          </div>
        </div>
      )}

      {error && <p className="anl-song__error" role="alert">{error}</p>}
      <button type="button" className="btn-primary anl-keepsheet__go" disabled={!count || busy} onClick={onKeep}>
        {busy ? <>{t.songDeckMaking}<Dots /></> : count ? t.keepCards(count) : t.keepNothing}
      </button>
      <button type="button" className="anl-keepsheet__pin" onClick={onPinOnly}>
        {pinned ? t.unkeepSentence : t.keepNoDeck}
      </button>
    </>
  )
}

function KeepHead({ t, title, sub, onBack, children }) {
  return (
    <div className="anl-keepsheet__head">
      <button type="button" className="anl-keepsheet__back" onClick={onBack} aria-label={t.back}>
        <ChevronIcon direction="left" size={20} />
      </button>
      <span className="anl-keepsheet__title">
        <b>{title}</b>
        {sub && <small>{sub}</small>}
      </span>
      {children}
    </div>
  )
}

function KeepDeck({ t, decks, songDeck, several, current, onBack, onPick }) {
  // The song's deck first, made on the press if it is not there yet; a
  // deck named here and not made yet stays on the list it was named on.
  const options = [songDeck, ...decks.filter(d => d.id !== songDeck.id)]
  if (!current.id && current.name !== songDeck.name) options.splice(1, 0, current)
  const keyOf = d => (d.id ? `id:${d.id}` : `new:${d.name}`)
  const [choice, setChoice] = useState(() => keyOf(current))
  const [naming, setNaming] = useState(false)
  const [name, setName] = useState(songDeck.name)
  const chosen = options.find(d => keyOf(d) === choice) ?? songDeck

  function useName(e) {
    e.preventDefault()
    const named = name.trim()
    if (!named) return
    const same = options.find(d => d.type === 'mixed' && (d.name ?? '').trim().toLowerCase() === named.toLowerCase())
    onPick(same ?? { id: null, name: named, type: 'mixed' })
  }

  return (
    <>
      <KeepHead t={t} title={t.keepIn} onBack={onBack} />
      <div className="anl-keepsheet__decks" role="radiogroup" aria-label={t.keepIn}>
        {options.map(d => {
          const on = keyOf(d) === choice
          return (
            <label key={keyOf(d)} className={`anl-keepsheet__opt${on ? ' anl-keepsheet__opt--on' : ''}`}>
              <input className="anl-keepsheet__check" type="radio" name="anl-keep-deck" checked={on} onChange={() => setChoice(keyOf(d))} />
              <DeckRoundel type={d.type} t={t} />
              <span className="anl-keepsheet__deckname">
                <b>{d.name}</b>
                <small>{d === songDeck && several ? t.keepThisSong : takesCaption(d.type, t)}</small>
              </span>
              {d.id
                ? <span className="anl-keepsheet__count">{t.cardsUnit(d.card_count ?? 0)}</span>
                : <span className="anl-keepsheet__tag">{t.keepNew}</span>}
            </label>
          )
        })}
      </div>
      {naming ? (
        <form className="anl-keepsheet__name" onSubmit={useName} noValidate>
          <label className="anl-song__label" htmlFor="anl-keep-name">{t.songDeckName}</label>
          <div className="anl-keepsheet__namerow">
            <input
              id="anl-keep-name"
              className="field"
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && composing(e)) e.preventDefault() }}
              maxLength={120}
            />
            <button type="submit" className="btn-secondary" disabled={!name.trim()}>{t.keepNameOk}</button>
          </div>
        </form>
      ) : (
        <button type="button" className="anl-keepsheet__new" onClick={() => setNaming(true)}>
          <PlusIcon size={16} />{t.keepNewDeck}
        </button>
      )}
      <button type="button" className="btn-primary" onClick={() => onPick(chosen)}>{t.keepUseDeck(chosen.name)}</button>
    </>
  )
}

function KeepLines({ t, sentences, focusIndex, picked, kept, held, onBack, onDone }) {
  const { lang } = useLang()
  const rows = sentences.map((s, i) => ({ s, i })).filter(({ s }) => readableLine(s))
  const [draft, setDraft] = useState(() => new Set(picked))
  const listRef = useRef(null)
  const isHeld = s => held.has(s.text.trim())
  const open = rows.filter(({ s }) => !isHeld(s))
  const set = indices => setDraft(new Set(indices))
  const keptRows = open.filter(({ s }) => kept.has(s.text))

  // The line in hand stands in the list's middle, where the learner is.
  useEffect(() => {
    listRef.current?.querySelector('.anl-keepsheet__row--here')?.scrollIntoView?.({ block: 'center' })
  }, [])

  return (
    <>
      <KeepHead t={t} title={t.keepLinesTitle} sub={t.keepLinesOf(draft.size, rows.length)} onBack={onBack}>
        <button type="button" className="btn-secondary anl-keepsheet__all" onClick={() => set(open.map(r => r.i))}>{t.keepAll}</button>
      </KeepHead>
      <div className="anl-keepsheet__quick">
        <button type="button" className="anl-keepsheet__pick" disabled={!keptRows.length} onClick={() => set(keptRows.map(r => r.i))}>
          {t.keepPickKept(keptRows.length)}
        </button>
        <button type="button" className="anl-keepsheet__pick" onClick={() => set(open.filter(({ s }) => s.unknown_count > 0).map(r => r.i))}>
          {t.keepPickUnknown}
        </button>
        <button type="button" className="anl-keepsheet__pick" onClick={() => set([])}>{t.keepPickNone}</button>
      </div>
      <div ref={listRef} className="anl-keepsheet__list" lang="ja">
        {rows.map(({ s, i }) => {
          const already = isHeld(s)
          const on = draft.has(i) && !already
          return (
            <label key={i} className={`anl-keepsheet__row${i === focusIndex ? ' anl-keepsheet__row--here' : ''}${on ? ' anl-keepsheet__row--on' : ''}`}>
              <input
                className="anl-keepsheet__check"
                type="checkbox"
                checked={on}
                disabled={already}
                onChange={() => setDraft(prev => {
                  const next = new Set(prev)
                  if (next.has(i)) next.delete(i)
                  else next.add(i)
                  return next
                })}
              />
              <span className="anl-keepsheet__n" aria-hidden="true">{i + 1}</span>
              <span className="anl-keepsheet__text">
                {s.text}
                {already && <small lang={lang}>{t.keepHeld}</small>}
              </span>
            </label>
          )
        })}
      </div>
      <button type="button" className="btn-primary" onClick={() => onDone(draft)}>{t.keepValidate(draft.size)}</button>
    </>
  )
}

function KeepMade({ t, made, error, onClose }) {
  return (
    <>
      <div className="surface picker anl-song__made">
        <Link to={`/learn/decks/${made.deck.id}`} className="picker-row anl-song__deck">
          <DeckRoundel type={made.deck.type ?? 'mixed'} t={t} />
          <span className="picker-row__name">{made.deck.name}</span>
          <span className="picker-row__count">{t.cardsUnit(made.count)}</span>
          <ChevronIcon direction="right" size={16} />
        </Link>
        {error && <p className="anl-song__error" role="alert">{error}</p>}
      </div>
      <button type="button" className="btn-secondary anl-keepsheet__close" onClick={onClose}>{t.displayDone}</button>
    </>
  )
}
