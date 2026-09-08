import { Link, useLocation } from 'react-router-dom'
import { useLang } from '../../LangContext'
import { getTabs, tabFor } from '../../config/tabs'
import { useTodaySummary } from '../../stores/today'
import { playClick } from '../../lib/audio'
import { GateIcon } from './GateIcon'

// ── 改札口 — the tab bar (plan 068) ───────────────────────────
// Five gates on the bottom edge: Learn · Practice · Today ·
// Dictionary · Profile. A pictogram each (components/chrome/
// GateIcon.jsx), and the word only under the gate you are on, which
// takes the width it needs for it. The active gate is full ink with a
// 2px rule over it; the rest are the soft panel ink. The due count
// rides Today, on the shoulder of its glyph.
//
// It carried a kanji where the pictogram is now, with the word under
// every gate. Five gates are 78px on a 390px phone; "DICTIONNAIRE" is
// 94 and "AUJOURD'HUI" 87, so in French two captions printed straight
// over their neighbours. Nothing about the type could fix that —
// tracking out, the widest word is still 4px too long — so the row of
// words went, and with it the only place the chrome spoke Japanese.
// Owner's call, this session, from a rendered comparison of six.
//
// Every gate keeps its word as its accessible name, so the bar reads
// the same to a screen reader as it did with the captions printed.
//
// Links, not buttons: a gate is a place, and a link is what a place
// gets (a long-press, a middle-click, a screen reader's "link").

// A three-figure count is wider than the gate it sits on, and the
// difference between 239 and 312 due is not a difference anyone acts
// on: past a hundred the number is "a lot".
const DUE_CAP = 99

// The gate you are on is drawn bigger. Full ink, a ground, a rule and
// the word already say which one it is; the size is the one that says
// it across the room. The lozenge behind it (.tab__ico) is the same
// height on every gate, so the glyph grows about its own centre and
// the row does not move to make space for it. Here rather than in the
// sheet because a glyph's size is the icon's own prop — and because a
// `.tab--on .tab__ico svg` rule outranks every later `.x svg` in
// index.css, which guard 1 reads as the cascade going backwards.
const GLYPH = 21
const GLYPH_ON = 25

export function TabBar() {
  const { t } = useLang()
  const { pathname } = useLocation()
  const active = tabFor(pathname)
  const due = useTodaySummary().data?.total ?? 0

  return (
    <nav className="tabbar" aria-label={t.tabBarLabel}>
      <div className="tabbar__inner">
        {getTabs(t).map(tab => {
          const on = tab.id === active
          const badge = tab.id === 'today' && due > 0
          return (
            <Link
              key={tab.id}
              to={tab.path}
              data-tab={tab.id}
              className={`tab${on ? ' tab--on' : ''}${badge ? ' tab--badged' : ''}`}
              aria-current={on ? 'page' : undefined}
              aria-label={badge ? `${tab.label} — ${t.todayDue(due)}` : tab.label}
              onClick={() => playClick()}
            >
              <span className="tab__ico"><GateIcon id={tab.id} size={on ? GLYPH_ON : GLYPH} /></span>
              {badge && (
                <span className="tab__due" aria-hidden="true">
                  {due > DUE_CAP ? `${DUE_CAP}+` : due}
                </span>
              )}
              {on && <span className="tab__cap" aria-hidden="true">{tab.label}</span>}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
