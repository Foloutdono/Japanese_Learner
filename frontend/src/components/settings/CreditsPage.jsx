import { useLang } from '../../LangContext'
import { isNative, openExternal } from '../../lib/platform'
import { ATTRIBUTIONS } from '../../domain/attributions'
import { SettingsPage } from './SettingsPage'

// ── Credits ───────────────────────────────────────────────
// One row per source the app is built on: the name, what it provides,
// its licence, and the row itself is the way to it. The list's own
// furniture (.stg-list / .stg-row), so a credit reads like a setting
// and not like a page of legal prose — the prose lives in
// THIRD_PARTY_NOTICES.md. In the shell a link opens in the system
// browser (plan 076): the WebView would have no way back.
export function CreditsPage() {
  const { t } = useLang()
  return (
    <SettingsPage title={t.settingsCredits}>
      <div className="stg-list">
        {ATTRIBUTIONS.map(a => (
          <a
            key={a.id}
            className="stg-row stg-row--link"
            href={a.url}
            target="_blank"
            rel="noreferrer"
            onClick={e => { if (isNative()) { e.preventDefault(); openExternal(a.url) } }}
          >
            <span className="stg-row__names">
              <span className="stg-row__jp">{a.name}</span>
              <span className="stg-row__sub">{t.creditsWhat[a.what]}{a.by ? ` · ${a.by}` : ''}</span>
            </span>
            <span className="stg-row__value">{a.license}</span>
            <span className="stg-row__ext" aria-hidden="true">↗</span>
          </a>
        ))}
      </div>
    </SettingsPage>
  )
}
