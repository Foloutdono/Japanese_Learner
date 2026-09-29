import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLang } from '../../LangContext'
import { apiJson } from '../../lib/api'
import { playClick } from '../../lib/audio'
import { forgetGuidedHere } from '../../hooks/useGuide'
import { forgetShown } from '../../stores/guide'
import { refreshSummary } from '../../stores/profileSummary'
import { sendFeedback } from '../../stores/rating'
import { SettingsPage, Slip } from './SettingsPage'

// ── 評価 — writing to us (plan 167) ─────────────────────────
// The one way an app learner's opinion reaches us: the stores allow the
// apps nothing but their own review prompt, which carries nothing back
// (routes/rating.py). Any learner, any platform, any time; the field
// empties once the message has gone.
function FeedbackSlip() {
  const { t, lang } = useLang()
  const [text, setText] = useState('')
  const [state, setState] = useState(null) // null | 'busy' | 'sent' | 'failed'

  function submit(e) {
    e.preventDefault()
    if (!text.trim()) return
    playClick()
    setState('busy')
    sendFeedback(text, lang)
      .then(() => { setText(''); setState('sent') })
      .catch(() => setState('failed'))
  }

  return (
    <Slip label={t.feedbackLabel}>
      <form className="stg-feedback" onSubmit={submit}>
        <p className="slip__hint" id="feedback-hint">{t.feedbackHint}</p>
        <textarea
          className="field field--multi"
          aria-label={t.feedbackLabel}
          aria-describedby="feedback-hint"
          value={text}
          maxLength={2000}
          onChange={e => { setText(e.target.value); if (state !== 'busy') setState(null) }}
        />
        <button type="submit" className="btn-secondary slip__act" disabled={!text.trim() || state === 'busy'}>
          {t.feedbackSend}
        </button>
        {state === 'sent' && <span className="slip__hint" role="status">{t.feedbackSent}</span>}
        {state === 'failed' && <span className="slip__hint" role="alert">{t.feedbackFailed}</span>}
      </form>
    </Slip>
  )
}

// ── 試乗 and 案内, again (plan 100; a page of its own since plan 139) ──
// The ride at any time, and the guide on each gate's next opening. Both
// do exactly what they say the moment they are pressed -- no dead
// controls. They were the Learning page's last slip until that page
// was split along the pass's fields.
export function HelpPage({ session }) {
  const { t } = useLang()
  const navigate = useNavigate()
  // 案内, again: the server's map cleared, this device's note and this
  // session's memory with it, and the profile store told to catch up.
  const [guideReset, setGuideReset] = useState(null) // null | 'busy' | 'done'

  function resetGuide() {
    playClick()
    setGuideReset('busy')
    apiJson('/api/onboarding/guided', session, { method: 'DELETE' })
      .then(() => { forgetGuidedHere(); forgetShown(); return refreshSummary() })
      .then(() => setGuideReset('done'))
      .catch(() => setGuideReset(null))
  }

  return (
    <SettingsPage title={t.settingsHelp}>
      <Slip label={t.settingsFirstRide}>
        <div className="form__row">
          <button
            type="button"
            className="btn-secondary"
            data-action="ride-again"
            onClick={() => { playClick(); navigate('/ride/cards') }}
          >
            {t.settingsRideAgain}
          </button>
          <button
            type="button"
            className="btn-secondary"
            data-action="guide-again"
            disabled={guideReset === 'busy'}
            onClick={resetGuide}
          >
            {t.settingsGuideAgain}
          </button>
        </div>
        {guideReset === 'done' && <span className="slip__hint" role="status">{t.settingsGuideAgainDone}</span>}
      </Slip>
      <FeedbackSlip />
    </SettingsPage>
  )
}
