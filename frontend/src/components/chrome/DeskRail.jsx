import { useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useLang } from '../../LangContext'
import { getDeskTabs, getDeskSections, inSection, tabFor, dueBadge } from '../../config/tabs'
import { useTodaySummary } from '../../stores/today'
import { playClick } from '../../lib/audio'
import { GateIcon } from './GateIcon'
import { DeskPass } from './DeskPass'
import { dialogOpen } from '../../lib/dialogOpen'

// ── 机 — the rail: the desk's chrome (plan 113) ────────────────────
// At 1100px and up (hooks/useDesk.js) the Shell draws this instead of
// the HUD and the tab bar: one sumi column down the left edge, which is
// both of them at once. From the top:
//
//   the masthead   辻 over TSUJI — the origin station's plate (辻駅),
//                  the app's name where a computer expects one;
//   the gates      the same five as the tab bar, in the rail's own order
//                  (config/tabs' DESK_TAB_IDS, Today first), each a
//                  pictogram AND its word: the phone captions only the
//                  lit gate because five words do not fit in 390px
//                  (DESIGN.md, "A gate is a pictogram"), and a column
//                  has the room for all five;
//   the stations   under the lit gate, the sections behind it on a
//                  drawn line — a stop per station, the one you are
//                  standing in filled. The line is the station
//                  metaphor's own drawing, in the panel's inks: the rail
//                  is chrome, and a section's pigment never goes on
//                  chrome;
//   the foot       the learner's pass (DeskPass, plan 127): the HUD's
//                  three instruments as one card — the level and its
//                  climb (the fare is paid into it), the balance, the
//                  journey's status on its stub — reading the HUD's
//                  stores, opening its doors and carrying its guide
//                  anchors. The phone's HUD keeps the three apart.
//
// The gates' <nav> keeps the tab bar's label and its guide anchor
// (`tabbar`), so the Today guide's last stop finds the navigation on
// either chrome. A run leaves this chrome exactly as it leaves the
// phone's: the StageFrame draws neither.
//
// "/" is the dictionary's search from anywhere the rail is (plan 114):
// the dictionary screen already answers it on its own page, and the
// rail carries it there from every other one, asking the field for
// focus on arrival. Never while typing, never under a dialog, and never
// on a run — a run has no rail, so a slash cannot walk out of one. The
// Dictionary gate prints the key.

// The same glyph size as an unlit gate on the tab bar: in a list, the
// lit gate is said by its ground and its rule, not by a glyph that grows.
const GLYPH = 21

export function DeskRail() {
  const { t } = useLang()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const active = tabFor(pathname)
  const due = useTodaySummary().data?.total ?? 0

  useEffect(() => {
    function onKey(e) {
      if (e.key !== '/' || e.defaultPrevented || e.repeat || e.metaKey || e.ctrlKey || e.altKey) return
      const el = e.target
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(el?.tagName) || el?.isContentEditable) return
      if (pathname === '/dictionary' || dialogOpen()) return
      e.preventDefault()
      navigate('/dictionary', { state: { focusSearch: true } })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [pathname, navigate])

  return (
    <header className="desk-rail">
      <div className="desk-rail__mast">
        <span className="desk-rail__glyph" lang="ja">{t.appTitle}</span>
        <span className="desk-rail__name">{t.brdAppName}</span>
      </div>

      <nav className="desk-rail__gates" aria-label={t.tabBarLabel} data-guide="tabbar">
        <ul className="desk-rail__list">
          {getDeskTabs(t).map(tab => {
            const on = tab.id === active
            const badge = tab.id === 'today' && due > 0
            const stations = on ? getDeskSections(tab.id, t) : []
            // The deepest station the path stands in: the library is
            // behind 教材's path, and lights its own row (plan 132).
            const here = stations
              .filter(s => inSection(pathname, s.path))
              .sort((a, b) => b.path.length - a.path.length)[0]
            return (
              <li key={tab.id} className="desk-rail__item">
                <Link
                  to={tab.path}
                  data-tab={tab.id}
                  className={`desk-gate${on ? ' desk-gate--on' : ''}`}
                  // The gate is the page when you stand on it; behind it,
                  // the station below is the page and the gate is where
                  // it is.
                  aria-current={on ? (here ? 'true' : 'page') : undefined}
                  aria-label={badge ? `${tab.label} — ${t.todayDue(due)}` : undefined}
                  aria-keyshortcuts={tab.id === 'dictionary' ? '/' : undefined}
                  onClick={() => playClick()}
                >
                  <span className="desk-gate__ico"><GateIcon id={tab.id} size={GLYPH} /></span>
                  <span className="desk-gate__label">{tab.label}</span>
                  {badge && <span className="desk-gate__due" aria-hidden="true">{dueBadge(due)}</span>}
                  {tab.id === 'dictionary' && <kbd className="desk-kbd desk-gate__key" aria-hidden="true">/</kbd>}
                </Link>
                {stations.length > 0 && (
                  <ul className="desk-rail__stations">
                    {stations.map(s => {
                      const lit = s === here
                      return (
                        <li key={s.path}>
                          <Link
                            to={s.path}
                            className={`desk-sec${lit ? ' desk-sec--on' : ''}`}
                            aria-current={lit ? 'page' : undefined}
                            data-guide={s.guide}
                            onClick={() => playClick()}
                          >
                            {s.title}
                          </Link>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </li>
            )
          })}
        </ul>
      </nav>

      <div className="desk-rail__foot">
        <DeskPass />
      </div>
    </header>
  )
}
