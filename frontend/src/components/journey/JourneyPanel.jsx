import { useMemo, useState } from 'react'
import { useLang } from '../../LangContext'
import { useJourneyStatus, useVolumes } from '../../stores/journey'
import { useProfileSummary } from '../../stores/profileSummary'
import { journeyModel } from '../../domain/goalMath'
import { JourneyBody } from './JourneyBody'

// ── 机 — the pass's back, standing beside the fare gate (plan 114) ──
// On a phone the question "am I on course?" is a tap away, on the HUD's
// station panel (StatusSheet). On the desk there is room to answer it
// where the day's work is chosen: beside the fare gate on Today, the
// same body the sheet draws (JourneyBody), always open. The verdict's
// word heads it — the sheet leaves it to the state's ink because the
// panel it opened from already printed it; here nothing above does.
//
// Mounted only on the desk, so the journey and volume fetches it makes
// are the desk's. No contract (never onboarded) or no status yet: no
// panel — the fare gate stands alone, as it does on a phone.
export function JourneyPanel({ session }) {
  const { t } = useLang()
  const { data: status } = useJourneyStatus()
  const { data: volumes } = useVolumes()
  const summary = useProfileSummary()
  // The moment the panel opened, as the sheet takes the moment it did:
  // one clock for the model and the drawing.
  const [now] = useState(() => Date.now())
  const model = useMemo(() => (status ? journeyModel(status, new Date(now)) : null), [status, now])

  if (!model || model.status == null) return null

  return (
    <section
      className={`desk-journey jour-st--${model.status}`}
      aria-labelledby="desk-journey-head"
      // The rail's status chip walks here on Today (Hud's showStatus).
      tabIndex={-1}
      onAnimationEnd={e => { if (e.animationName === 'arrive-soft') e.currentTarget.classList.remove('desk-journey--called') }}
    >
      <h2 className="desk-journey__head" id="desk-journey-head">
        <span className="desk-journey__name">{t.hudStatusLabel}</span>
        <span className="desk-journey__word">{t.jourStatus[model.status]}</span>
      </h2>
      <JourneyBody
        status={status}
        model={model}
        now={new Date(now)}
        volumes={volumes}
        summary={summary}
        session={session}
        resume={false}
      />
    </section>
  )
}
