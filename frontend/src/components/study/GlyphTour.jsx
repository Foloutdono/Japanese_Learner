import { useEffect, useRef, useState } from 'react'
import { useLang } from '../../LangContext'
import { track } from '../../lib/track'
import { playClick, playKana, playUi, speakJapanese, stopSpeaking } from '../../lib/audio'
import { dialogOpen } from '../../lib/dialogOpen'
import { composing, pressedByPointer, trackPresses } from '../../lib/keyGuards'
import { GateButton } from '../ui/GateButton'
import { SpeakerIcon } from '../ui/Icons'
import { useTraceRun } from '../../hooks/useTraceRun'
import { Said, Track } from './GrammarTour'
import { FuriganaParts, Readings } from './Readings'
import { CharDisplay } from './QuizComponents'
import { TraceBoard } from './TraceBoard'
import { firstGloss, formatGlossLine } from './gloss'

// ── 初見 — a kana or a kanji met before it is drilled (plan 216) ──
// The grammar tour's frame (GrammarTour, plan 187) for the other half
// of the catalogue: a track of stops at the head, one card a stop, the
// gate at the foot. Where the grammar tour asks, this one shows, then
// has the hand do it -- three stops, in the order a glyph is learned:
//
//   read   the glyph at the specimen's size, what it reads (a kana's
//          romaji and its sound) or what it means and its readings (a
//          kanji's on'yomi and kun'yomi), the other script's twin;
//   write  the strokes traced in turn from the dot to the ring on the
//          writing board (TraceBoard), each a hollow the ink fills as
//          the hand goes (plan 263), a miss shown on the board alone
//          (the line it left, the dot called) and never in words, the
//          instruction already says it; the stroke drawn for the
//          learner after three; « Montre-moi » draws the rest;
//   use    a few simple words it is met in, each with its voice.
//
// `tour` is the card's `glyph_tour` (backend study/glyph_tour.py); a
// stop with nothing to show (no strokes, no words) is not drawn. The
// tour grades no card: `onBoard` hands the run how the trace went, and
// the card's first exercise follows.

/** The stops a glyph's tour draws, in order. */
function glyphStops(tour) {
  return ['read', tour.strokes?.length && 'write', tour.words?.length && 'use'].filter(Boolean)
}

function Speak({ onSpeak }) {
  const { t } = useLang()
  return (
    <button type="button" className="tour-speak" aria-label={t.listen} onClick={onSpeak} data-action="speak">
      <SpeakerIcon size={20} />
    </button>
  )
}

/** `text` with every `hit` in it in the line's ink: a kana in the
    reading of a word it is read in (the dictionary's ledger, Picked). */
function Picked({ text, hit }) {
  const parts = text.split(hit)
  return parts.flatMap((piece, i) => (i === 0 ? [piece] : [<b key={i} className="gt-word__hit">{hit}</b>, piece]))
}

function Read({ tour }) {
  const { t } = useLang()
  const kana = tour.kind === 'kana'
  const other = tour.script === 'katakana' ? 'hiragana' : 'katakana'
  return (
    <div className="tour-leaf">
      <header className="tour-leaf__head">
        <p className="tour__notion"><span className="tour__notion-head">{t.glyphNew[tour.kind]}</span></p>
        {kana && <h2 className="tour__q sr-only" tabIndex={-1}>{`${tour.glyph} · ${tour.romaji}`}</h2>}
      </header>
      {kana && <div className="tour-leaf__corner"><Speak onSpeak={() => playKana(tour.sound)} /></div>}
      <div className="tour-leaf__mid gt-read">
        <div lang="ja"><CharDisplay char={tour.glyph} variant="glyph" /></div>
        {kana
          ? <span className="gt-romaji" aria-hidden="true">{tour.romaji}</span>
          : <h2 className="tour__q gt-meaning" tabIndex={-1}>{formatGlossLine(tour.meaning) || tour.meaning}</h2>}
      </div>
      {kana && tour.twin && (
        <p className="tour-leaf__foot gt-twin">
          <span className="gt-twin__glyph" lang="ja">{tour.twin}</span>
          <span>{t.glyphTwin[other]}</span>
        </p>
      )}
      {!kana && tour.readings && (
        <div className="tour-leaf__foot gt-readings">
          <Readings kana={tour.readings} onLabel={t.onyomi} kunLabel={t.kunyomi} size={22} center isLarge
                    limit={5} moreLabel={t.readingsMore} />
        </div>
      )}
    </div>
  )
}

function Write({ tour, trace, onVerdict }) {
  const { t } = useLang()
  const total = tour.strokes.length
  const traced = trace.at >= total || trace.shownFrom != null
  const n = Math.min(trace.at + 1, total)
  let said = null
  if (trace.shownFrom != null) {
    said = <Said kind="given" head={t.glyphShown} />
  } else if (traced) {
    said = <Said kind="ok" head={t.glyphTraced(trace.misses)} />
  } else if (trace.last === 'given') {
    said = <Said kind="given" head={t.glyphGiven} />
  }
  // No head: the card is the board's. The stop is named on the track
  // (plan 264), the stroke asked numbered on its dot and the way from the
  // dot to the ring drawn, so the instruction is said to a screen reader
  // alone, and how far by the board's label.
  return (
    <div className="tour-leaf">
      <h2 className="tour__q sr-only" tabIndex={-1}>{t.glyphTraceQ}</h2>
      <div className="tour-leaf__mid gt-write">
        <TraceBoard
          strokes={tour.strokes}
          at={trace.at}
          given={trace.given}
          shownFrom={trace.shownFrom}
          label={t.glyphBoardAria(tour.glyph, n, total)}
          onVerdict={onVerdict}
        />
      </div>
      {said}
    </div>
  )
}

function Use({ tour }) {
  const { t } = useLang()
  const kana = tour.kind === 'kana'
  return (
    <div className="tour-leaf">
      <header className="tour-leaf__head">
        <h2 className="tour__q sr-only" tabIndex={-1}>{t.glyphStops.use}</h2>
      </header>
      <ul className="tour-leaf__mid gt-words">
        {tour.words.map(w => (
          <li key={w.kanji || w.kana} className="gt-word">
            <span className="gt-word__jp" lang="ja">
              {kana
                ? <Picked text={w.kana} hit={tour.glyph} />
                : w.furigana?.length
                  ? <FuriganaParts parts={w.furigana} hit={tour.glyph} hitClassName="gt-word__hit" />
                  : w.kanji || w.kana}
            </span>
            <span className="gt-word__gloss">{firstGloss(w.meaning)}</span>
            <Speak onSpeak={() => speakJapanese(w.kana)} />
          </li>
        ))}
      </ul>
    </div>
  )
}

// The keys on the desk, as the grammar tour's (useTourKeys): Enter
// presses the gate. Not from a field, a composing input method, a
// dialog or a control the keyboard is on -- except one the pointer
// just pressed, where Enter would press it again.
function useGateKey(ref, on) {
  useEffect(() => {
    if (!on) return undefined
    trackPresses()
    const onKey = e => {
      if (e.key !== 'Enter' || e.repeat || e.shiftKey || e.metaKey || e.ctrlKey || e.altKey) return
      if (composing(e) || dialogOpen()) return
      const target = e.target instanceof Element ? e.target : null
      if (target?.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target?.tagName ?? '')) return
      const control = target?.closest('button, a[href], summary')
      if (control && !pressedByPointer(control)) return
      const gate = ref.current?.querySelector('.tour__foot .btn-depart')
      if (!gate || gate.disabled) return
      e.preventDefault()
      gate.click()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [ref, on])
}

export function GlyphTour({ tour, onBoard, desk = false }) {
  const { t } = useLang()
  const stops = glyphStops(tour)
  const [at, setAt] = useState(0)
  const { trace, verdict, show } = useTraceRun()
  const bodyRef = useRef(null)
  const rootRef = useRef(null)
  useGateKey(rootRef, desk)
  const stop = stops[at]
  const total = tour.strokes?.length ?? 0
  const traced = trace.at >= total || trace.shownFrom != null
  const shown = trace.shownFrom != null || trace.given.length > 0

  // A new stop opens at its top, its question in focus.
  useEffect(() => {
    const body = bodyRef.current
    if (!body) return
    body.scrollTop = 0
    body.querySelector('.tour__q')?.focus({ preventScroll: true })
  }, [at])

  // A kana is heard as it is first seen.
  useEffect(() => {
    if (stop === 'read' && tour.kind === 'kana') playKana(tour.sound)
  }, [stop, tour.kind, tour.sound])

  useEffect(() => () => stopSpeaking(), [])

  function onVerdict(v) {
    if (v === 'ok') playClick()
    verdict(v)
  }

  function showMe() {
    playClick()
    show()
  }

  function go() {
    playUi('click-screen-selection')
    setAt(i => i + 1)
  }

  function board() {
    track('glyph_tour_done', { source: tour.kind, misses: trace.misses, shown })
    playUi('click-screen-selection')
    onBoard?.({ misses: trace.misses, shown })
  }

  const last = at === stops.length - 1
  let gate
  if (stop === 'write' && !traced) gate = <GateButton label={t.onbContinue} disabled data-action="continue" />
  else if (last) gate = <GateButton label={t.glyphStart} onClick={board} data-action="board" />
  else gate = <GateButton label={t.onbContinue} onClick={go} data-action="continue" />

  return (
    <section
      ref={rootRef}
      className={`tour tour--glyph tour--${tour.kind}${desk ? ' tour--desk' : ''}`}
      data-stop={stop}
      aria-label={t.glyphAria(tour.glyph)}
    >
      {stops.length > 1 && (
        <Track
          at={at}
          total={stops.length}
          label={t.glyphStops[stop]}
          part={stop === 'write' && total ? (traced ? 1 : trace.at / total) : 0}
        />
      )}
      <div className="tour__body" ref={bodyRef} key={stop}>
        {stop === 'read' && <Read tour={tour} />}
        {stop === 'write' && <Write tour={tour} trace={trace} onVerdict={onVerdict} />}
        {stop === 'use' && <Use tour={tour} />}
      </div>
      <div className="tour__foot">
        {stop === 'write' && !traced && (
          <button type="button" className="brd__link gt-show" onClick={showMe} data-action="show">
            {t.glyphShowMe}
          </button>
        )}
        {gate}
      </div>
    </section>
  )
}

