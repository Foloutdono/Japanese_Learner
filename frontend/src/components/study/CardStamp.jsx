import { useEffect, useRef, useState } from 'react'
import { useLang } from '../../LangContext'
import { playStamp } from '../../lib/audio'

// ── 落款 — the card gets its seal ──────────────────────────────
// Every card says what it is to the schedule in a word in its top
// corner (see StageMark.jsx): new, in progress, mastered. A review
// that moves the card up the ladder is the moment that changes, and
// this draws it the way a finished piece of calligraphy is signed —
// a 落款 seal pressed into the lower corner, clear of the work:
//
//   the impression  the new stage's glyph (習 or 極) at the specimen's
//                   size, framed as a seal and set at the angle a hand
//                   lands, in the stage's own ink at a faint opacity.
//                   It is a detail on the card, not a poster: the
//                   specimen and the meaning stay the thing you look
//                   at, and the seal is what you notice second.
//   the word        the old stage word in the top corner steps aside
//                   and the new one presses into its place.
//   the edge        the card's own edge answers in the same ink, half
//                   strength for a routine press, full for a
//                   graduation.
//
// The impression wears the equipped 印 (the storehouse's seal
// cosmetics — radius, angle, wall, frame — see the 印 block in
// index.css), so the seal a learner chose is the seal that gets
// pressed. Three variants, deliberately unequal:
//
//   learning  the routine notation: vermillion, ~0.9s all in.
//   mastered  the graduation: gold, a double-line seal, the edge lit
//             in full. ~1.2s.
//   demoted   a mastered card lapsing (the backend's stage_down): the
//             impression is re-inked in vermillion with a short shake,
//             so it reads as a correction rather than a celebration.
//
// This replaced, in two steps, a stage production (a wash, a kumadori
// fan, a brush stroke, petals, and for a demotion a burn) and then a
// press onto a small corner hanko that turned out too small to carry
// the moment at all. Every hold is measured — see HOLD_MS.
//
// `transition` is `{ id, to, demoted? }` — `id` so two promotions of
// different cards back-to-back still remount and replay.
//
// Positioning: an absolutely-positioned overlay the size of the card
// stage (`.quiz-card-stage` in index.css), so the corners here are
// the card's own corners.
const STAMP_GLYPH = { learning: '習', mastered: '極' }

// ── How long the press holds before it dissolves ──────────────
// Dead time for the reviewer: every study screen holds the next card
// until the fade-out ends. Each number is the last frame that carries
// information plus a beat to read it — the impression landing (520ms
// after a 40ms delay) for the routine press, the edge's end (820ms)
// for the graduation, the re-ink's settle (600ms) for a demotion —
// with a margin, because this timer and the CSS run off independent
// clocks and a busy main thread delays the first frame but not the
// setTimeout.
const HOLD_MS = { learning: 700, mastered: 900, demoted: 780 }

// Under prefers-reduced-motion the CSS hands every part its final
// state on the first frame, so the hold is only long enough to notice
// that a seal appeared at all.
const REDUCED_HOLD_MS = 300

function prefersReducedMotion() {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
}

export function CardStamp({ transition, onDone }) {
  if (!transition) return null
  // Keyed on the id so a fresh promotion mounts fresh: `phase` starts
  // at 'active' for free, no reset-on-change effect needed.
  return <CardStampInner key={transition.id} transition={transition} onDone={onDone} />
}

function CardStampInner({ transition, onDone }) {
  const { t } = useLang()
  // 'active' covers the press and the hold, 'leaving' is the dissolve.
  // onDone only fires off the real animationend of the fade, never a
  // guessed timer.
  const [phase, setPhase] = useState('active')
  const sounded = useRef(false)

  const to = transition.to
  const demoted = !!transition.demoted
  const variant = demoted ? 'demoted' : to

  useEffect(() => {
    if (!sounded.current) {
      sounded.current = true
      playStamp()
    }
    const holdMs = prefersReducedMotion() ? REDUCED_HOLD_MS : (HOLD_MS[variant] ?? 700)
    const timer = setTimeout(() => setPhase('leaving'), holdMs)
    return () => clearTimeout(timer)
  }, [variant])

  const leaving = phase === 'leaving'
  const label = to === 'mastered' ? t.mastered : t.learning

  const handleAnimationEnd = (e) => {
    if (e.animationName === 'card-stamp-fade-out') onDone?.()
  }

  return (
    <div
      className={`card-stamp-overlay card-stamp-overlay--${variant}${leaving ? ' card-stamp-overlay--leaving' : ''}`}
      aria-hidden="true"
      onAnimationEnd={handleAnimationEnd}
    >
      {/* The card's own edge answering the press in the seal's ink —
          faint for a routine press, gold and full for the graduation.
          Colour is an edge, never a fill. */}
      <span className="card-stamp__ripple" />
      {/* The impression, in the lower corner, in the equipped 印's form. */}
      <span className="card-stamp__rakkan" lang="ja">{STAMP_GLYPH[to]}</span>
      {/* The new stage word, pressed into the top corner where the old
          one was (StageMark steps aside while this plays). */}
      <span className="card-stamp__caption">{label}</span>
    </div>
  )
}
