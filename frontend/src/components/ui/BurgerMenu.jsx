import { useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { useLang } from '../../LangContext'
import { useProfileSummary } from '../../stores/profileSummary'
import { levelTitle } from '../../domain/levelTitle'
import { stationFor } from '../../config/stations'
import { PassWave } from '../profile/PassWave'
import { playUi } from '../../lib/audio'
import { CrossIcon, FlameIcon, GearIcon } from './Icons'
import { useDialog } from '../../hooks/useDialog'

// ── 路線図 — the network map ───────────────────────────────
// The nav drawer was a list of icon+label rows on a dark panel: the
// last piece of the app still drawn as generic chrome, sitting one tap
// away from twelve screens that are all station plates.
//
// A drawer of destinations *is* a route map, so it is drawn as one. A
// rail runs down the left edge and every section is a stop on it,
// marked with its own line colour and carrying its 駅ナンバリング code
// — the same three objects the departure board, the station plate and
// the platform cards already use. The stop you are standing at gets a
// filled marker and its name in the line's colour, which is how a real
// map says 現在地.
//
// The rail changes colour at each station rather than running one
// tint the whole way down: eleven pigments stacked flush read as the
// line legend on a Tokyo Metro map, and it means the drawer answers
// "which line was 文法 again?" without being asked.
//
// The map ends where the line ends. Below it is the 定期券 — you, in
// your pocket, holding the map. It was drawn as two more stops on the
// rail at first, which was wrong twice over: it put the traveller on
// the route as though you could catch a train to yourself, and it
// made 設定 a destination when preferences are the card's own
// settings. Now it is a card, with the gear as a control printed on
// it. See config/identity.js.

// One stop on the line. Every stop is a section, so it always has a
// station code — the `trailing`/`children` escape hatches this used to
// carry existed only for the pass, which is no longer a stop.
function MapStop({ path, color, glyph, title, active, first, last, onClick }) {
  const station = stationFor(path)

  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={[
        'map-stop',
        active && 'map-stop--active',
        first && 'map-stop--first',
        last && 'map-stop--last',
      ].filter(Boolean).join(' ')}
      style={{ '--line-color': color }}
    >
      <span className="map-stop__rail" aria-hidden="true" />
      <span className="map-stop__dot" aria-hidden="true" />

      <span className="map-stop__body">
        <span className="map-stop__name" lang="ja">{glyph}</span>
        <span className="map-stop__title">{title}</span>
      </span>

      {station.code !== '??' && (
        <span className="map-stop__code" aria-hidden="true">{station.code}</span>
      )}
    </button>
  )
}

// ── 定期券 — the stub ──────────────────────────────────────
// The same card the profile screen draws at full size (see
// components/profile/CommuterPass), reduced to what fits in a pocket:
// the contactless mark, the holder, the rank, the level as a balance,
// and the streak. Tapping it opens the full pass.
//
// The gear is a control *on* the card, not a row beside it, because
// that is what preferences are — sound, theme, language, the account
// the card is issued to. It is a nested <button>, so the card is a
// <div> with its own click handler rather than a <button>, which
// cannot legally contain one.
function PassStub({ go, t, activePath }) {
  const summary = useProfileSummary()

  const gear = (
    <button
      type="button"
      className={`pass-stub__gear${activePath === '/settings' ? ' pass-stub__gear--active' : ''}`}
      onClick={e => { e.stopPropagation(); go('/settings') }}
      aria-label={t.settings}
      title={t.settings}
    >
      <GearIcon size={15} />
    </button>
  )

  // A summary with no username is treated as not loaded. It used to
  // reach summary.username.charAt(0) regardless, and a throw here does
  // not just lose the pass — it unmounts the whole drawer, which is
  // the app's only navigation. The card still draws, blank, so the
  // drawer never changes shape while the summary is in flight.
  const loaded = Boolean(summary?.username)

  const [, jpTitle, title] = loaded ? levelTitle(summary.level) : []
  const span = loaded ? Math.max(1, summary.xpForNext - summary.xpPrevLevel) : 1
  const into = loaded ? Math.min(span, Math.max(0, summary.xp - summary.xpPrevLevel)) : 0
  const pct  = Math.round((into / span) * 100)

  return (
    <div
      className={`pass-stub${activePath === '/profile' ? ' pass-stub--active' : ''}`}
      role="button"
      tabIndex={0}
      onClick={() => go('/profile')}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go('/profile') } }}
    >
      <div className="pass-stub__head">
        <span className="pass-stub__brand">
          <PassWave className="pass__wave pass-stub__wave" />
          <span className="pass-stub__brand-names">
            <span className="pass-stub__brand-jp" lang="ja">定期券</span>
            <span className="pass-stub__brand-sub">{t.passLabel}</span>
          </span>
        </span>
        {gear}
      </div>

      <div className="pass-stub__body">
        <span className="pass-stub__holder">
          <span className="pass-stub__name">{loaded ? summary.username : '—'}</span>
          {loaded && <span className="pass-stub__rank" lang="ja">{jpTitle} · {title}</span>}
        </span>
        {loaded && (
          <span className="pass-stub__streak" title={t.streak}>
            <FlameIcon size={13} /> {summary.streak}
          </span>
        )}
      </div>

      {/* The balance strip, exactly as the full card draws it: how far
          into the level you are, not an abstract percentage. */}
      <div className="pass-stub__balance">
        <span className="pass-stub__level">
          <span className="pass-stub__level-label">{t.level}</span>
          <span className="pass-stub__level-num">{loaded ? summary.level : '—'}</span>
        </span>
        <span className="pass-stub__track" aria-hidden="true">
          <span className="pass-stub__fill" style={{ width: `${pct}%` }} />
        </span>
      </div>
    </div>
  )
}

export function BurgerMenu({ links = [], currentPath = null, onOpenChange }) {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  const { t } = useLang()

  const setOpenAndNotify = useCallback((next) => {
    setOpen(next)
    onOpenChange?.(next)
  }, [onOpenChange])

  // Stable so useDialog (see the drawer below) doesn't re-run its
  // focus-on-open effect every render — an inline arrow here would
  // make the drawer steal focus continuously while it's open.
  const close = useCallback(() => {
    playUi('click-close-menu')
    setOpenAndNotify(false)
  }, [setOpenAndNotify])

  // Every stop, the pass and the settings entry all funnel through
  // here — one place to hang the click sound on rather than wiring
  // each destination separately.
  const go = (path) => {
    playUi('click-screen-selection')
    navigate(path)
    close()
  }

  return (
    <>
      {/* 路線図 as a button: three line segments in three of the
          system's own pigments, with an interchange marker on the
          middle one. Still unmistakably a menu — a stack of coloured
          lines is what a metro map's legend looks like. */}
      <button
        onClick={() => { playUi('click-menu'); setOpenAndNotify(!open) }}
        aria-label={t.menu}
        aria-expanded={open}
        className="burger-toggle"
      >
        <span className="burger-toggle__map" aria-hidden="true">
          <span className="burger-toggle__line" />
          <span className="burger-toggle__line" />
          <span className="burger-toggle__line" />
        </span>
      </button>

      {open && (
        <BurgerDrawer
          onClose={close}
          t={t}
          links={links}
          currentPath={currentPath}
          go={go}
        />
      )}
    </>
  )
}

// Split out from BurgerMenu so useDialog — and the Escape/focus-trap
// listener it attaches — only lives while the drawer is actually
// mounted, the same way QuickChange separates its trigger button from
// QuickDrawer.
function BurgerDrawer({ onClose, t, links, currentPath, go }) {
  const dialogRef = useDialog(onClose)

  return createPortal(
    <div className="burger-overlay" onClick={onClose}>
      <div ref={dialogRef} className="burger-drawer" onClick={e => e.stopPropagation()}
           role="dialog" aria-modal="true" aria-label={t.menu}>
        <div className="burger-drawer__header">
          <span className="burger-drawer__heading">
            <span className="burger-drawer__jp" lang="ja">路線図</span>
            <span className="burger-drawer__sub">{t.menu}</span>
          </span>
          <button
            className="burger-drawer__close"
            onClick={onClose}
            aria-label={t.close}
          >
            <CrossIcon size={14} />
          </button>
        </div>

        <nav className="burger-drawer__nav">
          {links.map((link, i) => (
            <MapStop
              key={link.path}
              path={link.path}
              color={link.color}
              glyph={link.icon}
              title={link.title}
              active={currentPath === link.path}
              first={i === 0}
              last={i === links.length - 1}
              onClick={() => go(link.path)}
            />
          ))}
        </nav>

        {/* Pinned below the scrollable run rather than inside it,
            so the pass stays in your pocket however many sections
            the line grows to. */}
        <div className="burger-drawer__pocket">
          <PassStub go={go} t={t} activePath={currentPath} />
        </div>
      </div>
    </div>,
    document.body
  )
}
