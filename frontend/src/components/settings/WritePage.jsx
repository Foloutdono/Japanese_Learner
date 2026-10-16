import { useLang } from '../../LangContext'
import { FeedbackForm } from '../feedback/FeedbackSheet'
import { SettingsPage } from './SettingsPage'

// ── Nous écrire, on the desk (plan 221) ─────────────────────────────
// The canvas's desk board: from Settings the form is the page beside
// the list, as every other row's page is, and no dialog. A phone opens
// the same form in a sheet over the list (screens/SettingsScreen.jsx).
export function WritePage({ session }) {
  const { t } = useLang()
  return (
    <SettingsPage title={t.settingsWrite}>
      <div className="fb-page">
        <FeedbackForm session={session} />
      </div>
    </SettingsPage>
  )
}
