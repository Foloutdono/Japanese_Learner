import { useState } from 'react'
import { apiJson } from '../../lib/api'
import { refreshSummary } from '../../stores/profileSummary'
import { refreshJourney } from '../../stores/journey'
import { track } from '../../lib/track'

// 足跡 (plan 218): which setting changed, to which of the app's own
// values -- a level, or `changed` for the lines and the daily pace,
// whose new value is a set or a number the dashboards do not need.
function trackLearning(patch) {
  if (patch.jlptLevel) track('setting_change', { setting: 'level', value: patch.jlptLevel })
  if (patch.lines) track('setting_change', { setting: 'lines', value: 'changed' })
  if (patch.dailyNewTarget != null) track('setting_change', { setting: 'daily_target', value: 'changed' })
}

// ── One write for the learning profile (plan 139) ───────────────
// The level, the lines and a pace set without a destination all write
// through PATCH /api/profile/learning (which never touches onboarded_at
// — changing your level later is not re-onboarding), then refresh the
// summary and the journey so the HUD, the pass at Settings' head and
// every station's mark learn the new value at once. Three pages share
// it since Learning was split along the pass's fields.
export function useLearningSave(session) {
  const [saving, setSaving] = useState(false)
  const [failed, setFailed] = useState(false)

  function save(patch) {
    trackLearning(patch)
    setSaving(true)
    setFailed(false)
    return apiJson('/api/profile/learning', session, { method: 'PATCH', body: JSON.stringify(patch) })
      .then(() => Promise.all([refreshSummary(), refreshJourney()]))
      .catch(() => setFailed(true))
      .finally(() => setSaving(false))
  }

  return { save, saving, failed, setFailed }
}
