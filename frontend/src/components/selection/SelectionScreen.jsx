import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useLang } from '../../LangContext'
import { sectionFor, stationFor } from '../../config/stations'
import { StationSign } from '../station/StationSign'
import { useStationClock } from '../station/useStationClock'
import { startAmbiance, stopAmbiance } from '../../lib/audio'
import { PlatformCountContext } from './platformCount'

/**
 * SelectionScreen
 * Layout shell shared by every level/phase/mode selection screen.
 *
 * ── The station plate ──
 * Home is a platform in 日本語駅 and every section is a service
 * leaving it (see config/stations.js). This is where you get off: the
 * same 駅名標 the home screen hangs over its own platform, now naming
 * the station you have just arrived at. One component, two ends of
 * the same journey — which is what makes the app read as a line
 * rather than a set of screens.
 *
 * The plate is derived from the URL rather than passed in: every
 * selection screen lives at its own section's path (or under it — see
 * sectionFor/stationFor, which both fall back to the longest matching
 * prefix, so a custom deck's own study setup at /decks/<id>/study is
 * recognised as standing in 教材 station), so nothing has to be threaded
 * through eleven callers.
 *
 * Props:
 *   eyebrow, heading, subtitle — optional page header, for a screen
 *     mounted at a path with no station at all. A plated screen's name
 *     is already on the sign overhead, so repeating it as a second
 *     heading underneath was the redundant one.
 *   maxWidth — max-width for the content column. Left unset by every
 *     caller today; the two defaults live in CSS instead, because a
 *     plated screen and a bare one want different ones.
 *
 * Also owns the 'selection' ambiance track for as long as it's
 * mounted — every level/mode/tier/theme picker renders inside this
 * shell, so this is the one place that needs the start/stop effect.
 */

// のりば — the right-hand half of the plate: what the panel is, how
// many platforms it has, and the time. Stacked into one block rather
// than spread across two opposite corners, where the label and the
// clock were two specks with 700px of nothing between them and read
// as leftovers rather than a readout.
//
// The clock is not filler — a platform always tells you the time, and
// this is the same component ticking on the same minute boundary as
// the one on the home board. Arriving somewhere and finding the clock
// still running is most of what makes two screens feel like one place.
function PlatformAside({ t, count }) {
  const now = useStationClock()
  const hh  = String(now.getHours()).padStart(2, '0')
  const mm  = String(now.getMinutes()).padStart(2, '0')

  return (
    <>
      <span className="station-sign__noriba">
        <span className="station-sign__label">
          <span lang="ja">のりば</span>
          {count > 0 && <span className="station-sign__count">{count}</span>}
        </span>
        <span className="station-sign__label-sub">{t.platforms}</span>
      </span>
      <span className="board-clock station-sign__clock" aria-label={`${hh}:${mm}`}>
        {hh}<span className="board-clock__colon" aria-hidden="true">:</span>{mm}
      </span>
    </>
  )
}

export default function SelectionScreen({
  children,
  eyebrow,
  heading,
  subtitle,
  maxWidth,
}) {
  const { t } = useLang()
  const [count, setCount] = useState(0)

  useEffect(() => {
    startAmbiance('selection')
    return () => stopAmbiance()
    // Mount/unmount only. Without the dependency array this
    // effect re-ran on every render, tearing the loop down and
    // starting it again from zero each time.
  }, [])

  const innerStyle =
    maxWidth ? { '--content-max-w': `${maxWidth}px` } : undefined

  // From the router rather than window.location: the two agree under
  // BrowserRouter, but only one of them is the app's actual source of
  // truth for where you are, and only one survives being rendered
  // under a MemoryRouter (tests, previews) without silently deciding
  // it's on some other page.
  const { pathname } = useLocation()
  // sectionFor, not an exact getNavLinks match: it falls back to the
  // longest matching prefix, so a custom deck's own study setup
  // (/decks/<id>/study) is finally recognised as standing in 教材 station
  // instead of falling through to the bare "Choose your training mode"
  // heading — the one selection screen in the app that had no plate.
  const section = sectionFor(pathname, t)
  const station = stationFor(pathname)

  // The section's pigment becomes the line colour for everything
  // below the plate — the numbering roundels, the card rails, the
  // route diagram. One line, one colour, from the departure board all
  // the way to the last choice before you start studying.
  const lineStyle = section
    ? { ...innerStyle, '--row-color': section.color, '--line-color': section.color }
    : innerStyle

  return (
    <div className={`container selection-screen${section ? ' selection-screen--station' : ''}`}>
      <div className="selection-screen__inner" style={lineStyle}>
        {section ? (
          <StationSign
            station={station}
            name={section.icon}
            latin={section.title}
            color={section.color}
            aside={<PlatformAside t={t} count={count} />}
            size="sm"
          />
        ) : (eyebrow || heading || subtitle) && (
          <div className="selector-header">
            {eyebrow && <div className="selector-header__eyebrow">{eyebrow}</div>}
            {heading && <div className="selector-header__title">{heading}</div>}
            {subtitle && <div className="selector-header__subtitle">{subtitle}</div>}
          </div>
        )}
        <PlatformCountContext.Provider value={setCount}>
          {children}
        </PlatformCountContext.Provider>
      </div>
    </div>
  )
}
