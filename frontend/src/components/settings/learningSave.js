import { useState } from 'react'
import { apiJson } from '../../lib/api'
import { refreshSummary } from '../../stores/profileSummary'
import { refreshJourney } from '../../stores/journey'

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
    setSaving(true)
    setFailed(false)
    return apiJson('/api/profile/learning', session, { method: 'PATCH', body: JSON.stringify(patch) })
      .then(() => Promise.all([refreshSummary(), refreshJourney()]))
      .catch(() => setFailed(true))
      .finally(() => setSaving(false))
  }

  return { save, saving, failed, setFailed }
}
