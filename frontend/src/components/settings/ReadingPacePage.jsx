import { useState } from 'react'
import { useLang } from '../../LangContext'
import { playClick } from '../../lib/audio'
import { useReadingPace, setReadingPace } from '../../stores/readingPace'
import { READING_PACE_IDS, SPECIMEN_SECONDS, LONGEST_FACTOR, paceFactor } from '../../domain/readingPace'
import { ReadingTimer } from '../reading/ReadingPieces'
import { SettingsPage, Slip } from './SettingsPage'
import { useDesk } from '../../hooks/useDesk'
import { useRadioWalk, radioTab } from '../../hooks/useRadioWalk'

// ── How long the reading exercises leave the text up ─────────────
// Four paces, standard to untimed (domain/readingPace.js), each offered
// as the reading run's own clock at that pace (plan 139: a page draws
// what it sets): the hairline a sentence of about a dozen characters
// gets, and its seconds, so the consequence is read before the choice
// is made. For a slow reader, a dyslexic one, anyone the clock is the
// obstacle for; it applies to 読解, 理解 and the first ride.
export function ReadingPacePage({ session }) {
  const { t } = useLang()
  const current = useReadingPace()
  // The desk's walk (plan 123), focus alone: a choice is a save.
  const desk = useDesk()
  const onWalk = useRadioWalk(desk, { check: false })
  const [saving, setSaving] = useState(false)
  const [failed, setFailed] = useState(false)

  function choose(id) {
    if (id === current) return
    playClick()
    setSaving(true)
    setFailed(false)
    setReadingPace(id, session)
      .catch(() => setFailed(true))
      .finally(() => setSaving(false))
  }

  return (
    <SettingsPage title={t.settingsReadingPace}>
      <Slip>
        <span className="slip__hint">{t.settingsReadingPaceHint}</span>
        <div className="paces" role="radiogroup" aria-label={t.settingsReadingPace} onKeyDown={onWalk}>
          {READING_PACE_IDS.map((id, i) => {
            const factor = paceFactor(id)
            return (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={current === id}
                aria-label={`${t.readingPaceOption[id]}, ${t.readingPaceDesc[id]}`}
                tabIndex={radioTab(desk, i, READING_PACE_IDS.indexOf(current))}
                disabled={saving}
                className={`pace${current === id ? ' pace--on' : ''}`}
                data-pace={id}
                onClick={() => choose(id)}
              >
                <span className="pace__head">
                  <span className="pace__name">{t.readingPaceOption[id]}</span>
                  <span className="pace__desc">{t.readingPaceDesc[id]}</span>
                </span>
                <span className="pace__timer" aria-hidden="true">
                  <ReadingTimer
                    timeLeft={SPECIMEN_SECONDS * (factor ?? 0)}
                    total={SPECIMEN_SECONDS * LONGEST_FACTOR}
                    covered={false}
                    untimed={factor == null}
                    t={t}
                  />
                </span>
              </button>
            )
          })}
        </div>
        {failed && <span className="hint" role="alert">{t.onbPassError}</span>}
      </Slip>
    </SettingsPage>
  )
}
