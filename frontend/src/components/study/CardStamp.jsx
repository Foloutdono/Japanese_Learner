import { useEffect, useRef, useState } from 'react'
import { useLang } from '../../LangContext'
import { playStamp } from '../../lib/audio'

// ── 押印 — the card gets its seal ──────────────────────────────
// Every card carries a small seal in its corner saying what it is to
// the schedule: 新 not yet struck, 習 in progress, 極 mastered (see
// StageBadge.jsx). A review that moves the card up the ladder is the
// moment that seal is actually pressed — so that is what this draws:
// the new seal coming down onto the corner the old one sits in, the
// way an eki stamp lands on a rally sheet, with one ring of ink
// bleeding out from under it and a caption naming the stage.
//
// This replaced a stage production — a wash flooding the card, a
// kumadori fan, a brush stroke, seven sakura petals, and for a
// demotion a char sweeping up the card with embers — that held the
// next card for up to two seconds. A seal is a small object; the
// moment is the press, not the pageant. Three variants, deliberately
// unequal:
//
//   learning  the routine notation: a vermillion press, ~0.9s all in.
//   mastered  the graduation: the gold seal, its double ring, and
//             one gold ripple around the card's edge. ~1.2s.
//   demoted   a mastered card lapsing (the backend's stage_down): the
//             seal is re-inked in vermillion with a short shake, so
//             it reads as a correction rather than a celebration.
//
// `transition` is `{ id, to, demoted? }` — `id` so two promotions of
// different cards back-to-back still remount and replay.
//
// Positioning: an absolutely-positioned overlay the size of the card
// stage (`.quiz-card-stage` in index.css), so the seal lands exactly
// where StageBadge draws the resting one — the same corner, the same
// size, the same cosmetic form (it wears the `.stage-badge` classes,
// so an equipped 印 shapes the press too).
const STAMP_GLYPH = { learning: '習', mastered: '極' }

// ── The ground — an open choice ─────────────────────────────
// Three ways the card itself can answer the press, behind the content
// (see "The ground" in index.css). Drawn side by side while the choice
// is open; the picked one stays. The choice is read per stamp from
// localStorage so it can be tried in a real session from /dev/rewards,
// and a stamp may carry its own `style` (the workbench does).
// eslint-disable-next-line react-refresh/only-export-components -- the workbench's list, co-located with the component it switches.
export const STAMP_STYLES = [
  { key: 'rakkan', jp: '落款', label: 'Seal impression' },
  { key: 'hake',   jp: '刷毛', label: 'Brush sweep' },
  { key: 'akari',  jp: '灯',   label: 'Lantern glow' },
]
const DEFAULT_STAMP_STYLE = 'rakkan'
const STYLE_KEY = 'jp-stamp-style'

// eslint-disable-next-line react-refresh/only-export-components -- the style switch is the workbench's, and co-located with the component it switches.
export function readStampStyle() {
  try {
    const v = window.localStorage.getItem(STYLE_KEY)
    return STAMP_STYLES.some(s => s.key === v) ? v : DEFAULT_STAMP_STYLE
  } catch {
    return DEFAULT_STAMP_STYLE
  }
}

// eslint-disable-next-line react-refresh/only-export-components -- see readStampStyle.
export function setStampStyle(key) {
  try { window.localStorage.setItem(STYLE_KEY, key) } catch { /* not persisted */ }
}

// ── How long the press holds before it dissolves ──────────────
// Dead time for the reviewer: every study screen holds the next card
// until the fade-out ends. Each number is the last frame that carries
// information plus a beat to read it — the strike (420ms after a 40ms
// delay) for the routine press, the ripple's end (820ms) for the
// graduation, the re-ink's settle (600ms) for a demotion — with ~80ms
// of margin, because this timer and the CSS run off independent
// clocks and a busy main thread delays the first frame but not the
// setTimeout.
const HOLD_MS = { learning: 660, mastered: 900, demoted: 760 }

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
    const holdMs = prefersReducedMotion() ? REDUCED_HOLD_MS : (HOLD_MS[variant] ?? 620)
    const timer = setTimeout(() => setPhase('leaving'), holdMs)
    return () => clearTimeout(timer)
  }, [variant])

  const leaving = phase === 'leaving'
  const label = to === 'mastered' ? t.mastered : t.learning
  const ground = transition.style ?? readStampStyle()

  const handleAnimationEnd = (e) => {
    if (e.animationName === 'card-stamp-fade-out') onDone?.()
  }

  return (
    <div
      className={`card-stamp-overlay card-stamp-overlay--${variant}${leaving ? ' card-stamp-overlay--leaving' : ''}`}
      aria-hidden="true"
      onAnimationEnd={handleAnimationEnd}
    >
      {/* The card answering the press behind its content — see "The
          ground" in index.css for the three answers being tried. */}
      <span className={`card-stamp__ground card-stamp__ground--${ground}`} data-glyph={STAMP_GLYPH[to]} />
      {/* The card's own edge answering the press in the seal's ink —
          faint for a routine press, gold and full for the graduation.
          Colour is an edge, never a fill. */}
      <span className="card-stamp__ripple" />
      {/* The ink bleeding out from under the seal as it lands. */}
      <span className="card-stamp__ring" />
      <div className={`stage-badge stage-badge--${to} card-stamp__seal`}>
        <span className="stage-badge__glyph">{STAMP_GLYPH[to]}</span>
      </div>
      <span className="card-stamp__caption">{label}</span>
    </div>
  )
}
