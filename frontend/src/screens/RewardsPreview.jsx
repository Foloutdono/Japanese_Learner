import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ScreenBar } from '../components/chrome/Bar'
import { SectionHeader } from '../components/ui/SectionHeader'
import { XpToast } from '../components/rewards/XpToast'
import { CardTransition } from '../components/study/CardTransition'
import PromptCard from '../components/study/PromptCard'
import { CharDisplay } from '../components/study/QuizComponents'
import { seedSummary, applyXpGain } from '../stores/profileSummary'

// ── 試写 — the reward preview ──────────────────────────────
// Every reward in the app is gated behind actually earning it, which
// makes the rarer ones effectively unreviewable: checking whether a
// level board looks right at three digits, or whether a demotion
// stamp reads as a lapse, meant grinding a real account there — or
// trusting it, which is how a thing nobody has ever seen ships broken.
//
// This fires any of them on demand. It is a development-only route:
// App only registers it under import.meta.env.DEV, so it does not
// exist in a production build at all — no flag to leave on by
// accident, no dead screen shipped to users.
//
// There used to be a fourth section here, the 再発行 pass re-issue,
// which was the reason this workbench was written at all. It went with
// the rank titles it announced (domain/rewardTier).
const FARE_SAMPLES = [4, 12, 40, 150]

// The level HUD (the roundel up top, the bar along the bottom of a
// phone) is what draws a fare now, and it reads the profile store.
// There is no session here to fetch one, so the store is seeded with
// a pass far from its next level, and each fare row pays into it the
// way a real review would.
const SEED = { level: 12, xp: 1450, xpPrevLevel: 1385, xpForNext: 4000, ratingScale: 'simple' }

const STAMPS = [
  { label: '新 → 習', note: 'the routine press: a faint vermillion 落款, ~0.9s', transition: { to: 'learning' } },
  { label: '習 → 極', note: 'the graduation: gold, a double-line seal, the edge lit in full', transition: { to: 'mastered' } },
  { label: '極 → 習', note: 'a lapse: the impression re-inked, with a shake', transition: { to: 'learning', demoted: true } },
]

export default function RewardsPreview() {
  const navigate = useNavigate()
  const [toast, setToast] = useState(null)
  const [stamp, setStamp] = useState(null)

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
      <ScreenBar onBack={() => navigate('/')} title="Rewards preview" />

      <main id="main-content" className="container preview-container">
        <p className="preview-lede">
          Development only — this route is not registered in a production build.
          Each row fires the real component with the real tier logic.
        </p>

        <SectionHeader jp="運賃" title="Fare" />
        <p className="preview-note">
          XP with no level change. Fires after nearly every review, so it is
          the quietest of them and lives on the level HUD itself: the
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

        <SectionHeader jp="落款" title="Card stamp" />
        <p className="preview-note">
          A card climbing a stage is signed: a 落款 impression pressed into the
          lower corner in the equipped 印's form, the stage word turning over in
          the top corner. The next card waits for this one, so every hold is
          measured — see CardStamp.browser.test.jsx.
        </p>
        <div className="stage preview-stage" style={{ '--line-color': 'var(--line-kanji)' }}>
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
              onClick={() => setStamp({ ...transition, id: Date.now(), cardKey: 'preview' })}
            />
          ))}
        </div>

        <SectionHeader jp="進級" title="Level board" />
        <p className="preview-note">
          The level number turned over. An announcement on the in-car
          display — docked at the top of a phone, under the top bar on a
          desktop. Self-dismissing, and it never holds the next card.
        </p>
        <div className="preview-rows">
          {[3, 9, 10, 25].map(lv => (
            <Row
              key={lv}
              tier="level"
              label={`Level ${lv - 1} → ${lv}`}
              note={lv === 10 ? 'single digit to double — the drum count grows' : null}
              onClick={() => fire({ amount: 24, leveledUp: true, newLevel: lv, quality: 5 })}
            />
          ))}
        </div>
      </main>

      <XpToast toast={toast} onDone={() => setToast(null)} />
    </div>
  )
}
