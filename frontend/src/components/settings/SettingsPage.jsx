import { useContext } from 'react'
import { useLang } from '../../LangContext'
import { Bar, Leave } from '../chrome/Bar'
import { GearIcon } from '../ui/Icons'
import { SettingsPaneContext } from './pane'
import { useBoxWidth } from '../../hooks/useBoxWidth'

// A row's two slips need room for two at a phone's content width (plan
// 139): measured on the pane, not set at a window width, since the
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
// label's right (You are here, New items a day, Optional). `across` is
// a slip of one action that stands the page's width on the desk (plan
// 145): its words on the left and its action on the right, at the width
// of the actions in the column beside it, rather than a button ~700px
// wide for one word.
export function Slip({ label = null, cap = null, children, className = '', across = false }) {
  return (
    <div className={`slip${across ? ' slip--across' : ''}${className ? ` ${className}` : ''}`}>
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

// A row of slips (plan 145; two columns of them since plan 139). A
// phone stacks them; a desk page wide enough for two stands a row's
// slips side by side at the height of the taller, so a page is read as
// a grid of cards that ends level, not two columns that stop wherever
// their last card does. A row holding one slip takes the page's width.
// The page pairs what belongs together (the address and the sign-out,
// the two erasures), which two free columns could not.
export function SlipRow({ children }) {
  return <div className="stg-pair">{children}</div>
}
