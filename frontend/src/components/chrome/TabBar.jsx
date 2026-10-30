import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useLang } from '../../LangContext'
import { getTabs, tabFor, dueBadge } from '../../config/tabs'
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

// The due count is capped at 99+ (config/tabs.js's dueBadge, shared
// with the desk's rail so both chromes print the same figure).

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

// 予熱 (plan 291): the gate tapped is lit at once, and the next screen
// drawn a frame after it. The router draws a screen as a transition,
// but the browser paints nothing until it is committed: the bar kept
// the old gate lit for as long as the next screen took (most of a
// second, from Today on a phone), and a tap looked unheard. A click
// that opens elsewhere (a modifier, another button) is the link's own.
const plainClick = e => e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey

export function TabBar({ away = false, arrive = false }) {
  const { t } = useLang()
  const location = useLocation()
  const navigate = useNavigate()
  const { pathname } = location
  // The gate tapped, and the place it was tapped from: it lights only
  // until the router has moved (a Back to that place is a new location).
  const [going, setGoing] = useState(null)
  const pending = going?.from === location ? going.id : null
  const here = tabFor(pathname)
  const active = pending ?? here
  // The move a frame away, which a later tap takes back.
  const leaving = useRef(null)
  const stay = () => {
    if (!leaving.current) return
    cancelAnimationFrame(leaving.current.frame)
    clearTimeout(leaving.current.timer)
    leaving.current = null
  }
  useEffect(() => stay, [])
  const due = useTodaySummary().data?.total ?? 0

  return (
    <nav className={away ? 'tabbar tabbar--away' : arrive ? 'tabbar tabbar--arrive' : 'tabbar'} aria-label={t.tabBarLabel} data-guide="tabbar">
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
              onClick={e => {
                playClick()
                if (!plainClick(e)) return
                // The gate already on its way: nothing more.
                if (tab.id === pending) {
                  e.preventDefault()
                  return
                }
                stay()
                // The gate you are at is the link's own (to its root).
                if (tab.id === here) {
                  setGoing(null)
                  return
                }
                e.preventDefault()
                setGoing({ id: tab.id, from: location })
                const move = { frame: 0, timer: 0 }
                move.frame = requestAnimationFrame(() => {
                  move.timer = setTimeout(() => {
                    leaving.current = null
                    navigate(tab.path)
                  })
                })
                leaving.current = move
              }}
            >
              <span className="tab__ico"><GateIcon id={tab.id} size={on ? GLYPH_ON : GLYPH} /></span>
              {badge && (
                <span className="tab__due" aria-hidden="true">
                  {dueBadge(due)}
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
