import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { TopBar } from '../components/ui/TopBar'
import { SectionHeader } from '../components/ui/SectionHeader'
import { XpToast } from '../components/rewards/XpToast'
import { LEVEL_TITLES, levelTitle } from '../domain/levelTitle'
import { rewardTier } from '../domain/rewardTier'

// ── 試写 — the reward preview ──────────────────────────────
// Every reward in the app is gated behind actually earning it, which
// makes the rare ones effectively unreviewable: a rank promotion
// happens four times in the entire progression, so checking whether
// the 免許皆伝 crossing looks right meant grinding a real account to
// level 30 — or trusting it, which is how a thing nobody has ever
// seen ships broken.
//
// This fires any of them on demand. It is a development-only route:
// App only registers it under import.meta.env.DEV, so it does not
// exist in a production build at all — no flag to leave on by
// accident, no dead screen shipped to users.
//
// The rows are generated from LEVEL_TITLES rather than hardcoded, so a
// new rank appears here the moment it is added to the domain.
const FARE_SAMPLES = [4, 12, 40, 150]

// The level *below* each rank threshold crosses into it. Level 0's
// band has no crossing — you start there.
const RANK_CROSSINGS = LEVEL_TITLES
  .map(([min]) => min)
  .filter(min => min > 0)
  .sort((a, b) => a - b)

export default function RewardsPreview() {
  const navigate = useNavigate()
  const [toast, setToast] = useState(null)

  // Every screen in the app repaints <html data-theme> from storage on
  // mount. Without it this one rendered in whatever theme the previous
  // screen left behind — which for a tool whose whole job is judging
  // how a reward looks in *both* themes is worse than useless.
  useEffect(() => {
    const saved = window.localStorage.getItem('jp-theme')
    if (saved === 'light' || saved === 'dark') {
      document.documentElement.setAttribute('data-theme', saved)
    }
  }, [])

  const fire = payload => {
    // Remount every time: the animations only play on mount, so
    // replaying the same reward twice needs a genuinely new key.
    setToast(null)
    requestAnimationFrame(() => setToast({ ...payload, id: Date.now() }))
  }

  const Row = ({ label, note, onClick, tier }) => (
    <button type="button" className="preview-row" onClick={onClick}>
      <span className={`preview-row__tier preview-row__tier--${tier}`}>{tier}</span>
      <span className="preview-row__body">
        <span className="preview-row__label">{label}</span>
        {note && <span className="preview-row__note">{note}</span>}
      </span>
    </button>
  )

  return (
    <div className="screen">
      <TopBar onBack={() => navigate('/')} title="Rewards preview" />

      <div className="container preview-container">
        <p className="preview-lede">
          Development only — this route is not registered in a production build.
          Each row fires the real component with the real tier logic.
        </p>

        <SectionHeader jp="運賃" title="Fare tick" />
        <p className="preview-note">
          XP with no level change. Fires after nearly every review, so it is
          deliberately the quietest of the three: top-right, ~1.5s, nothing to
          dismiss.
        </p>
        <div className="preview-rows">
          {FARE_SAMPLES.map(xp => (
            <Row
              key={xp}
              tier="fare"
              label={`+${xp} XP`}
              note={xp > 99 ? 'three drums — checks the column padding' : null}
              onClick={() => fire({ amount: xp, leveledUp: false, quality: 5 })}
            />
          ))}
        </div>

        <SectionHeader jp="進級" title="Level board" />
        <p className="preview-note">
          The level number turned over, within the same rank. Self-dismissing.
        </p>
        <div className="preview-rows">
          {[3, 9, 10, 25].map(lv => (
            <Row
              key={lv}
              tier="level"
              label={`Level ${lv - 1} → ${lv}`}
              note={lv === 10 ? 'single digit to double — the drum count grows' : levelTitle(lv)[1]}
              onClick={() => fire({ amount: 24, leveledUp: true, newLevel: lv, quality: 5 })}
            />
          ))}
        </div>

        <SectionHeader jp="再発行" title="Pass re-issued" />
        <p className="preview-note">
          The rank title changed. {RANK_CROSSINGS.length} of these exist in the whole
          progression, which is why this is the only one that waits to be dismissed.
        </p>
        <div className="preview-rows">
          {RANK_CROSSINGS.map(lv => {
            const [, fromJp] = levelTitle(lv - 1)
            const [, toJp, toLatin] = levelTitle(lv)
            return (
              <Row
                key={lv}
                tier="rank"
                label={`Level ${lv} — ${fromJp} → ${toJp}`}
                note={toLatin}
                onClick={() => fire({ amount: 60, leveledUp: true, newLevel: lv, quality: 5 })}
              />
            )
          })}
        </div>

        {/* Proves the tier boundaries are what they claim to be, rather
            than leaving the reader to trust the table above. */}
        <SectionHeader jp="判定" title="Tier resolution" />
        <div className="preview-table">
          {[1, 5, 6, 7, 11, 12, 19, 20, 29, 30, 31].map(lv => (
            <div key={lv} className="preview-table__row">
              <span>level {lv}</span>
              <span className={`preview-row__tier preview-row__tier--${rewardTier({ leveledUp: true, newLevel: lv })}`}>
                {rewardTier({ leveledUp: true, newLevel: lv })}
              </span>
              <span className="preview-table__rank" lang="ja">{levelTitle(lv)[1]}</span>
            </div>
          ))}
        </div>
      </div>

      <XpToast toast={toast} onDone={() => setToast(null)} />
    </div>
  )
}
