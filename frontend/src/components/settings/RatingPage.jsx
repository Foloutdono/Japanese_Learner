import { useState } from 'react'
import { useLang } from '../../LangContext'
import { playClick } from '../../lib/audio'
import { useRatingScale, setRatingScale } from '../../stores/ratingScale'
import { RATING_SCALES, ratingButtons } from '../../domain/ratingScales'
import RatingBar from '../study/RatingBar'
import { SettingsPage, Slip } from './SettingsPage'
import { useDesk } from '../../hooks/useDesk'
import { useRadioWalk, radioTab } from '../../hooks/useRadioWalk'

// 二段 / 四段 / 六段 — the three bars, shortest first, so the page reads
// as one range from the fewest judgements to the most.
const RATING_SCALE_IDS = ['binary', 'simple', 'full']

// ── Which rating bar to grade with (plan 139) ───────────────────
// Two, four or six buttons, each offered as the bar itself (RatingBar's
// specimen): the words in the bar's own order and inks, the best one in
// gold, so the choice is between three instruments rather than three
// captions. Every bar sends the same 0..5 quality (see
// domain/ratingScales.js), so this is a choice about the control, not
// about the scheduling. It was a slip of the Learning page until that
// page was split along the pass's fields; it is not on the pass, being
// about the control rather than the journey.
export function RatingPage({ session }) {
  const { t } = useLang()
  const current = useRatingScale()
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
    setRatingScale(id, session)
      .catch(() => setFailed(true))
      .finally(() => setSaving(false))
  }

  // Worst-first, the way the bar draws them (ratingButtons is
  // best-first for the keyboard's sake — see RatingBar.jsx). The
  // specimen is hidden from a screen reader; the radio says its words.
  const words = id => ratingButtons(id, t).map(b => b.label).reverse().join(' · ')

  return (
    <SettingsPage title={t.settingsRatingScale}>
      <Slip>
        <div className="grades" role="radiogroup" aria-label={t.settingsRatingScale} onKeyDown={onWalk}>
          {RATING_SCALE_IDS.map((id, i) => (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={current === id}
              aria-label={`${t.settingsRatingScaleOption[id]}, ${words(id)}`}
              tabIndex={radioTab(desk, i, RATING_SCALE_IDS.indexOf(current))}
              disabled={saving}
              className={`grade${current === id ? ' grade--on' : ''}`}
              data-scale={id}
              onClick={() => choose(id)}
            >
              <span className="grade__name">{t.settingsRatingScaleOption[id] ?? RATING_SCALES[id].qualities.length}</span>
              <RatingBar specimen scale={id} active={false} onRate={() => {}} />
            </button>
          ))}
        </div>
        {failed && <span className="hint" role="alert">{t.onbPassError}</span>}
      </Slip>
    </SettingsPage>
  )
}
