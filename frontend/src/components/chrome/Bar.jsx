import { cloneElement, isValidElement } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useLang } from '../../LangContext'
import { sectionFor, stationFor } from '../../config/stations'
import { identityFor } from '../../config/identity'
import { onDeskRail } from '../../config/tabs'
import { useDesk } from '../../hooks/useDesk'
import { playClick } from '../../lib/audio'
import { ChevronIcon } from '../ui/Icons'

// ── The compact header (plan 068) ─────────────────────────────
// One row — roundel, title, sub, aside — and the section's pigment as
// a rule under it. Every station screen opens with one; the `register`
// variant has no roundel and a hairline instead of the pigment, for a
// screen that is not a place on a line at all. The gates themselves
// print no bar since 2026-09-20 (owner's call): the tab bar captions
// the gate you are on, and a head under the HUD naming the same place
// was a second title — each keeps its name as a clipped <h1>. The
// profile never had one; it is the pass. So the variant is left to ScreenBar,
// for a path with no section behind it.
//
// The sign puts the name at one end and its caption at the other, which
// holds while the other end is free. An aside — ‹ Learn, + New deck —
// takes that end, and the caption then sits wedged against the button,
// reading as the button's label rather than as the title's. So a bar
// carrying both stacks: the caption goes back under the name it belongs
// to (.bar__names--stacked), and the aside keeps the end to itself.
//
// `code` is the mark in the roundel — a line code (KN, TG, JS…) for a
// station, or an icon for a place that is not one: 設定 wears the gear
// its door on the profile is drawn with, because a pass and its pages
// have no code to print (config/identity.js). Either way it is the
// same mark at both ends of the tap, which is the point.
//
// `as` picks the title's element. The bar is the screen's <h1> when
// nothing else names the place; a screen with a station plate or a
// pass (DESIGN.md, Structure: one <h1>, the object that names the
// place) passes 'span'.
//
// On the desk (plan 114) the aside's ‹ way out is not a phone's pill
// in the corner. The rail beside the screen already has a door to
// every gate and to the lit gate's stations, so a Leave whose `to` is
// one of those (onDeskRail) is dropped — it would be a second door to
// the place the rail's lit link already opens. Any other Leave (‹
// Themes, ‹ Levels, a way back that is a state rather than a path)
// becomes the way up: a small crumb above the page, where a desk's
// eye looks for "where this sits".
//
// And the desk prints no title (2026-09-26, the owner's call, as plan
// 139 did for Settings' pages): the rail beside the screen lights the
// gate and the station you are on, so the roundel, the name, its
// caption and the pigment rule over the page named the place a second
// time. The name stays as the <h1>, clipped, for a screen reader; what
// is left drawn is the crumb and the aside, and a bar with neither is
// no box at all, so the page starts at its top.
export function Bar({ code, title, sub, aside, color, register = false, as: Title = 'h1', className = '' }) {
  const desk = useDesk()
  const leave = desk && isValidElement(aside) && aside.type === Leave ? aside : null
  const up = leave && !(leave.props.to !== undefined && onDeskRail(leave.props.to)) ? leave : null
  const shown = leave ? null : aside
  if (desk) {
    const name = <Title className="sr-only">{title}</Title>
    if (!up && !shown) return name
    return (
      <div className={['bar', 'bar--desk', className].filter(Boolean).join(' ')} style={color ? { '--line-color': color } : undefined}>
        {up && <DeskCrumb leave={up} />}
        {name}
        {shown && <div className="bar__row"><span className="bar__aside">{shown}</span></div>}
      </div>
    )
  }
  const classes = ['bar', register ? 'bar--register' : '', className].filter(Boolean).join(' ')
  const names = ['bar__names', sub && shown ? 'bar__names--stacked' : ''].filter(Boolean).join(' ')
  return (
    <div className={classes} style={color ? { '--line-color': color } : undefined}>
      {up && <DeskCrumb leave={up} />}
      <div className="bar__row">
        {code && <span className="bar__roundel" aria-hidden="true">{code}</span>}
        <span className={names}>
          <Title className="bar__title">{title}</Title>
          {sub && <span className="bar__sub">{sub}</span>}
        </span>
        {shown && <span className="bar__aside">{shown}</span>}
      </div>
      <div className="bar__stripe" aria-hidden="true" />
    </div>
  )
}

// ── ‹ the way out ──
// The canvas's leave button: a chevron and the name of where it goes
// (‹ Gate, ‹ Decks, ‹ Profile). Shared by the stage head and by a
// nested screen's bar aside. A way out that is a place is given as
// `to`, a path, which also tells the desk's Bar where it leads; one
// that is a state (back to a list the screen holds itself) keeps
// `onClick`.
// ── 机 — the way up, as a crumb (plan 114; its own since plan 115) ──
// A <Leave> drawn over the page it leaves, in the caption register: the
// Bar draws one for its own way out, and a screen whose way out is not
// in a Bar — the analyser's result head, the dictionary's radical
// header — draws one itself, on the desk only.
export function DeskCrumb({ leave }) {
  const lang = useLang()
  return (
    <nav className="desk-crumb" aria-label={lang?.t.deskWayUp}>
      {cloneElement(leave, { className: 'desk-crumb__up' })}
    </nav>
  )
}

// `keys` is the desk's (plan 115): the key that also takes this way
// out (aria-keyshortcuts), when there is one — a run's Esc.
export function Leave({ onClick, to, children, className = '', keys }) {
  if (to !== undefined) return <LeaveTo to={to} className={className} keys={keys}>{children}</LeaveTo>
  return <LeaveButton onClick={onClick} className={className} keys={keys}>{children}</LeaveButton>
}

// A way up to a place is a link on the desk (plan 123): the middle
// click, "open in a new tab" and the URL under the pointer, as every
// other place there. The phone keeps its button.
function LeaveTo({ to, className, keys, children }) {
  const navigate = useNavigate()
  const desk = useDesk()
  if (desk) {
    return (
      <Link to={to} className={`stage__leave ${className}`.trim()} aria-keyshortcuts={keys} onClick={() => playClick()}>
        <ChevronIcon direction="left" size={14} />
        <span>{children}</span>
      </Link>
    )
  }
  return <LeaveButton onClick={() => navigate(to)} className={className} keys={keys}>{children}</LeaveButton>
}

function LeaveButton({ onClick, children, className, keys }) {
  return (
    <button type="button" className={`stage__leave ${className}`.trim()} aria-keyshortcuts={keys} onClick={() => { playClick(); onClick() }}>
      <ChevronIcon direction="left" size={14} />
      <span>{children}</span>
    </button>
  )
}

// ── The transitional bar for the screens the redesign has not reached ──
// Every screen used to mount components/ui/TopBar with { onBack, title,
// tag, actions }. That bar retired with the burger drawer and the
// phone's level strip (plan 068); until plans 070–074 rebuild each
// screen on the Bar above with its own words, this adapter draws the
// same props as the canvas's bar: the station's roundel and pigment
// from the registry, the title, the tag as the sub, the actions and
// the leave button in the aside. A tab root passes no onBack and gets
// no leave button — the gates are the way around.
export function ScreenBar({ onBack, title, tag, actions }) {
  const { t } = useLang()
  const { pathname } = useLocation()
  const identity = identityFor(pathname, t)
  // Resolve the section only to canonicalise a nested path
  // (/learn/decks/<id> -> /learn/decks) before asking for its code.
  const section = identity ? null : sectionFor(pathname, t)
  const station = section ? stationFor(section.path) : null
  return (
    <Bar
      as="span"
      code={station?.code}
      color={section?.color}
      register={!section}
      title={title}
      sub={tag}
      aside={(actions || onBack) ? (
        <>
          {actions}
          {onBack && <Leave onClick={onBack}>{t.back}</Leave>}
        </>
      ) : undefined}
    />
  )
}
