import { useNavigate } from 'react-router-dom'
import { useLang } from '../../LangContext'
import { Bar, Leave } from '../chrome/Bar'
import { GearIcon } from '../ui/Icons'

// ── A settings page (canvas Settings*, plan 074) ──────────────
// The bar — the page's name and ‹ Settings — over the slips. It is the
// same header the list wears, gear roundel and all, because a page is
// not a second place: you are still in 設定. `back` names where ‹ goes
// when a page is reached from somewhere other than the list (the
// status sheet lands on Destination).
export function SettingsPage({ title, children, back = '/profile/settings', backLabel = null }) {
  const { t } = useLang()
  const navigate = useNavigate()
  return (
    <main id="main-content" className="settings">
      <Bar
        code={<GearIcon size={14} />}
        title={title}
        color="var(--pass-ink)"
        aside={<Leave onClick={() => navigate(back)}>{backLabel ?? t.settings}</Leave>}
      />
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
