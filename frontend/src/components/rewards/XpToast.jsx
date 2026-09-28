import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLang } from '../../LangContext'
import { playFareTick, playPassClip, FARE_BEAT } from '../../lib/audio'
import { rewardTier } from '../../domain/rewardTier'
import { xpThreshold } from '../../domain/xpCurve'
import { useProfileSummary } from '../../stores/profileSummary'
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
//   level  The level turned over. 改札鋏 (plan 142): the learner's pass
//          comes down, the gate's punch clips a bite out of its top
//          edge, the old figure is struck and the new one printed, and
//          the balance empties to the new level's start. Gone on its
//          own in a couple of seconds; it does not hold the next card.
//          It replaced the split-flap board of the in-car display,
//          whose drums turned while the board was still sliding in, so
//          the one moment it existed to show was half missed; chosen
//          by the owner from four directions drawn side by side.
//
// Scenes are keyed on the toast id and kept until they finish on
// their own, so a level pass is never cut short by the fare of the
// card rated straight after it; a fare, though, always replaces the
// previous fare, since two figures in the same place read as noise.
//
// `dock` is where the pass stands on the desk: the top of a run's
// column (StudyStage hands it the left column on three panels, the
// side otherwise), where it docks in the column's flow and the column
// steps down under it (the 机 section of index.css). Without one it is
// portalled to the body: hung across the top of a phone, floating at
// the right of a wider screen.
const FARE_MS  = 900
const LEVEL_MS = 2400

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

// The pass's two balances: the old level's, topped out, and the new
// one's so far. The store has already moved to the new level when the
// toast arrives (useReviewGates pays applyXpGain first), so the old
// span comes from the curve the store itself climbs by. Null before a
// summary exists, when the pass prints its track and no figures.
function balances(summary, level) {
  if (!summary || summary.xpForNext == null) return null
  const span = Math.max(1, summary.xpForNext - summary.xpPrevLevel)
  const into = Math.min(span, Math.max(0, summary.xp - summary.xpPrevLevel))
  const was = Math.max(1, xpThreshold(level) - xpThreshold(level - 1))
  return { was, into, span, pct: Math.round((into / span) * 100) }
}

function RewardScene({ toast, dock, onDone }) {
  const { t } = useLang()
  const summary = useProfileSummary()
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
    // voice is the punch, and it sounds on the cut itself (onCut, below).
    if (tier === 'fare' && !sounded.current) {
      sounded.current = true
      playFareTick(FARE_BEAT)
    }

    // The fare has no visual of its own here and just retires; the
    // pass is on a clock.
    if (tier === 'fare') {
      const id = setTimeout(() => onDone?.(), FARE_MS)
      return () => clearTimeout(id)
    }
    const id = setTimeout(() => setLeaving(true), LEVEL_MS)
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // The pass is a panel, not an overlay: while it hangs across the top
  // of a phone the page slides down under it so the card keeps its head
  // clear, and slides back as the pass leaves. The attribute is what
  // index.css keys that on (`:root[data-levelup]`); set here rather
  // than in CSS because the pass is a portal and the page is not its
  // descendant. DeskKeys reads it too.
  useEffect(() => {
    if (tier !== 'level') return
    const root = document.documentElement
    if (leaving) root.removeAttribute('data-levelup')
    else root.setAttribute('data-levelup', '')
    return () => root.removeAttribute('data-levelup')
  }, [tier, leaving])

  // 机 (plan 123): on the desk Esc retires the pass, as any key skips
  // the cutscenes -- it used to hold the page's Esc for its whole 2.4s.
  // The run's own Esc (DeskKeys' LeaveKey) steps aside while the pass
  // stands, so the first Esc is the pass's and the second leaves.
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
  const fig = balances(summary, level)

  // The punch sounds on the frame the bite opens: its animation's own
  // start, after the drop and the beat the old figure is shown for.
  const onCut = e => {
    if (e.animationName !== 'levelup-bite' || sounded.current) return
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
      className={`levelup${leaving ? ' levelup--leaving' : ''}`}
      aria-live="polite"
      onAnimationStart={onCut}
      onAnimationEnd={onExitEnd}
      style={fig ? { '--levelup-to': `${fig.pct}%` } : undefined}
    >
      <span className="sr-only">{`${t.levelUp} ${t.level} ${level}`}</span>
      <div className="levelup__pass" aria-hidden="true">
        {/* A figure and its label form a fixed pair: the caps label
            over the figure, the pass's own order (DESIGN.md, Figures). */}
        <span className="levelup__level">
          <span className="levelup__cap">{t.level}</span>
          <span className="levelup__num">
            <span className="levelup__was">{level - 1}</span>
            <span className="levelup__now">{level}</span>
          </span>
        </span>
        <span className="levelup__balance">
          <span className="levelup__track"><span className="levelup__fill" /></span>
          {fig && (
            <span className="levelup__xp">
              <span className="levelup__xp-was">
                {fig.was.toLocaleString()} / {fig.was.toLocaleString()}<span className="levelup__unit">xp</span>
              </span>
              <span className="levelup__xp-now">
                {fig.into.toLocaleString()} / {fig.span.toLocaleString()}<span className="levelup__unit">xp</span>
              </span>
            </span>
          )}
        </span>
      </div>
      <span className="levelup__chip" aria-hidden="true" />
    </div>,
    dock ?? document.body,
  )
}
