import { useNavigate } from 'react-router-dom'
import { useLang } from '../../LangContext'
import { useProfileSummary } from '../../stores/profileSummary'
import { useJourneyStatus } from '../../stores/journey'
import { useCredits, openBalance } from '../../stores/credits'
import { useOnline } from '../../hooks/useOnline'
import { useXpGain } from './useXpGain'
import { FareFigure } from './Hud'
import { statusOf, showStatus } from './hudStatus'
import { journeyModel } from '../../domain/goalMath'
import { DAILY_REFILL, CAP, showsCap, refillClock } from '../../domain/credits'
import { playClick } from '../../lib/audio'

// ── 定期券 — the pass in the pocket, at the rail's foot (plan 127) ──
// The rail's foot held the HUD's three instruments as the phone draws
// them across a strip: a roundel, a pocket pass and a lit panel, three
// shapes on three alignments, none on the rail's own column. Of five
// directions drawn on the canvas "Rail foot directions", the owner chose
// the pass: the three are one object, the learner's commuter pass, the
// rail's other bookend (辻駅's plate at its head, your pass at its
// foot). Three doors on one card, each the HUD's own, with its guide
// anchor:
//
//   the face   the level roundel (the fare still rises off it) and the
//              climb to the next level in the pass's gold, the run's
//              level bar at pocket size. → the pass (/profile).
//   the purse  the contactless mark and the balance, captioned with what
//              it counts, or, when it is spent, when it comes back
//              (+30 à 00:00). → the balance sheet.
//   the stub   the journey's word and drift under a perforation, lit by
//              a lamp in the state's ink; the offline word when the
//              network has gone. → the pass's back (showStatus: the
//              panel beside Today's gate, or the status sheet).
//
// The card's edge is the balance's, as the pocket pass's was: warning
// at five or fewer, danger at none. Desk only: the phone keeps its HUD.
export function DeskPass() {
  const { t, lang } = useLang()
  const navigate = useNavigate()
  const summary = useProfileSummary()
  const { gain, clear } = useXpGain(summary)
  const credits = useCredits()
  const online = useOnline()
  const { data } = useJourneyStatus()

  // The climb, measured as the run's level bar measures it (LevelBar).
  const span = summary ? Math.max(1, summary.xpForNext - summary.xpPrevLevel) : 1
  const into = summary ? Math.min(span, Math.max(0, summary.xp - summary.xpPrevLevel)) : 0
  const pct = Math.round((into / span) * 100)
  const climb = summary ? `${into.toLocaleString()} / ${span.toLocaleString()}` : ''
  const levelLabel = summary ? `${t.level} ${summary.level}` : t.profileTitle

  const balance = credits?.unlimited ? null : credits?.balance
  const cap = credits?.cap ?? CAP
  const low = balance != null && balance > 0 && balance <= 5
  const out = balance === 0
  const note = out
    ? t.balanceRefillLine(credits.dailyRefill ?? DAILY_REFILL, refillClock(credits.refillAt, lang))
    : balance != null ? t.creditsUnit : null
  const figure = credits?.unlimited ? '∞'
    : balance != null ? `${balance}${showsCap(balance, cap) ? ` / ${cap}` : ''}` : ''

  // No contract yet (never onboarded): nothing to judge, no stub.
  const panel = online ? statusOf(data ? journeyModel(data) : null) : { status: 'offline', days: null }
  const word = panel && (panel.status === 'offline' ? t.hudOffline : t.hudStatus[panel.status])
  const drift = panel?.days ? t.hudDays(panel.days) : null

  const classes = ['desk-pass', low ? 'desk-pass--low' : '', out ? 'desk-pass--out' : ''].filter(Boolean).join(' ')
  return (
    <div className={classes}>
      <div className="desk-pass__face">
        <button
          type="button"
          className="desk-pass__level"
          data-guide="hud.level"
          aria-label={summary ? `${levelLabel} · ${climb} xp` : levelLabel}
          title={levelLabel}
          onClick={() => { playClick(); navigate('/profile') }}
        >
          <span className={`hud__level${gain ? ' hud__level--gain' : ''}`}>
            <span>{summary?.level ?? ''}</span>
            <FareFigure gain={gain} className="hud-fare" onEnd={clear} />
          </span>
          <span className="desk-pass__climb">
            <span className="desk-pass__track">
              <span className="desk-pass__fill" style={{ width: `${pct}%` }} />
              {gain && gain.toPct > gain.fromPct && (
                <span
                  key={gain.id}
                  className="desk-pass__gain"
                  style={{ left: `${gain.fromPct}%`, width: `${gain.toPct - gain.fromPct}%` }}
                />
              )}
            </span>
            <span className="desk-pass__xp">
              {climb}
              <span className="desk-pass__unit">xp</span>
            </span>
          </span>
        </button>
        <button
          type="button"
          className="desk-pass__purse"
          data-guide="hud.pass"
          aria-label={[t.passLabel, figure, note].filter(Boolean).join(' · ')}
          onClick={() => { playClick(); openBalance() }}
        >
          <span className="desk-pass__fig">
            {/* The contactless mark, the pocket pass's own rings. */}
            <span className="hud__pass-wave" aria-hidden="true">
              <span className="hud__pass-ring" />
              <span className="hud__pass-ring hud__pass-ring--2" />
              <span className="hud__pass-ring hud__pass-ring--3" />
            </span>
            {credits?.unlimited && <span className="hud__pass-fig hud__pass-fig--inf">∞</span>}
            {balance != null && (
              <span className="hud__pass-fig">
                {balance}
                {showsCap(balance, cap) && <span className="hud__pass-of">/{cap}</span>}
              </span>
            )}
          </span>
          {note && <span className="desk-pass__note">{note}</span>}
        </button>
      </div>
      {panel && (
        <button
          type="button"
          className={`desk-pass__stub desk-pass__stub--${panel.status}`}
          data-guide="hud.status"
          aria-label={[t.hudStatusLabel, word, drift].filter(Boolean).join(' · ')}
          onClick={() => { playClick(); showStatus() }}
        >
          <span className="desk-pass__word">{word}</span>
          {drift && <span className="desk-pass__drift">{drift}</span>}
        </button>
      )}
    </div>
  )
}
