import { useContext } from 'react'
import { useLang } from '../../LangContext'
import { Bar, Leave } from '../chrome/Bar'
import { GearIcon } from '../ui/Icons'
import { SettingsPaneContext } from './pane'
import { useBoxWidth } from '../../hooks/useBoxWidth'

// Two columns of slips need room for two at a phone's content width
// (plan 139): measured on the pane, not set at a window width, since the
// column beside it takes what the window leaves.
const TWO_COLUMNS = 620

// ── A settings page (canvas Settings*, plan 074) ──────────────
// The bar — the page's name and ‹ Settings — over the slips. It is the
// same header the list wears, gear roundel and all, because a page is
// not a second place: you are still in 設定. `back` names where ‹ goes
// when a page is reached from somewhere other than the list (the
// status sheet lands on Destination).
//
// On the desk (plan 113) the page opens in a pane beside the column.
// It prints no title there (plan 139, the owner's call): the door that
// opened it is lit in the column beside it — the pass's field or the
// list's row — so a heading over the page named it a second time. The
// name stays as the pane's <h2>, clipped, for a screen reader; the
// column's own <h1> is clipped the same way.
export function SettingsPage({ title, children, back = '/profile/settings', backLabel = null }) {
  const { t } = useLang()
  const inPane = useContext(SettingsPaneContext)
  const [paneRef, paneWidth] = useBoxWidth(inPane)
  if (inPane) {
    return (
      <section ref={paneRef} className={`desk-settings__page${paneWidth >= TWO_COLUMNS ? ' desk-settings__page--two' : ''}`} aria-label={title}>
        <h2 className="sr-only">{title}</h2>
        {children}
      </section>
    )
  }
  return (
    <main id="main-content" className="settings">
      <Bar
        code={<GearIcon size={14} />}
        title={title}
        color="var(--pass-ink)"
        aside={<Leave to={back}>{backLabel ?? t.settings}</Leave>}
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

// Two columns of slips (plan 139). A phone stacks them, first column
// first; a desk page wide enough for two stands them side by side, so
// a page with two halves (the account and its data, the presets and the
// mixer) is read across rather than down a column 640px wide.
export function SlipColumns({ children }) {
  return <div className="stg-cols">{children}</div>
}

export function SlipColumn({ children }) {
  return <div className="stg-col">{children}</div>
}
