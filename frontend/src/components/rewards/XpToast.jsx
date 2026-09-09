import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLang } from '../../LangContext'
import { playFareTick, playFlapClatter } from '../../lib/audio'
import { rewardTier } from '../../domain/rewardTier'
import { SplitFlap } from './SplitFlap'

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
//   level  The level turned over. An announcement on the in-car
//          display: a board docked at the top of the screen, the
//          number flipping on its drums, gone on its own in a couple
//          of seconds. It does not hold the next card.
//
// Scenes are keyed on the toast id and kept until they finish on
// their own, so a level board is never cut short by the fare of the
// card rated straight after it; a fare, though, always replaces the
// previous fare, since two figures in the same place read as noise.
const FARE_MS  = 900
const LEVEL_MS = 2400

export function XpToast({ toast, onDone }) {
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
    <RewardScene key={scene.id} toast={scene} onDone={() => finish(scene.id)} />
  ))
}

function RewardScene({ toast, onDone }) {
  const { t } = useLang()
  const [leaving, setLeaving] = useState(false)
  // StrictMode runs effects twice in development, and playing a sound
  // is not idempotent — every reward fired its audio as an audible
  // flam. The timers below are safe by construction (cleanup clears
  // them), but this one call is immediate, so it needs the guard.
  const sounded = useRef(false)
  const tier = toast.tier

  useEffect(() => {
    // Each tier gets its own voice: a soft blip for the fare, the
    // board's drums for a level.
    if (!sounded.current) {
      sounded.current = true
      if (tier === 'level') playFlapClatter()
      else playFareTick()
    }

    // The fare has no visual of its own here and just retires; the
    // board is on a clock.
    if (tier === 'fare') {
      const id = setTimeout(() => onDone?.(), FARE_MS)
      return () => clearTimeout(id)
    }
    const id = setTimeout(() => setLeaving(true), LEVEL_MS)
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // The board is a panel, not an overlay: while it is docked across
  // the top of a phone the page slides down under it so the card
  // keeps its head clear, and slides back as the board leaves. The
  // attribute is what index.css keys that on (`:root[data-levelup]`);
  // set here rather than in CSS because the board is a portal and the
  // page is not its descendant.
  useEffect(() => {
    if (tier !== 'level') return
    const root = document.documentElement
    if (leaving) root.removeAttribute('data-levelup')
    else root.setAttribute('data-levelup', '')
    return () => root.removeAttribute('data-levelup')
  }, [tier, leaving])

  // onDone only ever fires on the real animationend of the exit, never
  // on a timer guessing how long the CSS will take. animationend
  // bubbles from every flap, so both handlers match by name.
  const onExitEnd = name => e => { if (e.animationName === name) onDone?.() }

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

  // ── level ──
  return createPortal(
    <div
      className={`levelup${leaving ? ' levelup--leaving' : ''}`}
      aria-live="polite"
      onAnimationEnd={onExitEnd('levelup-out')}
    >
      <div className="levelup__board">
        <span className="levelup__mark">
          <span className="levelup__jp" lang="ja">進級</span>
          <span className="levelup__latin">{t.levelUp}</span>
        </span>
        {/* A figure and its label form a fixed pair: the drums, the
            caps label beneath (DESIGN.md, Figures). */}
        <span className="levelup__flaps">
          <SplitFlap from={level - 1} to={level} label={`${t.level} ${level}`} />
          <span className="levelup__unit">{t.level}</span>
        </span>
      </div>
    </div>,
    document.body,
  )
}

