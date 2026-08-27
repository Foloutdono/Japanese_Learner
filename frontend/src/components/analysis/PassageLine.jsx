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

export function PassageLine({ sentences, activeIndex, onSelect, t, orientation = 'vertical', scrollOnChange = true }) {
  const activeRef = useRef(null)
  const lineRef = useRef(null)
  const stopRefs = useRef({})

  // The strip and the video player are two sticky siblings, so the
  // player has to sit exactly one strip-height down or it covers the
  // bottom of the line. That offset was a hand-kept 92px and was wrong
  // the moment a stop grew a badge -- measured here instead, and
  // published as a custom property the player's rule reads. One source
  // of truth, and it cannot go stale.
  useEffect(() => {
    const el = lineRef.current
    if (!el || orientation !== 'strip') return undefined
    const target = el.parentElement
    if (!target) return undefined
    const publish = () => target.style.setProperty('--anl-strip-h', `${Math.ceil(el.offsetHeight)}px`)
    publish()
    const ro = new ResizeObserver(publish)
    ro.observe(el)
    return () => { ro.disconnect(); target.style.removeProperty('--anl-strip-h') }
  }, [orientation])

  // Playback moves the active stop without a click, so the line has to
  // follow. 'nearest' is what makes this correct in BOTH orientations --
  // it scrolls the axis that actually overflows and leaves the other
  // alone.
  useEffect(() => {
    if (!scrollOnChange) return
    const el = activeRef.current
    if (!el) return
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    el.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: reduced ? 'auto' : 'smooth' })
  }, [activeIndex, scrollOnChange])

  // Arrow keys move along the line AND select, which is what a route
  // diagram means: moving to a stop is arriving at it. Home/End are the
  // termini. PageUp/PageDown step ten at a time, because a subtitle
  // track can be fifty stops long and one-at-a-time is not navigation.
  function onKeyDown(e) {
    const last = sentences.length - 1
    let next = null
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') next = Math.min(last, activeIndex + 1)
    else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') next = Math.max(0, activeIndex - 1)
    else if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = last
    else if (e.key === 'PageDown') next = Math.min(last, activeIndex + 10)
    else if (e.key === 'PageUp') next = Math.max(0, activeIndex - 10)
    if (next === null || next === activeIndex) return

    e.preventDefault()
    // stopPropagation, not just preventDefault: the screen installs a
    // WINDOW-level ArrowLeft/ArrowRight handler that steps through the
    // focused Sentence's Tokens. Without this, pressing Right on a stop
    // both moves along the line and advances the Token stepper.
    e.stopPropagation()
    onSelect(next)
    stopRefs.current[next]?.focus()
  }

  return (
    <div
      ref={lineRef}
      className={`anl-line${orientation === 'strip' ? ' anl-line--strip' : ''}`}
      // role="group", NOT role="list". A list wants role="listitem"
      // children, and putting that on a <button> OVERRIDES the button
      // role -- assistive tech would announce these as list items, not
      // as controls, silently undoing the very fix this component
      // exists for. The count the list would have given is carried in
      // the group's own label instead.
      role="group"
      aria-label={`${t.routeMap} — ${t.stopsInPassage(sentences.length)}`}
      onKeyDown={onKeyDown}
    >
      {sentences.map((s, i) => {
        const active = i === activeIndex
        return (
          <button
            key={i}
            // Roving tabindex: ONE tab stop for the whole line, then the
            // arrow keys move within it. Without this a 47-cue subtitle
            // track put 47 tab stops between the platform rail and the
            // breakdown -- the exact pattern SourceRail one component up
            // already uses, and which this component was written without.
            tabIndex={active ? 0 : -1}
            ref={el => {
              stopRefs.current[i] = el
              if (active) activeRef.current = el
            }}
            type="button"
            // A control, not a div with an onClick -- which is what the
            // transcript this replaces was, and why it was unreachable
            // by keyboard and invisible to a screen reader. Carries no
            // `role`: its own is the one that matters.
            aria-current={active ? 'true' : undefined}
            // One name per stop, not one tooltip repeated N times. The
            // position is what a route diagram is FOR, so it leads; the
            // Sentence text follows, and i+1 is called out because it is
            // the app's highest-value signal.
            aria-label={[
              t.stopNumber(i + 1, sentences.length),
              s.text,
              s.foreign ? t.notJapaneseShort : null,
              !s.foreign && s.unknown_count === 1 ? t.iPlusOne : null,
              s.cue_start != null ? formatTimecode(s.cue_start) : null,
            ].filter(Boolean).join(' — ')}
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

            {s.foreign ? (
              /* Flagged, not hidden: the learner can see this line is in
                 the track and that the app has nothing to say about it. */
              <span className="anl-stop__foreign" title={t.notJapaneseLine} aria-hidden="true">
                {t.notJapaneseShort}
              </span>
            ) : s.unknown_count === 1 && (
              <span className="anl-stop__iplus" title={t.iPlusOne} aria-hidden="true">i+1</span>
            )}

            {/* The one place 鶯色 is spent: the only data a video
                Sentence has that no other source does. */}
            {s.cue_start != null && (
              <span className="anl-stop__time" aria-hidden="true">{formatTimecode(s.cue_start)}</span>
            )}
          </button>
        )
      })}
    </div>
  )
}
