import { Link, useLocation } from 'react-router-dom'
import { useLang } from '../../LangContext'
import { getTabs, tabFor } from '../../config/tabs'
import { useTodaySummary } from '../../stores/today'
import { playClick } from '../../lib/audio'

// ── 改札口 — the tab bar (plan 068) ───────────────────────────
// Five gates on the bottom edge: 学習 Learn · 実践 Practice · 本日
// Today · 辞書 Dictionary · 定期券 Profile. The kanji is the icon and
// the plain word is the label — the one place Japanese stands in for
// a pictogram. The active gate is full ink with a 2px rule over it;
// the rest are the soft panel ink. The due count rides Today as the
// map's own chip, set clear of the glyph.
//
// Links, not buttons: a gate is a place, and a link is what a place
// gets (a long-press, a middle-click, a screen reader's "link").
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
              className={`tab${on ? ' tab--on' : ''}${badge ? ' tab--badged' : ''}`}
              aria-current={on ? 'page' : undefined}
              onClick={() => playClick()}
            >
              <span className="tab__jp" lang="ja" aria-hidden="true">{tab.jp}</span>
              {badge && <span className="tab__due" aria-label={t.todayDue(due)}>{due}</span>}
              <span className="tab__cap">{tab.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
