import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLang } from '../../LangContext'
import { playFareTick, playPassClip, FARE_BEAT } from '../../lib/audio'
import { rewardTier } from '../../domain/rewardTier'
import { cardTier, xpClimb } from '../../domain/passCard'
import { useProfileSummary } from '../../stores/profileSummary'
import { useCredits } from '../../stores/credits'
import { CardFace } from '../pass/PassCard'
import { isDesk } from '../../hooks/useDesk'

// ── What happens when you earn something ──────────────────────
// Two tiers, two sizes; see domain/rewardTier. Neither interrupts —
// the 再発行 board that did (a rank title crossing) went with the
// titles themselves:
//
//   fare   XP, no level. Nearly every review. It is not a toast at
//          all any more: the level HUD reports it in place — the
//          bottom bar on a phone, the roundel on a desktop — with the
//          figure rising off the object it was paid into (see
//          components/ui/TopBar.jsx). This component only sounds the
//          tick and announces the amount to assistive tech.
//   level  The level turned over, told by the card's engraving (plan
//          173, the owner's drawing on the canvas page "The pocket pass
//          & the level-up"): the learner's card comes down, the road 辶
//          of its struck 辻 fills from empty to full, faster as it goes,
//          the card trembling harder the fuller it gets; full, the road
//          flashes and throws a ring and sparks; it empties in one
//          breath and the level under the name rolls over to the next.
//          Gone on its own a second after the new figure lands; it does
//          not hold the next card. It replaced plan 142's punch (改札鋏),
//          which had replaced the split-flap board.
//
// Scenes are keyed on the toast id and kept until they finish on
// their own, so a level pass is never cut short by the fare of the
// card rated straight after it; a fare, though, always replaces the
// previous fare, since two figures in the same place read as noise.
//
// `dock` is where the card stands on the desk: the top of a run's
// column (StudyStage hands it the left column on three panels, the
// side otherwise), where it docks in the column's flow and the column
// steps down under it (the 机 section of index.css). Without one it is
// portalled to the body: hung at the top of a phone, over the run,
// floating at the right of a wider screen.
const FARE_MS  = 900
// The leave: 0.8s after the new figure has landed (2.95s), the timing
// the owner asked for on the canvas -- the card had stayed too long.
const LEVEL_MS = 3750

// The sparks out of the road's sweep: an angle, a reach, a length (0
// for a round one), a delay, a bend and whether it is the bright ink.
const SPARKS = [
  [-170, 120, 15, 0, -8, 0], [-150, 150, 17, 0.02, 6, 1], [-128, 110, 12, 0.01, -4, 0],
  [-112, 165, 17, 0.03, 10, 0], [-96, 130, 13, 0, -6, 1], [-80, 175, 19, 0.02, 4, 0],
  [-64, 125, 12, 0.04, -10, 0], [-48, 160, 17, 0.01, 8, 1], [-30, 115, 13, 0.02, -5, 0],
  [-14, 150, 16, 0, 6, 0], [4, 120, 13, 0.03, -8, 1], [22, 140, 15, 0.01, 10, 0],
  [40, 95, 12, 0.02, -6, 0], [160, 100, 12, 0.03, 8, 0], [178, 135, 16, 0.01, -6, 1],
  [-140, 70, 0, 0.05, 0, 0], [-88, 85, 0, 0.04, 0, 1], [-40, 78, 0, 0.06, 0, 0],
  [10, 70, 0, 0.05, 0, 1], [-118, 60, 0, 0.07, 0, 0], [-60, 95, 0, 0.03, 0, 0],
]

export function XpToast({ toast, onDone, dock = null }) {
  const [seen, setSeen] = useState(null)
  const [scenes, setScenes] = useState([])

  // Adjust-state-during-render (the React docs pattern), not an
  // effect: the new scene has to exist in the same render the prop
  // arrives in, or the fare's sound would trail its own figure.
  if (toast && toast.id !== seen) {
    setSeen(toast.id)
    const tier = rewardTier(toast)
    setScenes(list => [
      ...list.filter(s => !(tier === 'fare' && s.tier === 'fare')),
      { ...toast, tier },
    ])
  }

  function finish(id) {
    setScenes(list => list.filter(s => s.id !== id))
    onDone?.()
  }

  return scenes.map(scene => (
    <RewardScene key={scene.id} toast={scene} dock={dock} onDone={() => finish(scene.id)} />
  ))
}

// What the new level already holds, as the share of its span the road
// refills to once it has emptied. The store has already moved to the
// new level when the toast arrives (useReviewGates pays applyXpGain
// first). Zero before a summary exists.
function newShare(summary) {
  if (!summary || summary.xpForNext == null) return 0
  return xpClimb(summary).share
}

function RewardScene({ toast, dock, onDone }) {
  const { t } = useLang()
  const summary = useProfileSummary()
  const credits = useCredits()
  const [leaving, setLeaving] = useState(false)
  // StrictMode runs effects twice in development, and playing a sound
  // is not idempotent — every reward fired its audio as an audible
  // flam. The timers below are safe by construction (cleanup clears
  // them), but these calls are immediate, so they need the guard.
  const sounded = useRef(false)
  const tier = toast.tier

  useEffect(() => {
    // The fare's coin sounds as it lands, a beat after the rating's
    // answer (FARE_BEAT), which is played on the same press. A level's
    // voice sounds on the burst itself (onBurst, below).
    if (tier === 'fare' && !sounded.current) {
      sounded.current = true
      playFareTick(FARE_BEAT)
    }

    // The fare has no visual of its own here and just retires; the
    // card is on a clock.
    if (tier === 'fare') {
      const id = setTimeout(() => onDone?.(), FARE_MS)
      return () => clearTimeout(id)
    }
    const id = setTimeout(() => setLeaving(true), LEVEL_MS)
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // While the card stands the root says so (`:root[data-levelup]`):
  // set here rather than in CSS because the card is a portal and the
  // page is not its descendant. DeskKeys reads it, so the run's own Esc
  // steps aside while it stands.
  useEffect(() => {
    if (tier !== 'level') return
    const root = document.documentElement
    if (leaving) root.removeAttribute('data-levelup')
    else root.setAttribute('data-levelup', '')
    return () => root.removeAttribute('data-levelup')
  }, [tier, leaving])

  // 机 (plan 123): on the desk Esc retires the card, as any key skips
  // the cutscenes. The run's own Esc (DeskKeys' LeaveKey) steps aside
  // while it stands, so the first Esc is the card's and the second
  // leaves.
  useEffect(() => {
    if (tier !== 'level' || leaving || !isDesk()) return undefined
    const onKey = e => {
      if (e.key !== 'Escape' || e.repeat) return
      e.preventDefault()
      setLeaving(true)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [tier, leaving])

  // ── fare ──
  // Drawn by the HUD (components/chrome/Hud.jsx). What is left for the portal is the
  // one thing a rising figure cannot do: tell a screen reader.
  if (tier === 'fare') {
    return createPortal(
      <span className="sr-only" aria-live="polite">+{toast.amount} XP</span>,
      document.body,
    )
  }

  const level = toast.newLevel
  const material = cardTier(credits)

  // The voice sounds on the frame the road bursts: the ring's own
  // animation start, after the fill and the beat it is held full.
  const onBurst = e => {
    if (e.animationName !== 'levelup-ring' || sounded.current) return
    sounded.current = true
    playPassClip()
  }
  // onDone only ever fires on the real animationend of the exit, never
  // on a timer guessing how long the CSS will take. Every exit's name
  // carries `levelup-out` (the phone's, the reduced one, the desk's
  // dock); the pieces inside animate under other names and bubble here.
  const onExitEnd = e => {
    if (e.target === e.currentTarget && e.animationName.includes('levelup-out')) onDone?.()
  }

  // ── level ──
  return createPortal(
    <div
      className={`levelup levelup--${material}${leaving ? ' levelup--leaving' : ''}`}
      aria-live="polite"
      onAnimationStart={onBurst}
      onAnimationEnd={onExitEnd}
      style={{ '--levelup-to': newShare(summary) }}
    >
      <span className="sr-only">{`${t.levelUp} ${t.level} ${level}`}</span>
      <div className="levelup__shake">
        <CardFace
          tier={material}
          name={summary?.username ?? ''}
          level={level}
          share={0}
          className="levelup__card"
          levelSlot={(
            <span className="levelup__num">
              <b className="levelup__was">{level - 1}</b>
              <b className="levelup__now">{level}</b>
            </span>
          )}
        >
          <span className="levelup__burst" aria-hidden="true">
            <i className="levelup__ring" />
            {SPARKS.map(([a, r, w, d, bend, bright], i) => (
              <i
                key={i}
                className={`levelup__spark${w ? '' : ' levelup__spark--dot'}${bright ? ' levelup__spark--bright' : ''}`}
                style={{ '--lu-a': `${a}deg`, '--lu-r': r, '--lu-w': w, '--lu-d': d, '--lu-bend': `${bend}deg` }}
              />
            ))}
          </span>
        </CardFace>
      </div>
    </div>,
    dock ?? document.body,
  )
}
