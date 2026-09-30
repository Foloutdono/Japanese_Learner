import { useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useLang } from '../../LangContext'
import { getDeskTabs, getDeskSections, inSection, tabFor, dueBadge } from '../../config/tabs'
import { useTodaySummary } from '../../stores/today'
import { playClick } from '../../lib/audio'
import { GateIcon } from './GateIcon'
import { DeskPass } from './DeskPass'
import { DeskMast } from './DeskMast'
import { dialogOpen } from '../../lib/dialogOpen'
import { askGuide, guideAsked, guideHeld } from '../../stores/guide'
import { GUIDES } from '../guide/guides'

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
//
// Help (the owner's ask, 2026-09-30) stands at the masthead's end, a
// pill of ? and its word: the
// lit gate's guide (components/guide), played again on demand whatever
// its stamp says. On the gate's own screen it opens there; from a
// station behind the gate it walks to the gate first, where the stops
// are, and opens once that screen is ready (hooks/useGuide). "?" is the
// same button from the keyboard, under the "/" key's guards. An ask the
// learner walked away from before it could open is dropped.

// The same glyph size as an unlit gate on the tab bar: in a list, the
// lit gate is said by its ground and its rule, not by a glyph that grows.
const GLYPH = 21

// Help's ?, as Space Grotesk Bold draws it (its outline, cropped to its
// ink): a shape stands in the middle of its roundel at any zoom, where a
// letter's baseline is snapped to the pixel grid and stood a pixel high.
const HELP_Q = 'M175 484V460Q175 409 195.5 376Q216 343 262 321L279 313Q324 292 348 268Q372 244 372 204Q372 175 357.5 154.5Q343 134 317 123Q291 112 256 112Q220 112 191.5 124Q163 136 146.5 160Q130 184 130 220V242H0V222Q0 153 34 103Q68 53 126 26.5Q184 0 256 0Q327 0 382.5 26Q438 52 470 98Q502 144 502 204Q502 264 480 302.5Q458 341 424.5 364.5Q391 388 356 405L339 413Q321 421 314 432.5Q307 444 307 466V484ZM245 728Q205 728 177.5 701.5Q150 675 150 633Q150 591 177.5 564.5Q205 538 245 538Q286 538 313 564.5Q340 591 340 633Q340 675 313 701.5Q286 728 245 728Z'

export function DeskRail() {
  const { t } = useLang()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const active = tabFor(pathname)
  const due = useTodaySummary().data?.total ?? 0
  const tabs = getDeskTabs(t)
  const activeLabel = tabs.find(tab => tab.id === active)?.label ?? ''

  const guided = Boolean(active && GUIDES[active])

  function help() {
    if (!guided || guideHeld()) return
    playClick()
    if (pathname !== `/${active}`) navigate(`/${active}`)
    askGuide(active)
  }

  useEffect(() => {
    const asked = guideAsked()
    if (asked && pathname !== `/${asked}`) askGuide(null)
  }, [pathname])

  useEffect(() => {
    function onKey(e) {
      if ((e.key !== '/' && e.key !== '?') || e.defaultPrevented || e.repeat || e.metaKey || e.ctrlKey || e.altKey) return
      const el = e.target
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(el?.tagName) || el?.isContentEditable) return
      if (dialogOpen()) return
      if (e.key === '?') {
        if (!guided) return
        e.preventDefault()
        help()
        return
      }
      if (pathname === '/dictionary') return
      e.preventDefault()
      navigate('/dictionary', { state: { focusSearch: true } })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  return (
    <header className="desk-rail">
      <div className="desk-rail__head">
        <DeskMast />
        {guided && (
          <button
            type="button"
            className="desk-rail__help"
            data-action="guide"
            aria-label={`${t.guideHelp} — ${t.guideHelpTour(activeLabel)}`}
            title={t.guideHelpTour(activeLabel)}
            aria-keyshortcuts="?"
            onClick={help}
          >
            <span className="desk-rail__help-mark" aria-hidden="true">
              <svg viewBox="0 0 502 728" focusable="false"><path d={HELP_Q} fill="currentColor" /></svg>
            </span>
            <span className="desk-rail__help-label">{t.guideHelp}</span>
          </button>
        )}
      </div>

      <nav className="desk-rail__gates" aria-label={t.tabBarLabel} data-guide="tabbar">
        <ul className="desk-rail__list">
          {tabs.map(tab => {
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
