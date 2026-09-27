import { useLayoutEffect, useMemo, useRef } from 'react'
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
// is the SRS's, and each word keeps its own colour. `playhead` is the
// player's clock (components/analysis/playhead.js): read every frame
// while the video plays, and on each poll while it does not, since a
// paused clock moves only by a seek.
export function SubtitleLine({ analysis, index, setIndex, lit = null, t, playhead = null, playing = false }) {
  const tokens = analysis?.tokens ?? analysis?.words ?? []
  const points = numberedPointsOf(analysis)
  const owner = tokens.map(w => points.findIndex(p => coversToken(p, w)))
  const firstOf = points.map(p => tokens.findIndex(w => coversToken(p, w)))
  const lineRef = useRef(null)
  useSung(analysis, playhead, playing, lineRef)

  const word = i => {
    const w = tokens[i]
    return (
      <button
        key={i}
        type="button"
        onClick={() => setIndex(i)}
        className={`tok tok--${tokState(w)}${i === index ? ' tok--on' : ''}${lit && coversToken(lit, w) ? ' tok--lit' : ''}`}
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
      className="tok-line anl-subs__line"
      role="group"
      aria-label={analysis?.text}
      lang="ja"
    >
      {out}
    </div>
  )
}

// Which word the clock is on, and how far through it, written straight
// onto the line: `data-sung` on it while the clock is inside it, and on
// every word its --said -- 100% said, the word being said as far as it
// has got, 0% to come. Never through React: a word handed over as state
// was drawn a frame before its class caught up, the word just said
// flicking back to faded at every change of word, and the line re-rendered
// with it. Written in the same frame for every word, only where a value
// moved, the line reads whole at every moment.
function useSung(analysis, playhead, playing, lineRef) {
  const times = useMemo(() => (playhead ? tokenTimes(analysis) : null), [analysis, playhead])
  // A layout effect, so a new line is drawn sung, or plain, on its first
  // frame -- and without asking the browser for a frame at all, which it
  // gives no page it is not drawing (a paused clock is read on the poll).
  useLayoutEffect(() => {
    const line = lineRef.current
    if (!line) return undefined
    if (!times) {
      paintSung(line, null)
      return undefined
    }
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    const read = () => paintSung(line, sungAt(times, playhead.at()), reduced)
    read()
    if (!playing) return playhead.subscribe(read)
    let frame = requestAnimationFrame(function sweep() {
      read()
      frame = requestAnimationFrame(sweep)
    })
    return () => cancelAnimationFrame(frame)
  }, [times, playhead, playing, lineRef])
}

function paintSung(line, at, reduced = false) {
  const words = line.querySelectorAll('.tok')
  if (!at) {
    line.removeAttribute('data-sung')
    words.forEach(el => {
      el.style.removeProperty('--said')
      if (!el.getAttribute('style')) el.removeAttribute('style')
    })
    return
  }
  if (!line.hasAttribute('data-sung')) line.setAttribute('data-sung', '')
  words.forEach((el, i) => {
    // Reduced motion: the word lights whole, no sweep across it.
    const said = i < at.index ? 100 : i > at.index ? 0 : reduced ? 100 : Math.round(at.progress * 100)
    const value = `${said}%`
    if (el.style.getPropertyValue('--said') !== value) el.style.setProperty('--said', value)
  })
}
