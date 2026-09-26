import { useNavigate } from 'react-router-dom'
import { playClick } from '../../lib/audio'
import { SplitRow } from '../selection/SplitRow'

// ── A door in Settings' column (plan 139) ──────────────────────
// The pass's fields and the rows under it each open a page. On the desk
// (`current` is the page open beside the column) a door is a link that
// replaces that page (plan 123), the open one marked and the column's
// one tab stop; on a phone it is the button it always was, pushing the
// page, so Back from a page is the column.
export function SettingsDoor({ page, current = null, className, onClassName, children, ...rest }) {
  const navigate = useNavigate()
  const desk = current != null
  const on = page === current
  return (
    <SplitRow
      to={desk ? `/profile/settings/${page}` : undefined}
      className={`stg-door ${className}${on ? ` ${onClassName}` : ''}`}
      data-page={page}
      aria-current={on ? 'page' : undefined}
      tabIndex={desk ? (on ? 0 : -1) : undefined}
      onClick={() => { playClick(); if (!desk) navigate(`/profile/settings/${page}`) }}
      {...rest}
    >
      {children}
    </SplitRow>
  )
}
