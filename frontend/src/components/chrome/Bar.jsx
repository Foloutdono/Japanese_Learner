import { useLocation } from 'react-router-dom'
import { useLang } from '../../LangContext'
import { sectionFor, stationFor } from '../../config/stations'
import { identityFor } from '../../config/identity'
import { playClick } from '../../lib/audio'
import { ChevronIcon } from '../ui/Icons'

// ── The compact header (plan 068) ─────────────────────────────
// One row — roundel, title, sub, aside — and the section's pigment as
// a rule under it. Every tab screen opens with one; the `register`
// variant has no roundel and a hairline instead of the pigment, for a
// screen that is not a place on a line at all. The five gates are not
// that case — each wears a roundel and a colour, the concourse's gold
// where it is not a line's own — so the variant is left to ScreenBar,
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
export function Bar({ code, title, sub, aside, color, register = false, as: Title = 'h1', className = '' }) {
  const classes = ['bar', register ? 'bar--register' : '', className].filter(Boolean).join(' ')
  const names = ['bar__names', sub && aside ? 'bar__names--stacked' : ''].filter(Boolean).join(' ')
  return (
    <div className={classes} style={color ? { '--line-color': color } : undefined}>
      <div className="bar__row">
        {code && <span className="bar__roundel" aria-hidden="true">{code}</span>}
        <span className={names}>
          <Title className="bar__title">{title}</Title>
          {sub && <span className="bar__sub">{sub}</span>}
        </span>
        {aside && <span className="bar__aside">{aside}</span>}
      </div>
      <div className="bar__stripe" aria-hidden="true" />
    </div>
  )
}

// ── ‹ the way out ──
// The canvas's leave button: a chevron and the name of where it goes
// (‹ Gate, ‹ Decks, ‹ Profile). Shared by the stage head and by a
// nested screen's bar aside.
export function Leave({ onClick, children, className = '' }) {
  return (
    <button type="button" className={`stage__leave ${className}`.trim()} onClick={() => { playClick(); onClick() }}>
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
