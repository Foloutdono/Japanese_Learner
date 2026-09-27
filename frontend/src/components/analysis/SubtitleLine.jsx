import { useEffect, useMemo, useRef, useState } from 'react'
import { tokState, tokFurigana } from './tokens'
import { coversToken, numberedPointsOf } from './grammarSpans'
import { tokenTimes, sungAt } from './wordTimes'

// ── 字幕 — the sentence under the picture (plan 134) ─────────────
// The desk's analyser draws the focused Sentence where a subtitle
// stands: on the player's sumi, under the video, the reading over each
// word that needs one and the SRS speaking through the rule under it,
// as the stage's line does (tokState). Each word is a button that puts
// it in focus -- the card beside the words list and the entry in the
// right column follow it.
//
// A grammar point -- a construction or a particle's marker, the rows of
// GrammarPoints `numbered` -- is framed on the words it sits on, its
// number at the frame's corner, so the card in the left column and its
// place in the sentence are found from either (the owner's G2). A word two points cover is framed once, by the
// first; the frame then carries every number whose point begins in it.
//
// 字幕の流れ (2026-09-27): while the video is inside the line, its words
// are read out as they are said -- the words to come faded, the word
// being said filling from its first letter to its last, the words said
// whole (components/analysis/wordTimes.js). Ink only, through a mask:
// the tint is the focused word's and a rule's, the rule under the word
// is the SRS's, and each word keeps its own colour. `clock` is the
// player's time carried between its polls; `tick` is the poll itself,
// which re-reads a paused clock after a seek.
export function SubtitleLine({ analysis, index, setIndex, lit = null, t, clock = null, playing = false, tick = 0 }) {
  const tokens = analysis?.tokens ?? analysis?.words ?? []
  const points = numberedPointsOf(analysis)
  const owner = tokens.map(w => points.findIndex(p => coversToken(p, w)))
  const firstOf = points.map(p => tokens.findIndex(w => coversToken(p, w)))
  const lineRef = useRef(null)
  const sung = useSung(analysis, clock, playing, tick, lineRef)

  const word = i => {
    const w = tokens[i]
    return (
      <button
        key={i}
        type="button"
        onClick={() => setIndex(i)}
        className={`tok tok--${tokState(w)}${i === index ? ' tok--on' : ''}${lit && coversToken(lit, w) ? ' tok--lit' : ''}${sungClass(sung, i)}`}
        aria-label={t.jumpToTokenNamed(w.surface)}
        aria-pressed={i === index}
        lang="ja"
      >
        <span className="tok__furi" lang="ja">{tokFurigana(w)}</span>
        <span className="tok__word">{w.surface}</span>
      </button>
    )
  }

  const out = []
  let i = 0
  while (i < tokens.length) {
    const p = owner[i]
    if (p === -1) {
      out.push(word(i))
      i += 1
      continue
    }
    let j = i
    while (j + 1 < tokens.length && owner[j + 1] === p) j += 1
    const numbers = firstOf
      .map((first, q) => (first >= i && first <= j ? q + 1 : null))
      .filter(Boolean)
    const run = []
    for (let k = i; k <= j; k += 1) run.push(word(k))
    out.push(
      <span key={`pt-${i}`} className="anl-subs__pt">
        {numbers.length > 0 && <span className="anl-subs__n" aria-hidden="true">{numbers.join('·')}</span>}
        {run}
      </span>,
    )
    i = j + 1
  }

  return (
    <div
      ref={lineRef}
      className={`tok-line anl-subs__line${sung === null ? '' : ' tok-line--sung'}`}
      role="group"
      aria-label={analysis?.text}
      lang="ja"
    >
      {out}
    </div>
  )
}

function sungClass(sung, i) {
  if (sung === null) return ''
  if (i < sung) return ' tok--said'
  return i === sung ? ' tok--saying' : ''
}

// Which word the clock is on (null outside the line), read every frame
// while the video plays and once per poll while it does not. The index
// is state, so it re-renders only when the word changes; how far
// through the word is written straight onto it as --said, sixty times
// a second, never through React.
function useSung(analysis, clock, playing, tick, lineRef) {
  const times = useMemo(() => (clock ? tokenTimes(analysis) : null), [analysis, clock])
  const [index, setIndex] = useState(null)
  useEffect(() => {
    const line = lineRef.current
    const clear = () => line?.querySelectorAll('.tok[style]').forEach(el => {
      el.style.removeProperty('--said')
      if (!el.getAttribute('style')) el.removeAttribute('style')
    })
    if (!times) {
      clear()
      return undefined
    }
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    let frame = 0
    let first = 0
    const read = () => {
      const at = sungAt(times, clock())
      setIndex(at ? at.index : null)
      clear()
      if (at && at.index >= 0) {
        const el = line?.querySelectorAll('.tok')[at.index]
        // Reduced motion: the word lights whole, no sweep across it.
        el?.style.setProperty('--said', `${reduced ? 100 : Math.round(at.progress * 100)}%`)
      }
      if (playing) frame = requestAnimationFrame(read)
    }
    // The first read on a timer, not a frame: a browser gives no frames
    // to a page it is not drawing, and a paused clock moved by a seek
    // must still be read. Frames carry the sweep only while it plays.
    first = setTimeout(read, 0)
    return () => {
      clearTimeout(first)
      cancelAnimationFrame(frame)
    }
  }, [times, clock, playing, tick, lineRef])
  // A line with no clock (a typed Passage, the video gone) is never sung.
  return times ? index : null
}
