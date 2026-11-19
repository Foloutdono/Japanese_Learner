import { useLang } from '../../LangContext'
import { useProfileSummary } from '../../stores/profileSummary'
import { useCredits } from '../../stores/credits'
import { useRunTally } from '../../stores/runTally'
import { cardTier, xpClimb } from '../../domain/passCard'
import { StruckMark } from '../offers/StruckMark'
import { useXpGain } from '../chrome/useXpGain'
import { FareFigure } from '../chrome/Hud'

// ── 上下 — the run's console on a phone (plan 174) ─────────────────────
// The owner's pick "console C refined" of the canvas "Tsuji — the three
// offers", page "The run's console": a card or practice run below the
// desk splits what its floor used to stack into the two places each
// belongs.
//
//   RunMeter   (retired by plan 326, the owner's call: the strip under
//              the head went to give the card's strip its room; the
//              head's remaining pill says the count again.)
//   RunFloor   the floor, the level: the card's struck 辻 with its road
//              filled to the climb (the HUD's own mark), the level, the
//              climb's track with this run's gain lit on it, and the
//              run's XP in the card's ink, the fare rising off it on
//              each rating. Near a level-up the next level waits at the
//              track's end.
//
// The balance stays in the head (StageHead's pocket pass), where the
// owner asked to keep it. Both read the run's tally (stores/runTally)
// and the summary, so no screen hands them anything but the length.

// Where the next level waits on the track: the last tenth of the climb.
const NEAR = 0.9

export function RunFloor() {
  const { t } = useLang()
  const summary = useProfileSummary()
  const credits = useCredits()
  const { xp: runXp } = useRunTally()
  const { gain, clear } = useXpGain(summary)
  const tier = cardTier(credits)
  const { into, span, share } = xpClimb(summary)
  // This run's span on the track: from where it started to where it is,
  // clamped to the level -- a run that crossed a level shows the part
  // climbed in this one.
  const from = Math.max(0, into - runXp) / span
  const near = summary && share >= NEAR
  return (
    <div className={`run-floor run-floor--${tier}`}>
      <span className="run-floor__lv" aria-hidden="true">
        <StruckMark xp={share} etched={tier === 'max'} className="run-floor__mark" />
        <b>{summary?.level ?? ''}</b>
      </span>
      <span
        className={`run-floor__track${near ? ' run-floor__track--near' : ''}`}
        role="progressbar"
        aria-label={summary ? `${t.level} ${summary.level}` : t.level}
        aria-valuemin={0}
        aria-valuemax={span}
        aria-valuenow={into}
      >
        <span className="run-floor__fill" style={{ width: `${share * 100}%` }} />
        {runXp > 0 && <span className="run-floor__gain" style={{ left: `${from * 100}%`, width: `${(share - from) * 100}%` }} />}
        {near && <span className="run-floor__next" aria-hidden="true">{summary.level + 1}</span>}
      </span>
      <span className="run-floor__trip">
        +{runXp}<small>xp</small>
        <FareFigure gain={gain} className="hud-fare run-floor__fare" onEnd={clear} />
      </span>
    </div>
  )
}
