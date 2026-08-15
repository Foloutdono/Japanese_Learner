import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLang } from '../../LangContext'
import { playFareTick, playFlapClatter, playStationMelody } from '../../lib/audio'
import { rewardTier, rankFor } from '../../domain/rewardTier'
import { SplitFlap } from './SplitFlap'

// ── 発車標 — the reward board ──────────────────────────────
// What happens when you earn something. It used to be a kabuki
// production — wooden clappers counting in, a kumadori burst, stage
// footlights igniting along the bottom of the screen, a striped
// curtain ripped open, a hanko slammed into the corner — and it played
// at that scale for *every* review. Something that happens after
// nearly every card cannot also be a ceremony.
//
// It is the station's own display now, and it comes in three sizes.
// See domain/rewardTier for where the boundaries come from; the short
// version is that a rank promotion happens four times in the whole
// progression, so only that one is allowed to stop everything.
//
//   fare   XP, no level. A fare tick at the gate: the amount flips up
//          on a single small board, under a second, no interaction.
//   level  The level turned over. The board flips the number, holds
//          long enough to read, and leaves on its own.
//   rank   The title changed. Your 定期券 is re-issued: the pass comes
//          up, the level flips, the 称号 turns over under it, and it
//          waits to be dismissed by hand.
//
// The kabuki is not gone, only moved: the daruma hall's 満願 ceremony
// is genuinely theatrical and still uses StageFootlights, which now
// lives in its own module.
const FARE_MS  = 1900
const LEVEL_MS = 2600

// The shell reads the reward; the scene below plays it. Keyed on the
// toast id so a second reward mounts fresh rather than needing its
// state reset inside an effect — same shape as the ticket gate and
// the train door, and the reason none of the three has to fight
// react-hooks/set-state-in-effect.
export function XpToast({ toast, onDone }) {
  if (!toast) return null
  return <RewardScene key={toast.id} toast={toast} onDone={onDone} />
}

function RewardScene({ toast, onDone }) {
  const { t } = useLang()
  const [leaving, setLeaving] = useState(false)
  // StrictMode runs effects twice in development, and playing a sound
  // is not idempotent — every reward fired its audio as an audible
  // flam. The timers below are safe by construction (cleanup clears
  // them), but this one call is immediate, so it needs the guard.
  const sounded = useRef(false)

  const tier = rewardTier(toast)

  useEffect(() => {
    // Each tier gets its own voice. They used to share one sample, so
    // the rarest event in the app and a routine level sounded
    // identical — and the fare tick borrowed the ticket gate's chime,
    // which already means something else entirely.
    //
    //   fare   its own soft blip. Not playUi('click') — that points at
    //          /sounds/ui/click.mp3, which does not exist, so the tick
    //          was silent; and not the gate's chime, which already
    //          means "your pass was read".
    //   level  the board turning over — filtered noise, because a
    //          split-flap drum is plastic hitting a stop, not a tone.
    //   rank   発車メロディ, the platform melody. Four times ever.
    if (!sounded.current) {
      sounded.current = true
      if (tier === 'rank') playStationMelody()
      else if (tier === 'level') playFlapClatter()
      else playFareTick()
    }

    // A promotion waits to be dismissed; the other two are on a clock.
    if (tier === 'rank') return
    const id = setTimeout(() => setLeaving(true), tier === 'level' ? LEVEL_MS : FARE_MS)
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // onDone only ever fires on the real animationend of the exit, never
  // on a timer guessing how long the CSS will take. animationend
  // bubbles from every flap, so both handlers match by name.
  const onExitEnd = name => e => { if (e.animationName === name) onDone?.() }

  // ── fare ──
  if (tier === 'fare') {
    return createPortal(
      <div
        className={`fare-tick fare-tick--q${toast.quality ?? 5}${leaving ? ' fare-tick--leaving' : ''}`}
        aria-live="polite"
        onAnimationEnd={onExitEnd('fare-tick-out')}
      >
        <span className="fare-tick__plus" aria-hidden="true">+</span>
        <SplitFlap from={0} to={toast.amount} label={`+${toast.amount} XP`} />
        <span className="fare-tick__label">XP</span>
      </div>,
      document.body,
    )
  }

  const level = toast.newLevel
  const rank = rankFor(level)

  // ── level ──
  if (tier === 'level') {
    return createPortal(
      <div
        className={`level-board${leaving ? ' level-board--leaving' : ''}`}
        aria-live="polite"
        onAnimationEnd={onExitEnd('level-board-out')}
      >
        <div className="level-board__panel">
          <span className="level-board__label" lang="ja">進級</span>
          <span className="level-board__latin">{t.levelUp}</span>
          <div className="level-board__flaps">
            <span className="level-board__unit">{t.level}</span>
            <SplitFlap from={level - 1} to={level} label={`${t.level} ${level}`} />
          </div>
          <span className="level-board__xp">+{toast.amount} XP</span>
          <div className="level-board__stripe" aria-hidden="true" />
        </div>
      </div>,
      document.body,
    )
  }

  // ── rank ──
  const before = rankFor(Math.max(0, level - 1))
  return createPortal(
    <div
      className={`reissue${leaving ? ' reissue--leaving' : ''}`}
      aria-live="polite"
      onAnimationEnd={onExitEnd('reissue-out')}
    >
      <div className="reissue__scrim" aria-hidden="true" />

      <div className="reissue__pass">
        <div className="reissue__head">
          <span className="reissue__brand" lang="ja">定期券</span>
          <span className="reissue__issued" lang="ja">再発行</span>
        </div>

        <div className="reissue__flaps">
          <span className="reissue__unit">{t.level}</span>
          <SplitFlap from={level - 1} to={level} stagger={90} label={`${t.level} ${level}`} />
        </div>

        {/* The title is the reason this tier exists, so it turns over
            on its own board under the number rather than just being
            printed there. */}
        <div className="reissue__rank" lang="ja">
          <span className="reissue__rank-from">{before.jp}</span>
          <span className="reissue__rank-arrow" aria-hidden="true">→</span>
          <span className="reissue__rank-to">{rank.jp}</span>
        </div>
        <div className="reissue__rank-latin">{rank.latin}</div>

        <div className="reissue__stripe" aria-hidden="true" />

        <button
          type="button"
          className="reissue__claim"
          onClick={() => setLeaving(true)}
          disabled={leaving}
        >
          {t.claimBtn}
        </button>
      </div>
    </div>,
    document.body,
  )
}
