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
// ONE orientation, on purpose. The mockup draws the Passage exactly
// one way — the vertical route map — at every width; below the split
// breakpoint the whole rail column simply stacks above the stage. The
// horizontal stopping-pattern band (plan 030's 'strip') is retired
// with the mockup fidelity pass (2026-09-01), along with the measured
// --anl-strip-h machinery that existed only to keep two sticky
// siblings from overlapping.

export function PassageLine({ sentences, activeIndex, onSelect, t, scrollOnChange = true, kept, onKeep }) {
  const activeRef = useRef(null)
  const stopRefs = useRef({})

  // Playback moves the active stop without a click, so the line has to
  // follow. 'nearest' scrolls only the axis that actually overflows.
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
      className="anl-line"
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
        const isKept = !!kept?.has(s.text)
        return (
          // Sibling, not child: the stop is a <button>, and a <button>
          // inside a <button> is invalid HTML with undefined focus
          // behaviour -- the same constraint TokenCard's kanji chip has.
          // The row wraps both, so the roving tabindex, key handler, and
          // rail-bleed technique on .anl-stop stay exactly as they were.
          <div className="anl-stop-row" key={i}>
            <button
              // Roving tabindex: ONE tab stop for the whole line, then the
              // arrow keys move within it. Without this a 47-cue subtitle
              // track put 47 tab stops between the intake and the
              // breakdown -- this component was originally written
              // without it and paid exactly that cost.
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
                !s.foreign && s.level ? s.level : null,
                !s.foreign && s.unknown_count === 1 ? t.iPlusOne : null,
                s.explanation ? t.alreadyExplained : null,
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
              ) : (
                <>
                  {/* The Sentence's own JLPT grade -- the quietest badge
                      on the stop, because it is context, not a call to
                      action the way i+1 is. */}
                  {s.level && (
                    <span className="anl-stop__lvl" aria-hidden="true">{s.level}</span>
                  )}
                  {s.unknown_count === 1 && (
                    <span className="anl-stop__iplus" title={t.iPlusOne} aria-hidden="true">i+1</span>
                  )}
                </>
              )}

              {/* 済 — already explained. The deep tier is the one thing on
                  this screen that costs a model call (docs/adr/0001), and
                  nothing recorded what had been bought: on a 47-stop
                  subtitle track the only way to know was to open each stop.
                  No new pigment -- the wave's colour rule spends
                  --line-douga on the timestamp chip and nothing else, and
                  --success is already i+1's. This is shape and weight.

                  Session-local for a video Passage: the explain endpoint
                  does not write back into video_sessions.sentences, so a
                  reloaded session loses the marks even though the
                  explanations themselves are still cached server-side. A
                  typed or photographed Passage keeps them, because the
                  history re-derive merges the cache back in. */}
              {s.explanation && (
                <span className="anl-stop__done" lang="ja" aria-hidden="true">済</span>
              )}

              {/* The one place 鶯色 is spent: the only data a video
                  Sentence has that no other source does. */}
              {s.cue_start != null && (
                <span className="anl-stop__time" aria-hidden="true">{formatTimecode(s.cue_start)}</span>
              )}
            </button>
            {onKeep && (
              // + / ✓ rather than the 保存 it used to print: the pin is
              // navigation, and the workbench's controls went
              // plain-language-first with the mockup round. The glyphs
              // need no language at all; the localized aria-label and
              // title still carry the words.
              <button
                type="button"
                className={`anl-keep${isKept ? ' anl-keep--on' : ''}`}
                aria-pressed={isKept}
                aria-label={isKept ? t.unkeepSentence : t.keepSentence}
                title={isKept ? t.unkeepSentence : t.keepSentence}
                onClick={() => onKeep(i)}
              >
                <span aria-hidden="true">{isKept ? '✓' : '+'}</span>
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}
