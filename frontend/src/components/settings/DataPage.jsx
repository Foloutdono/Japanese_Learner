import { useState } from 'react'
import { useLang } from '../../LangContext'
import { supabase } from '../../lib/supabase'
import { apiFetch, apiJson } from '../../lib/api'
import { playClick } from '../../lib/audio'
import { refreshSummary } from '../../stores/profileSummary'
import { SettingsPage, Slip } from './SettingsPage'

// ── Data — the learner's data, theirs to take or erase ────────
// Export streams GET /api/profile/export (one CSV row per card and
// mode, the scheduler's own granularity). Reset fronts DELETE
// /api/stats/reset behind a two-step confirm, with the consequences
// spelled out beside it, because a settings page must say exactly
// what a button does. The account, erased (plan 066): DELETE
// /api/account removes every row and then the sign-in; on success
// this device's session is signed out locally, because a server-side
// sign-out would be for a user that no longer exists.
export function DataPage({ session }) {
  const { t } = useLang()
  const [exporting, setExporting] = useState(false)
  const [exportFailed, setExportFailed] = useState(false)
  const [arming, setArming] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [resetState, setResetState] = useState(null) // 'done' | 'failed' | null
  const [armingDelete, setArmingDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteFailed, setDeleteFailed] = useState(false)

  async function exportCsv() {
    setExporting(true)
    setExportFailed(false)
    try {
      const r = await apiFetch('/api/profile/export', session)
      if (!r.ok) throw new Error(String(r.status))
      const blob = await r.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'nihongo-progress.csv'
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      setExportFailed(true)
    } finally {
      setExporting(false)
    }
  }

  function reset() {
    setResetting(true)
    setResetState(null)
    apiJson('/api/stats/reset', session, { method: 'DELETE' })
      .then(() => { setResetState('done'); refreshSummary() })
      .catch(() => setResetState('failed'))
      .finally(() => { setResetting(false); setArming(false) })
  }

  async function deleteAccount() {
    setDeleting(true)
    setDeleteFailed(false)
    try {
      await apiJson('/api/account', session, { method: 'DELETE' })
      await supabase.auth.signOut({ scope: 'local' })
    } catch {
      setDeleteFailed(true)
      setDeleting(false)
      setArmingDelete(false)
    }
  }

  return (
    <SettingsPage title={t.settingsData}>
      <Slip label={t.settingsExport}>
        <span className="slip__hint">{t.settingsExportHint}</span>
        <button type="button" className="btn-secondary slip__act" disabled={exporting} onClick={() => { playClick(); exportCsv() }}>
          {exporting ? '…' : t.settingsExportBtn}
        </button>
        {exportFailed && <span className="hint" role="alert">{t.onbPassError}</span>}
      </Slip>

      <Slip label={t.settingsReset}>
        <span className="slip__hint">{t.settingsResetHint}</span>
        {!arming && (
          <button type="button" className="btn-secondary btn-secondary--danger slip__act" data-action="reset" onClick={() => { playClick(); setArming(true) }}>
            {t.settingsResetBtn}
          </button>
        )}
        {arming && (
          <div className="slip__confirm">
            <span className="hint" role="alert">{t.settingsResetConfirmQ}</span>
            <div className="form__row">
              <button type="button" className="btn-secondary btn-secondary--danger" data-action="reset-confirm" disabled={resetting} onClick={reset}>
                {resetting ? '…' : t.settingsResetYes}
              </button>
              <button type="button" className="btn-secondary" disabled={resetting} onClick={() => setArming(false)}>
                {t.cancel}
              </button>
            </div>
          </div>
        )}
        {resetState === 'done' && <span className="hint" role="status">{t.settingsResetDone}</span>}
        {resetState === 'failed' && <span className="hint" role="alert">{t.onbPassError}</span>}
      </Slip>

      <Slip label={t.settingsDeleteAccount}>
        <span className="slip__hint">{t.settingsDeleteAccountHint}</span>
        {!armingDelete && (
          <button type="button" className="btn-secondary btn-secondary--danger slip__act" data-action="delete-account" onClick={() => { playClick(); setArmingDelete(true) }}>
            {t.settingsDeleteAccountBtn}
          </button>
        )}
        {armingDelete && (
          <div className="slip__confirm">
            <span className="hint" role="alert">{t.settingsDeleteAccountConfirmQ}</span>
            <div className="form__row">
              <button type="button" className="btn-secondary btn-secondary--danger" data-action="delete-account-confirm" disabled={deleting} onClick={deleteAccount}>
                {deleting ? '…' : t.settingsDeleteAccountYes}
              </button>
              <button type="button" className="btn-secondary" disabled={deleting} onClick={() => setArmingDelete(false)}>
                {t.cancel}
              </button>
            </div>
          </div>
        )}
        {deleteFailed && <span className="hint" role="alert">{t.settingsDeleteAccountFailed}</span>}
      </Slip>
    </SettingsPage>
  )
}
