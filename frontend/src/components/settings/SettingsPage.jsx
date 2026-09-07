import { useNavigate } from 'react-router-dom'
import { useLang } from '../../LangContext'
import { Leave } from '../chrome/Bar'

// ── A settings page (canvas Settings*, plan 074) ──────────────
// The head row — the page's name and ‹ Settings — over the slips.
// `back` names where ‹ goes when a page is reached from somewhere
// other than the list (the status sheet lands on Destination).
export function SettingsPage({ title, children, back = '/profile/settings', backLabel = null }) {
  const { t } = useLang()
  const navigate = useNavigate()
  return (
    <main id="main-content" className="settings">
      <div className="stg-headrow">
        <div className="stg-head"><h1 className="stg-head__jp">{title}</h1></div>
        <Leave onClick={() => navigate(back)}>{backLabel ?? t.settings}</Leave>
      </div>
      {children}
    </main>
  )
}

// A slip: a labelled block of controls. `cap` is the caption on the
// label's right (You are here, New items a day, Optional).
export function Slip({ label = null, cap = null, children, className = '' }) {
  return (
    <div className={`slip${className ? ` ${className}` : ''}`}>
      {label && (
        <div className="slip__label">
          <b className="slip__name">{label}</b>
          {cap && <span className="cap">{cap}</span>}
        </div>
      )}
      {children}
    </div>
  )
}
