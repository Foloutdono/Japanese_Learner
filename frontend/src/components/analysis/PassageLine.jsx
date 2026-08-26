import { useEffect, useRef } from 'react'
import { formatTimecode } from '../../lib/timecode'

// ── 路線図 — the Passage as a line ────────────────────────
// Every Sentence in the Passage is a stop, in order, threaded by one
// rail. Same drawing as LevelSelector's JLPT line, and for the reason
// that component's own comment gives: a list says "pick one of these",
// a line says "this is how far it goes". A Passage is exactly that --
// an ordered thing you travel from one end of.
//
// It replaces two different answers to the same question. The phrase
// analyzer stacked a full breakdown per Sentence (ten Sentences meant
// ten breakdowns AND ten copies of the status legend); the video screen
// listed every Sentence as an undifferentiated row. Neither let you see
// which parts of what you brought in were worth stopping at -- which is
// the whole question the screen exists to answer.
//
// i+1 (CONTEXT.md: a Sentence with exactly one unknown Token) is marked
// on the line itself, because it is the app's highest-value signal and
// it used to be a badge you had to scroll to.
//
// Two orientations, one component, so nothing can disagree about where
// you are: 'vertical' is the route map beside the stage, 'strip' is the
// stopping-pattern band above a train door. Plan 030 chooses between
// them responsively.

export function PassageLine({ sentences, activeIndex, onSelect, t, orientation = 'vertical' }) {
  const activeRef = useRef(null)

  // Playback moves the active stop without a click, so the line has to
  // follow. 'nearest' is what makes this correct in BOTH orientations --
  // it scrolls the axis that actually overflows and leaves the other
  // alone.
  useEffect(() => {
    const el = activeRef.current
    if (!el) return
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    el.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: reduced ? 'auto' : 'smooth' })
  }, [activeIndex])

  return (
    <div
      className={`anl-line${orientation === 'strip' ? ' anl-line--strip' : ''}`}
      // role="group", NOT role="list". A list wants role="listitem"
      // children, and putting that on a <button> OVERRIDES the button
      // role -- assistive tech would announce these as list items, not
      // as controls, silently undoing the very fix this component
      // exists for. The count the list would have given is carried in
      // the group's own label instead.
      role="group"
      aria-label={`${t.routeMap} — ${t.stopsInPassage(sentences.length)}`}
    >
      {sentences.map((s, i) => {
        const active = i === activeIndex
        return (
          <button
            key={i}
            ref={active ? activeRef : null}
            type="button"
            // A control, not a div with an onClick -- which is what the
            // transcript this replaces was, and why it was unreachable
            // by keyboard and invisible to a screen reader. Carries no
            // `role`: its own is the one that matters.
            aria-current={active ? 'true' : undefined}
            title={t.jumpToStop}
            className={[
              'anl-stop',
              i === 0 ? 'anl-stop--first' : '',
              i === sentences.length - 1 ? 'anl-stop--last' : '',
            ].filter(Boolean).join(' ')}
            onClick={() => onSelect(i)}
          >
            {/* Drawn per stop so the ends can be capped and the line
                stays unbroken through the gap between them. */}
            <span className="anl-stop__rail" aria-hidden="true" />
            <span className="anl-stop__marker" aria-hidden="true" />

            {/* Truncated by CSS, never by slicing the string: a hard
                character count cuts mid-grapheme and mangles Japanese. */}
            <span className="anl-stop__text" lang="ja">{s.text}</span>

            {s.unknown_count === 1 && (
              <span className="anl-stop__iplus" title={t.iPlusOne}>i+1</span>
            )}

            {/* The one place 鶯色 is spent: the only data a video
                Sentence has that no other source does. */}
            {s.cue_start != null && (
              <span className="anl-stop__time">{formatTimecode(s.cue_start)}</span>
            )}
          </button>
        )
      })}
    </div>
  )
}
