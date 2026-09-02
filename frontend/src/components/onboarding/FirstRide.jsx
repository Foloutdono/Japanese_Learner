import { useState } from 'react'
import { Flashcard, CharDisplay, MeaningDisplay } from '../study/QuizComponents'
import RatingBar from '../study/RatingBar'
import { journeyItems } from '../../domain/goalMath'

// ── 試乗 — the first ride (plan 063, phase D) ────────────────────
// Scene one of the office: before ANY question, the learner does the
// core loop once — card, flip, honest rating. The pieces are the REAL
// study components fed one literal card (the tour precedent,
// OnboardingFlow.jsx:13): the production Flashcard and the production
// six-quality RatingBar, sounds and keyboard shortcuts included, so
// the first thing this app teaches is exactly the thing it is.
//
// Any rating completes the scene — もう一度 included: the rating is
// honesty, not a score, and the won-copy says so. Completion lives in
// the FLOW (`rated`), not here, so backing out and returning shows
// the finished state instead of replaying the demo; the flip state is
// deliberately local and resets with the step swap.
//
// No gating beyond appearance: Continue shows up once rated, and the
// "I know SRS" link is the standing exit for people who don't need
// the demo (the office-wide skip footer stays available besides).

const RIDE_CARD = { char: '駅', reading: 'えき', meaning: 'station' }

export default function FirstRide({ t, lang, volumes, rated, onRated, onNext, onSkipDemo }) {
  const [revealed, setRevealed] = useState(false)

  // The tease: everything else rides the same rail. Volumes arrive in
  // parallel with the flow (see OnboardingFlow's fetch) — before they
  // do, the sentence simply ends without the number.
  const rest = volumes ? journeyItems(volumes, 'N5', 'N1') - 1 : null

  return (
    <section className="onb-step">
      <span className="onb-pa" lang="ja">ご乗車ありがとうございます</span>
      <h2 className="onb-step__title" tabIndex={-1}>{t.onbRideTitle}</h2>
      <p className="onb-step__body">{t.onbRideBody}</p>

      <div className="onb-ride">
        <div className="onb-ride__card">
          <Flashcard
            t={t}
            resetKey="onb-first-ride"
            front={<CharDisplay char={RIDE_CARD.char} size={64} />}
            back={
              <span className="onb-ride__back">
                <span className="onb-ride__reading" lang="ja">{RIDE_CARD.reading}</span>
                <MeaningDisplay meaning={RIDE_CARD.meaning} size={22} />
              </span>
            }
            onReveal={() => setRevealed(true)}
          />
        </div>

        {!rated && <RatingBar active={revealed} onRate={onRated} />}

        {rated && (
          <div className="onb-ride__won">
            <span className="onb-ride__won-stamp" lang="ja" aria-hidden="true">試</span>
            <span>
              <strong>{t.onbRideWon}</strong>
              {rest != null && <> {t.onbRideWonCount(rest.toLocaleString(lang === 'fr' ? 'fr-FR' : 'en'))}</>}
            </span>
          </div>
        )}
      </div>

      <div className="onb-step__actions">
        {!rated && (
          <button type="button" className="onb-link onb-ride__skip" onClick={onSkipDemo}>
            {t.onbRideSkip}
          </button>
        )}
        {rated && (
          <button type="button" className="onb-action" onClick={onNext}>{t.onbContinue}</button>
        )}
      </div>
    </section>
  )
}
