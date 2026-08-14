import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { useLang } from '../../LangContext'
import { useProfileSummary } from '../../stores/profileSummary'
import { levelTitle } from '../../domain/levelTitle'
import { stationFor, SYSTEM_STATIONS } from '../../config/stations'
import { playUi } from '../../lib/audio'
import { CrossIcon, FlameIcon } from './Icons'

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
// Two runs, not one. The language sections are the line; 定期券 and
// 設定 are a separate short segment below the gap, because they are
// where you are in the *system* rather than in the language — the
// exact split config/navLinks.js already models with `scope`. The gap
// and the capped rail ends say that on their own, so neither run
// needs a heading.

// One stop. `trailing` replaces the code roundel for stops that have
// something better to put there (the pass shows your streak).
function MapStop({ path, color, glyph, title, active, first, last, onClick, trailing, children, className = '' }) {
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
        className,
      ].filter(Boolean).join(' ')}
      style={{ '--line-color': color }}
    >
      <span className="map-stop__rail" aria-hidden="true" />
      <span className="map-stop__dot" aria-hidden="true" />

      {children ?? (
        <span className="map-stop__body">
          <span className="map-stop__name" lang="ja">{glyph}</span>
          <span className="map-stop__title">{title}</span>
        </span>
      )}

      {trailing ?? (station.code !== '??' && (
        <span className="map-stop__code" aria-hidden="true">{station.code}</span>
      ))}
    </button>
  )
}

// 定期券 — the commuter pass, as a stop on the map. Ring + name + rank
// + streak: a compact reading of the Profile screen rather than a
// plain link, so opening the drawer already tells you where you stand.
// Falls back to a plain station row until the summary loads (or if
// there is no session), same as TopBar's ring and level bar.
function PassStop({ go, active, t, last }) {
  const summary = useProfileSummary()
  const system = SYSTEM_STATIONS(t)['/profile']

  // A summary with no username takes the same path as no summary at
  // all. It used to reach summary.username.charAt(0) regardless, and
  // a throw here does not just lose the pass — it unmounts the whole
  // drawer, which is the app's only navigation.
  if (!summary?.username) {
    return (
      <MapStop
        path="/profile"
        color={system.color}
        glyph={system.icon}
        title={system.title}
        active={active}
        first
        last={last}
        onClick={() => go('/profile')}
      />
    )
  }

  const [, jpTitle, title] = levelTitle(summary.level)
  const span = Math.max(1, summary.xpForNext - summary.xpPrevLevel)
  const into = Math.min(span, Math.max(0, summary.xp - summary.xpPrevLevel))
  const pct  = Math.round((into / span) * 100)

  const r = 15
  const circumference = 2 * Math.PI * r
  const dashoffset = circumference * (1 - pct / 100)

  return (
    <MapStop
      path="/profile"
      color={system.color}
      active={active}
      first
      last={last}
      className="map-stop--pass"
      onClick={() => go('/profile')}
      trailing={
        <span className="map-stop__streak" title={t.streak}>
          <FlameIcon size={13} /> {summary.streak}
        </span>
      }
    >
      <span className="pass-stop__ring-wrap">
        <svg className="pass-stop__ring" viewBox="0 0 36 36" aria-hidden="true">
          <circle className="pass-stop__ring-track" cx="18" cy="18" r={r} />
          <circle
            className="pass-stop__ring-fill"
            cx="18" cy="18" r={r}
            strokeDasharray={circumference}
            strokeDashoffset={dashoffset}
          />
        </svg>
        <span className="pass-stop__avatar">{summary.username.charAt(0).toUpperCase()}</span>
      </span>

      <span className="map-stop__body">
        <span className="map-stop__label" lang="ja">{system.icon}</span>
        <span className="map-stop__name map-stop__name--holder">{summary.username}</span>
        <span className="map-stop__title" lang="ja">{jpTitle} · {title}</span>
      </span>
    </MapStop>
  )
}

export function BurgerMenu({ links = [], currentPath = null, onOpenChange }) {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  const { t } = useLang()

  const setOpenAndNotify = (next) => {
    setOpen(next)
    onOpenChange?.(next)
  }

  const close = () => setOpenAndNotify(false)

  // Escape closes it. The QuickChange drawer already did this and its
  // comment claimed this one did too; it didn't.
  useEffect(() => {
    if (!open) return
    const onKey = e => { if (e.key === 'Escape') { playUi('click-close-menu'); close() } }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // Every stop, the pass and the settings entry all funnel through
  // here — one place to hang the click sound on rather than wiring
  // each destination separately.
  const go = (path) => {
    playUi('click-screen-selection')
    navigate(path)
    close()
  }

  const settings = SYSTEM_STATIONS(t)['/settings']

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

      {open && createPortal(
        <div className="burger-overlay" onClick={() => { playUi('click-close-menu'); close() }}>
          <div className="burger-drawer" onClick={e => e.stopPropagation()}>
            <div className="burger-drawer__header">
              <span className="burger-drawer__heading">
                <span className="burger-drawer__jp" lang="ja">路線図</span>
                <span className="burger-drawer__sub">{t.menu}</span>
              </span>
              <button
                className="burger-drawer__close"
                onClick={() => { playUi('click-close-menu'); close() }}
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

            {/* The system stations. Pinned below the scrollable run
                rather than inside it, so they stay reachable however
                many sections the line grows to. */}
            <div className="burger-drawer__system">
              <PassStop go={go} active={currentPath === '/profile'} t={t} />
              <MapStop
                path="/settings"
                color={settings.color}
                glyph={settings.icon}
                title={settings.title}
                active={currentPath === '/settings'}
                last
                onClick={() => go('/settings')}
              />
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  )
}
