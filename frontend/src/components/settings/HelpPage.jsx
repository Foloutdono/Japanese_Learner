import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLang } from '../../LangContext'
import { apiJson } from '../../lib/api'
import { playClick } from '../../lib/audio'
import { forgetGuidedHere } from '../../hooks/useGuide'
import { forgetShown } from '../../stores/guide'
import { refreshSummary } from '../../stores/profileSummary'
import { SettingsPage, Slip } from './SettingsPage'

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
          {/* 入門 (plan 170): the six screens before the cards, for
              anyone who wants the map of the language again. */}
          <button
            type="button"
            className="btn-secondary"
            data-action="intro-again"
            onClick={() => { playClick(); navigate('/ride/intro') }}
          >
            {t.settingsIntroAgain}
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
    </SettingsPage>
  )
}
