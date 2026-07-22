import { useEffect, useState } from 'react'

// ── Card stage stamp ──────────────────────────────────────
// Every review can move a card up the SRS ladder — new (à apprendre)
// → learning (en cours) → mastered (maîtrisé), the same three states
// DeckProgress already colours with --state-new/--state-learning/
// --state-mastered. This is the moment that promotion gets made
// visible: the card itself gets officially notarised, kabuki-style,
// the instant it crosses into a new stage.
//
// `transition` is `{ id, to }` — `id` so two promotions of different
// cards back-to-back still remount and replay (same reasoning as
// XpToast's toast.id), `to` is 'learning' | 'mastered'. Only these
// two transitions get a stamp: dropping *out* of mastered (a lapsed
// review) isn't a celebration, so screens should never construct a
// transition object for it.
//
// The two variants are deliberately unequal weight. 'learning' is a
// quick administrative notation — a single vermillion hanko landing
// on the card, in and gone in about a second, because it happens
// often and shouldn't slow the reviewer down. 'mastered' is the
// graduation: a wider gold-leaf seal, the same kumadori fan XpToast's
// level-up already uses (so the two celebrations read as one
// language), a brush-stroke drawn under the glyph, and a scatter of
// sakura petals — hanami's flowering as the visual shorthand for
// something finally coming to full bloom — drifting down across the
// card before the whole thing dissolves.
//
// Positioning: this renders as a single absolutely-positioned overlay
// meant to sit inside a `position: relative` wrapper the same size as
// the card underneath it (see `.quiz-card-stage` in index.css) —
// it does not size or place itself relative to the viewport the way
// XpToast's level-up overlay does, because a stage promotion belongs
// to *this card*, not to the whole screen.
//
// The backend (see kana.py/kanji.py/vocab.py's post_*_review) already
// resolves the promotion itself — comparing the card's SRS stage
// before and after the review via the same get_bulk_stats classifier
// /stats uses — and returns it as `stage_up` on the review response,
// so each screen only has to do:
//
//   if (data.stage_up) setCardStamp({ id: Date.now(), to: data.stage_up })
//
// No stage-tracking on the frontend at all.
const STAMP_GLYPH = { learning: '習', mastered: '極' }
const STAMP_LABEL = { learning: 'En cours', mastered: 'Maîtrisé' }
const HOLD_MS      = { learning: 900, mastered: 1700 }

// Fixed petal drop positions for the mastered shower — hand-placed
// rather than randomised, same reasoning as EMBER_LAYOUT /
// KUMADORI_ANGLES in XpToast.jsx: a mie is deliberate, not a particle
// system, so it's the same seven petals every time.
const PETAL_LAYOUT = [
  { x: 8,  delay: 0,   drift: 30,  rot: 200, dur: 1500, size: 13 },
  { x: 22, delay: 110, drift: -24, rot: 330, dur: 1700, size: 10 },
  { x: 36, delay: 40,  drift: 26,  rot: 150, dur: 1420, size: 14 },
  { x: 50, delay: 190, drift: -18, rot: 260, dur: 1650, size: 11 },
  { x: 64, delay: 70,  drift: 22,  rot: 90,  dur: 1550, size: 13 },
  { x: 78, delay: 230, drift: -28, rot: 300, dur: 1780, size: 10 },
  { x: 92, delay: 140, drift: 18,  rot: 210, dur: 1500, size: 12 },
]

function PetalShower() {
  return (
    <div className="card-stamp-petals" aria-hidden="true">
      {PETAL_LAYOUT.map((p, i) => (
        <span
          key={i}
          className="petal"
          style={{
            '--petal-x': `${p.x}%`,
            '--petal-delay': `${p.delay}ms`,
            '--petal-drift': `${p.drift}px`,
            '--petal-rot': `${p.rot}deg`,
            '--petal-dur': `${p.dur}ms`,
            '--petal-size': `${p.size}px`,
          }}
        />
      ))}
    </div>
  )
}

export function CardStamp({ transition, onDone }) {
  // Same active/leaving split as XpToast: 'active' covers the strike
  // and hold, 'leaving' is the dissolve. onDone only fires off the
  // real animationend for the fade, never a guessed timer.
  const [phase, setPhase] = useState('active')

  useEffect(() => {
    if (!transition) return
    setPhase('active')
    const timer = setTimeout(() => setPhase('leaving'), HOLD_MS[transition.to] ?? 1000)
    return () => clearTimeout(timer)
  }, [transition])

  if (!transition) return null

  const mastered = transition.to === 'mastered'
  const leaving  = phase === 'leaving'

  const handleAnimationEnd = (e) => {
    if (e.animationName === 'card-stamp-fade-out') onDone?.()
  }

  return (
    <div
      key={transition.id}
      className={`card-stamp-overlay card-stamp-overlay--${transition.to}${leaving ? ' card-stamp-overlay--leaving' : ''}`}
      aria-hidden="true"
      onAnimationEnd={handleAnimationEnd}
    >
      <div className="card-stamp-wash" />
      {mastered && <PetalShower />}
      <div className={`card-stamp${mastered ? ' card-stamp--mastered' : ''}`}>
        {mastered && (
          <span
            className="kumadori-burst kumadori-burst--big card-stamp__burst"
            aria-hidden="true"
            style={{ color: 'var(--state-mastered)' }}
          >
            <span className="kumadori-streak" style={{ '--streak-angle': '-32deg' }} />
            <span className="kumadori-streak" style={{ '--streak-angle': '0deg' }} />
            <span className="kumadori-streak" style={{ '--streak-angle': '28deg' }} />
          </span>
        )}
        <span className="card-stamp__glyph">{STAMP_GLYPH[transition.to]}</span>
        <span className="card-stamp__label">{STAMP_LABEL[transition.to]}</span>
        {mastered && <span className="card-stamp__brush" aria-hidden="true" />}
      </div>
    </div>
  )
}