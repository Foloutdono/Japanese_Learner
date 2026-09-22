import { Link, useLocation } from 'react-router-dom'
import { useLang } from '../../LangContext'
import { getDeskTabs, getDeskSections, inSection, tabFor, dueBadge } from '../../config/tabs'
import { useTodaySummary } from '../../stores/today'
import { playClick } from '../../lib/audio'
import { GateIcon } from './GateIcon'
import { HudInstruments } from './Hud'

// ── 机 — the rail: the desk's chrome (plan 112) ────────────────────
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
//   the foot       the HUD's three instruments — the level (the fare is
//                  paid into it), the status panel, the pass — the same
//                  components the HUD draws (Hud.jsx's HudInstruments),
//                  so they carry the same guide anchors.
//
// The gates' <nav> keeps the tab bar's label and its guide anchor
// (`tabbar`), so the Today guide's last stop finds the navigation on
// either chrome. A run leaves this chrome exactly as it leaves the
// phone's: the StageFrame draws neither.

// The same glyph size as an unlit gate on the tab bar: in a list, the
// lit gate is said by its ground and its rule, not by a glyph that grows.
const GLYPH = 21

export function DeskRail() {
  const { t } = useLang()
  const { pathname } = useLocation()
  const active = tabFor(pathname)
  const due = useTodaySummary().data?.total ?? 0

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
            const here = stations.find(s => inSection(pathname, s.path))
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
                  onClick={() => playClick()}
                >
                  <span className="desk-gate__ico"><GateIcon id={tab.id} size={GLYPH} /></span>
                  <span className="desk-gate__label">{tab.label}</span>
                  {badge && <span className="desk-gate__due" aria-hidden="true">{dueBadge(due)}</span>}
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
        <HudInstruments />
      </div>
    </header>
  )
}
