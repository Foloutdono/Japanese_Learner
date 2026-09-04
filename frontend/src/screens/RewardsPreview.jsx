import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { TopBar } from '../components/ui/TopBar'
import { SectionHeader } from '../components/ui/SectionHeader'
import { XpToast } from '../components/rewards/XpToast'
import { CardTransition } from '../components/study/CardTransition'
import { STAMP_STYLES, readStampStyle, setStampStyle } from '../components/study/CardStamp'
import PromptCard from '../components/study/PromptCard'
import { CharDisplay } from '../components/study/QuizComponents'
import { LEVEL_TITLES, levelTitle } from '../domain/levelTitle'
import { rewardTier } from '../domain/rewardTier'
import { seedSummary, applyXpGain } from '../stores/profileSummary'

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

// The level HUD (the roundel up top, the bar along the bottom of a
// phone) is what draws a fare now, and it reads the profile store.
// There is no session here to fetch one, so the store is seeded with
// a pass far from its next level, and each fare row pays into it the
// way a real review would.
const SEED = { level: 12, xp: 1450, xpPrevLevel: 1385, xpForNext: 4000, ratingScale: 'simple' }

// The level *below* each rank threshold crosses into it. Level 0's
// band has no crossing — you start there.
const RANK_CROSSINGS = LEVEL_TITLES
  .map(([min]) => min)
  .filter(min => min > 0)
  .sort((a, b) => a - b)

const STAMPS = [
  { label: '新 → 習', note: 'the routine press, ~0.9s', transition: { to: 'learning' } },
  { label: '習 → 極', note: 'the graduation: gold, a double ring, the edge lit once', transition: { to: 'mastered' } },
  { label: '極 → 習', note: 'a lapse: the seal re-inked, with a shake', transition: { to: 'learning', demoted: true } },
]

export default function RewardsPreview() {
  const navigate = useNavigate()
  const [toast, setToast] = useState(null)
  const [stamp, setStamp] = useState(null)
  // The ground the card answers a press with — see CardStamp.jsx. The
  // choice is written through to localStorage, so a real session
  // stamps with it too.
  const [stampStyle, pickStyle] = useState(readStampStyle)

  useEffect(() => { seedSummary(SEED) }, [])

  const fire = payload => {
    // Remount every time: the animations only play on mount, so
    // replaying the same reward twice needs a genuinely new key.
    setToast(null)
    requestAnimationFrame(() => setToast({ ...payload, id: Date.now() }))
  }

  const pay = amount => {
    applyXpGain({ amount })
    fire({ amount, leveledUp: false, quality: 5 })
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

      <main id="main-content" className="container preview-container">
        <p className="preview-lede">
          Development only — this route is not registered in a production build.
          Each row fires the real component with the real tier logic.
        </p>

        <SectionHeader jp="運賃" title="Fare" />
        <p className="preview-note">
          XP with no level change. Fires after nearly every review, so it is
          the quietest of the three and lives on the level HUD itself: the
          roundel pulses and the amount rises off it; on a phone the bottom
          bar lights the span it gained. Nothing to dismiss, nothing held.
        </p>
        <div className="preview-rows">
          {FARE_SAMPLES.map(xp => (
            <Row
              key={xp}
              tier="fare"
              label={`+${xp} XP`}
              note={xp > 99 ? 'three digits — checks the figure does not collide with the level' : null}
              onClick={() => pay(xp)}
            />
          ))}
        </div>

        <SectionHeader jp="押印" title="Card stamp" />
        <p className="preview-note">
          A card climbing a stage gets its seal pressed into the corner it
          already sits in. The next card waits for this one, so every hold
          is measured — see CardStamp.browser.test.jsx.
        </p>
        <div className="preview-seg">
          <span className="seg">
            {STAMP_STYLES.map(st => (
              <button
                key={st.key}
                type="button"
                className={`seg__opt${stampStyle === st.key ? ' seg__opt--on' : ''}`}
                onClick={() => { setStampStyle(st.key); pickStyle(st.key) }}
                title={st.label}
              >
                <span className="seg__opt-jp" lang="ja">{st.jp}</span>
              </button>
            ))}
          </span>
        </div>
        <div className="quiz-area preview-stage" style={{ '--line-color': 'var(--line-kanji)' }}>
          <CardTransition
            className="specimen-card-stage"
            cardKey="preview"
            stamp={stamp}
            stage={stamp?.to === 'mastered' ? 'learning' : stamp?.demoted ? 'mastered' : 'new'}
            onStampDone={() => setStamp(null)}
          >
            <PromptCard foot={{ left: 'N5 漢字', right: '試写' }}>
              <CharDisplay char="渡" variant="glyph" />
            </PromptCard>
          </CardTransition>
        </div>
        <div className="preview-rows">
          {STAMPS.map(({ label, note, transition }) => (
            <Row
              key={label}
              tier="stamp"
              label={label}
              note={note}
              onClick={() => setStamp({ ...transition, style: stampStyle, id: Date.now(), cardKey: 'preview' })}
            />
          ))}
        </div>

        <SectionHeader jp="進級" title="Level board" />
        <p className="preview-note">
          The level number turned over, within the same rank. An
          announcement on the in-car display — docked at the top of a
          phone, under the top bar on a desktop. Self-dismissing, and it
          no longer holds the next card.
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
      </main>

      <XpToast toast={toast} onDone={() => setToast(null)} />
    </div>
  )
}
